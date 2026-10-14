// import mongoose from "mongoose";
// import {
//   generateDigilockerTokenService,
//   fetchDigilockerDetailsService,
// } from "./ids.instance.js";

// import AadhaarVerification from "../../models/aadharVerificationModel.js";
// import User from "../../models/userModel.js";
// import Profile from "../../models/profileModel.js";

// // ==========================================
// // HELPER: CREATE SERVICE ERROR
// // ==========================================

// const createError = (statusCode, message) => {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   return error;
// };

// // ==========================================
// // HELPER: EXTRACT IDSPAY ERROR
// // ==========================================

// export const getIdsPayErrorMessage = (error) => {
//   const apiError = error.response?.data?.error?.error;

//   return (
//     apiError?.metadata?.fields?.[0]?.message ||
//     apiError?.message ||
//     error.response?.data?.message ||
//     error.message ||
//     "Verification failed"
//   );
// };

// // ==========================================
// // HELPER: VALIDATE VERIFIED DETAILS
// // ==========================================

// const extractVerifiedDetails = (data) => {
//   const aadhaarData = data?.data?.aadhaar_xml_data;

//   if (!aadhaarData || !aadhaarData.full_name || !aadhaarData.dob) {
//     throw createError(422, "Verified Aadhaar details are not available");
//   }

//   // IMPORTANT:
//   // Configure this according to the documented
//   // IDSPay success/status response.
//   // Do not rely on a browser callback alone.

//   return {
//     fullName: aadhaarData.full_name,
//     gender: aadhaarData.gender || null,
//     dob: aadhaarData.dob,
//     state: aadhaarData.address?.state || null,
//   };
// };

// // ==========================================
// // 1. GENERATE DIGILOCKER TOKEN
// // ==========================================

// export const generateAadhaarTokenService = async ({
//   userId,
//   aadhaar_number,
// }) => {
//   if (!userId || !mongoose.isValidObjectId(userId)) {
//     throw createError(401, "Authentication is required");
//   }

//   if (typeof aadhaar_number !== "string" || !/^\d{12}$/.test(aadhaar_number)) {
//     throw createError(400, "A valid 12-digit Aadhaar number is required");
//   }

//   const user = await User.findById(userId).select("_id isBlocked").lean();

//   if (!user) {
//     throw createError(404, "User not found");
//   }

//   if (user.isBlocked) {
//     throw createError(403, "Your account has been blocked");
//   }

//   // Request verification session from IDSPay
//   const providerResult = await generateDigilockerTokenService(aadhaar_number);

//   const responseData = providerResult?.data;

//   if (!responseData?.client_id) {
//     throw createError(502, "Unable to create DigiLocker verification session");
//   }

//   const maskedAadhaar = `XXXX-XXXX-${aadhaar_number.slice(-4)}`;

//   const verification = await AadhaarVerification.create({
//     userId,
//     maskedAadhaar,
//     verificationId: responseData.client_id,
//     verified: false,
//   });

//   // Return only fields the frontend needs.
//   return {
//     verificationId: verification._id,
//     client_id: responseData.client_id,
//     verified: false,

//     // The verification URL must come from
//     // IDSPay's documented response structure.
//     // Don't invent or construct it locally.
//     digilocker: responseData,
//   };
// };

// // ==========================================
// // 2. FETCH DIGILOCKER DETAILS
// // ==========================================

// export const fetchAadhaarDetailsService = async ({ userId, client_id }) => {
//   if (!userId || !mongoose.isValidObjectId(userId)) {
//     throw createError(401, "Authentication is required");
//   }

//   if (typeof client_id !== "string" || !client_id.trim()) {
//     throw createError(400, "client_id is required");
//   }

//   // Ensure the session belongs to this user.
//   const verification = await AadhaarVerification.findOne({
//     userId,
//     verificationId: client_id,
//   });

//   if (!verification) {
//     throw createError(404, "Verification session not found");
//   }

//   if (verification.verified) {
//     return {
//       verificationId: verification._id,
//       verified: true,
//       status: "VERIFIED",
//     };
//   }

//   // Fetch authoritative result from IDSPay.
//   const providerResult = await fetchDigilockerDetailsService(client_id);

//   const verifiedDetails = extractVerifiedDetails(providerResult);

