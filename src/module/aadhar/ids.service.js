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
  const apiError = error.response?.data?.error?.error;

  return (
    apiError?.metadata?.fields?.[0]?.message ||
    apiError?.message ||
    error.response?.data?.message ||
    error.message ||
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

  // IMPORTANT:
  // Confirm IDSPay's explicit successful
  // verification status before marking KYC
  // as verified. XML details alone are not
  // sufficient proof.

  return {
    fullName: aadhaarData.full_name,
    gender: aadhaarData.gender || null,
    dob: aadhaarData.dob,
    state: aadhaarData.address?.state || null,
  };
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
  // NEW: CHECK EXISTING PROFILE
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

  // Request verification session from IDSPay
  const providerResult = await generateDigilockerTokenService(aadhaar_number);

  const responseData = providerResult?.data;

  if (!responseData?.client_id) {
    throw createError(502, "Unable to create DigiLocker verification session");
  }

  const maskedAadhaar = `XXXX-XXXX-${aadhaar_number.slice(-4)}`;

  const verification = await AadhaarVerification.create({
    userId,
    maskedAadhaar,
    verificationId: responseData.client_id,
    verified: false,
  });

  // ========================================
  // NEW: UPDATE PROFILE KYC TO PENDING
  // ========================================

  const submittedAt = new Date();

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

  // Return original provider response.
  return {
    verificationId: verification._id,
    client_id: responseData.client_id,
    verified: false,

    kycStatus: updatedProfile.kycStatus,
    isKycVerified: updatedProfile.isKycVerified,

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

  // Ensure session belongs to the user.
  const verification = await AadhaarVerification.findOne({
    userId,
    verificationId: client_id,
  });

  if (!verification) {
    throw createError(404, "Verification session not found");
  }

  if (verification.verified) {
    return {
      verificationId: verification._id,
      verified: true,
      status: "VERIFIED",
    };
  }

  // Fetch authoritative result from IDSPay.
  const providerResult = await fetchDigilockerDetailsService(client_id);

  const verifiedDetails = extractVerifiedDetails(providerResult);

  // IMPORTANT:
  // Before this code is used in production,
  // validate IDSPay's documented successful
  // verification status. Do not rely only
  // on XML availability or callback status.

  const verifiedAt = new Date();

  const updatedVerification = await AadhaarVerification.findOneAndUpdate(
    {
      _id: verification._id,
      userId,
    },
    {
      $set: {
        fullName: verifiedDetails.fullName,
        gender: verifiedDetails.gender,
        dob: verifiedDetails.dob,
        state: verifiedDetails.state,
        verified: true,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // ========================================
  // NEW: UPDATE ALL EXISTING PROFILE KYC
  // FIELDS AFTER SUCCESSFUL VERIFICATION
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

      $setOnInsert: {},
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedProfile) {
    throw createError(404, "Profile not found");
  }

  // Preserve compatibility if User also stores KYC.
  await User.findByIdAndUpdate(userId, {
    $set: {
      kycStatus: "VERIFIED",
      isKycVerified: true,
      kycVerifiedAt: verifiedAt,
    },
  });

  return {
    verificationId: updatedVerification._id,
    status: "VERIFIED",
    verified: true,
    verifiedAt,

    kycStatus: updatedProfile.kycStatus,
    isKycVerified: updatedProfile.isKycVerified,
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

  const verification = await AadhaarVerification.findOne({
    verificationId: client_id,
  });

  if (!verification) {
    throw createError(404, "Verification session not found");
  }

  // Treat callback parameters as untrusted.
  // Provider verification must be confirmed
  // through a trusted server-side response.

  if (status !== "success") {
    return {
      verificationId: verification._id,
      status: "PENDING",
      message: "Verification not confirmed",
    };
  }

  return fetchAadhaarDetailsService({
    userId: verification.userId,
    client_id,
  });
};