//   // IMPORTANT:
//   // Before enabling production verification,
//   // validate IDSPay's explicit successful/
//   // completed status according to its docs.
//   // Extracting Aadhaar XML alone is not enough.

//   const verifiedAt = new Date();

//   const updatedVerification = await AadhaarVerification.findOneAndUpdate(
//     {
//       _id: verification._id,
//       userId,
//     },
//     {
//       $set: {
//         fullName: verifiedDetails.fullName,
//         gender: verifiedDetails.gender,
//         dob: verifiedDetails.dob,
//         state: verifiedDetails.state,
//         verified: true,
//       },
//     },
//     {
//       new: true,
//       runValidators: true,
//     },
//   );

//   // Keep MeetZo Profile KYC fields updated.
//   await Profile.findOneAndUpdate(
//     { userId },
//     {
//       $set: {
//         kycStatus: "VERIFIED",
//         isKycVerified: true,
//         kycVerifiedAt: verifiedAt,
//         kycRejectionReason: null,
//       },
//     },
//   );

//   // Preserve compatibility if User also stores KYC.
//   await User.findByIdAndUpdate(userId, {
//     $set: {
//       kycStatus: "VERIFIED",
//       isKycVerified: true,
//       kycVerifiedAt: verifiedAt,
//     },
//   });

//   return {
//     verificationId: updatedVerification._id,
//     status: "VERIFIED",
//     verified: true,
//     verifiedAt,
//   };
// };

// // ==========================================
// // 3. DIGILOCKER CALLBACK PROCESSING
// // ==========================================

// export const processDigilockerCallbackService = async ({
//   client_id,
//   status,
// }) => {
//   if (typeof client_id !== "string" || !client_id.trim()) {
//     throw createError(400, "client_id is required");
//   }

//   const verification = await AadhaarVerification.findOne({
//     verificationId: client_id,
//   });

//   if (!verification) {
//     throw createError(404, "Verification session not found");
//   }

//   // Treat callback parameters as untrusted input.
//   // Callback authentication/signature validation
//   // must happen before processing.

//   if (status !== "success") {
//     return {
//       verificationId: verification._id,
//       status: "PENDING",
//       message: "Verification not confirmed",
//     };
//   }

//   // Reconcile using the provider's server-side API.
//   return fetchAadhaarDetailsService({
//     userId: verification.userId,
//     client_id,
//   });
// };

import mongoose from "mongoose";

import {
  generateDigilockerTokenService,
  fetchDigilockerDetailsService,
} from "./ids.instance.js";

import AadhaarVerification from "../../models/aadharVerificationModel.js";
import User from "../../models/userModel.js";
import Profile from "../../models/profileModel.js";

// ==========================================
// HELPER: CREATE SERVICE ERROR
// ==========================================

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==========================================
// HELPER: EXTRACT IDSPAY ERROR
// ==========================================

export const getIdsPayErrorMessage = (error) => {
  const apiError = error?.response?.data?.error?.error;

  return (
    apiError?.metadata?.fields?.[0]?.message ||
    apiError?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Verification failed"
  );
};

// ==========================================
// HELPER: VALIDATE VERIFIED DETAILS
// ==========================================

const extractVerifiedDetails = (data) => {
  const aadhaarData = data?.data?.aadhaar_xml_data;

  if (!aadhaarData || !aadhaarData.full_name || !aadhaarData.dob) {
    throw createError(422, "Verified Aadhaar details are not available");
  }

  return {
    fullName: aadhaarData.full_name,
    gender: aadhaarData.gender || null,
    dob: aadhaarData.dob,
    state: aadhaarData.address?.state || null,
  };
};

// ==========================================
// HELPER: VERIFY IDSPAY SUCCESS
// ==========================================

const confirmProviderVerification = (providerResult) => {
  if (!providerResult?.data) {
    throw createError(502, "Invalid response received from IDSPay");
  }

  // Replace with the documented IDSPay
  // fetchDetails success condition.
  //
  // A callback containing status=success,
  // or a response containing Aadhaar XML,
  // is not sufficient to confirm verification.

  throw createError(
    502,
    "IDSPay verification success validation is not configured",
  );
};

// ==========================================
// HELPER: GET LATEST VERIFICATION
// ==========================================

const getLatestVerification = async (userId) => {
  return AadhaarVerification.findOne({
    userId,
  }).sort({
    createdAt: -1,
    _id: -1,
  });
};

// ==========================================
// 1. GENERATE DIGILOCKER TOKEN
// ==========================================

export const generateAadhaarTokenService = async ({
  userId,
  aadhaar_number,
}) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError(401, "Authentication is required");
  }

  if (typeof aadhaar_number !== "string" || !/^\d{12}$/.test(aadhaar_number)) {
    throw createError(400, "A valid 12-digit Aadhaar number is required");
  }

  const user = await User.findById(userId).select("_id isBlocked").lean();

  if (!user) {
    throw createError(404, "User not found");
  }

  if (user.isBlocked) {
    throw createError(403, "Your account has been blocked");
  }

  // ========================================
  // CHECK EXISTING PROFILE
  // ========================================

  const profile = await Profile.findOne({
    userId,
  })
    .select("_id kycStatus isKycVerified")
    .lean();

  if (!profile) {
    throw createError(404, "Profile not found");
  }

  if (profile.isKycVerified === true || profile.kycStatus === "VERIFIED") {
    throw createError(409, "Your KYC is already verified");
  }

  // ========================================
  // GENERATE TOKEN FROM IDSPAY
  // ========================================

  // Obtain explicit user consent in the
  // controller/UI before initiating this API.

  const providerResult = await generateDigilockerTokenService(aadhaar_number);

  const responseData = providerResult?.data;

  if (!responseData?.client_id) {
    throw createError(502, "Unable to create DigiLocker verification session");
  }

  const maskedAadhaar = `XXXX-XXXX-${aadhaar_number.slice(-4)}`;

  const submittedAt = new Date();

  // ========================================
  // SAVE AADHAAR VERIFICATION
  // ========================================

  const verification = await AadhaarVerification.create({
    userId,
    maskedAadhaar,
    verificationId: responseData.client_id,

    apiProvider: "IDSPay",
    verificationMethod: "DIGILOCKER",

    status: "PENDING",
    verified: false,

    initiatedAt: submittedAt,
    verifiedAt: null,
  });

  // ========================================
  // UPDATE PROFILE KYC TO PENDING
  // ========================================

  const updatedProfile = await Profile.findOneAndUpdate(
    {
      userId,
      isKycVerified: { $ne: true },
      kycStatus: { $ne: "VERIFIED" },
    },
    {
      $set: {
        kycDocumentType: "AADHAAR",
        kycStatus: "PENDING",
        isKycVerified: false,
        kycSubmittedAt: submittedAt,
        kycVerifiedAt: null,
        kycRejectionReason: null,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedProfile) {
    throw createError(409, "Profile KYC could not be updated");
  }

  // ========================================
  // RESPONSE
  // ========================================

  return {
    verificationId: verification._id,
    client_id: responseData.client_id,

    status: "PENDING",
    verified: false,

    kycStatus: updatedProfile.kycStatus,
    isKycVerified: updatedProfile.isKycVerified,
    kycDocumentType: updatedProfile.kycDocumentType,

    // Keep only URL/launch fields needed by
    // Flutter after confirming IDSPay's
    // documented response structure.
    // The callback URL is not the launch URL.
    digilocker: responseData,
  };
};

// ==========================================
// 2. FETCH DIGILOCKER DETAILS
// ==========================================

export const fetchAadhaarDetailsService = async ({ userId, client_id }) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError(401, "Authentication is required");
  }

  if (typeof client_id !== "string" || !client_id.trim()) {
    throw createError(400, "client_id is required");
  }

  // ========================================
  // FIND VERIFICATION SESSION
  // ========================================

  const verification = await AadhaarVerification.findOne({
    userId,
    verificationId: client_id,
  });

  if (!verification) {
    throw createError(404, "Verification session not found");
  }

  // ========================================
  // VERIFY THIS IS THE LATEST SESSION
  // ========================================

  const latestVerification = await getLatestVerification(userId);

  if (
    !latestVerification ||
    String(latestVerification._id) !== String(verification._id)
  ) {
    throw createError(409, "This verification session is no longer active");
  }

  // ========================================
  // HANDLE ALREADY VERIFIED SESSION
  // ========================================

  if (verification.verified === true) {
    const profile = await Profile.findOne({
      userId,
    })
      .select("kycStatus isKycVerified kycDocumentType kycVerifiedAt")
      .lean();

    if (profile?.isKycVerified === true && profile?.kycStatus === "VERIFIED") {
      return {
        verificationId: verification._id,
        status: "VERIFIED",
        verified: true,
        kycStatus: profile.kycStatus,
        isKycVerified: profile.isKycVerified,
        kycDocumentType: profile.kycDocumentType,
        verifiedAt: profile.kycVerifiedAt,
      };
    }

    throw createError(
      409,
      "KYC records are inconsistent and require reconciliation",
    );
  }

  if (["REJECTED", "FAILED", "EXPIRED"].includes(verification.status)) {
    throw createError(409, "Verification session is no longer active");
  }

  // ========================================
  // FETCH DETAILS FROM IDSPAY
  // ========================================

  const providerResult = await fetchDigilockerDetailsService(client_id);

  // Must validate explicit provider success
  // before updating any record to VERIFIED.
  confirmProviderVerification(providerResult);

  const verifiedDetails = extractVerifiedDetails(providerResult);

  const verifiedAt = new Date();

  // ========================================
  // UPDATE AADHAAR VERIFICATION RECORD
  // ========================================

  const updatedVerification = await AadhaarVerification.findOneAndUpdate(
    {
      _id: verification._id,
      userId,
      verified: { $ne: true },
      status: { $in: ["INITIATED", "PENDING"] },
    },
    {
      $set: {
        fullName: verifiedDetails.fullName,
        gender: verifiedDetails.gender,
        dob: verifiedDetails.dob,
        state: verifiedDetails.state,

        status: "VERIFIED",
        verified: true,
        verifiedAt: verifiedAt,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedVerification) {
    throw createError(409, "Verification session could not be updated");
  }

  // ========================================
  // UPDATE PROFILE KYC TO VERIFIED
  // ========================================

  const updatedProfile = await Profile.findOneAndUpdate(
    { userId },
    {
      $set: {
        kycDocumentType: "AADHAAR",
        kycStatus: "VERIFIED",
        isKycVerified: true,
        kycVerifiedAt: verifiedAt,
        kycRejectionReason: null,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedProfile) {
    throw createError(404, "Profile not found");
  }

  // ========================================
  // UPDATE USER KYC (IF SCHEMA SUPPORTS IT)
  // ========================================

  const userKycFields = {};

  if (User.schema.path("kycStatus")) {
    userKycFields.kycStatus = "VERIFIED";
  }

  if (User.schema.path("isKycVerified")) {
    userKycFields.isKycVerified = true;
  }

  if (User.schema.path("kycVerifiedAt")) {
    userKycFields.kycVerifiedAt = verifiedAt;
  }

  if (Object.keys(userKycFields).length > 0) {
    await User.findByIdAndUpdate(userId, {
      $set: userKycFields,
    });
  }

  // ========================================
  // RESPONSE
  // ========================================

  return {
    verificationId: updatedVerification._id,

    status: "VERIFIED",
    verified: true,
    verifiedAt,

    kycDocumentType: updatedProfile.kycDocumentType,
    kycStatus: updatedProfile.kycStatus,
    isKycVerified: updatedProfile.isKycVerified,
    kycVerifiedAt: updatedProfile.kycVerifiedAt,
  };
};

// ==========================================
// 3. DIGILOCKER CALLBACK PROCESSING
// ==========================================

export const processDigilockerCallbackService = async ({
  client_id,
  status,
}) => {
  if (typeof client_id !== "string" || !client_id.trim()) {
    throw createError(400, "client_id is required");
  }

  // ========================================
  // FIND VERIFICATION SESSION
  // ========================================

  const verification = await AadhaarVerification.findOne({
    verificationId: client_id,
  });

  if (!verification) {
    throw createError(404, "Verification session not found");
  }

  // ========================================
  // CALLBACK STATUS
  // ========================================

  if (status !== "success") {
    return {
      verificationId: verification._id,
      status: "PENDING",
      verified: false,
      message: "Verification not confirmed",
    };
  }

  // ========================================
  // FETCH AND CONFIRM VERIFIED DETAILS
  // ========================================

  return fetchAadhaarDetailsService({
    userId: verification.userId,
    client_id,
  });
};
