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

// extract date from aadharcard
// const parseAadhaarDob = (dob) => {
//   if (typeof dob !== "string") {
//     throw createError(422, "Invalid Aadhaar date of birth");
//   }

//   const value = dob.trim();

//   let year;
//   let month;
//   let day;

//   if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)) {
//     const parts = value.split(/[-/]/);
//     day = Number(parts[0]);
//     month = Number(parts[1]);
//     year = Number(parts[2]);
//   } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
//     const parts = value.split("-");
//     year = Number(parts[0]);
//     month = Number(parts[1]);
//     day = Number(parts[2]);
//   } else {
//     throw createError(422, "Unsupported Aadhaar DOB format");
//   }

//   const date = new Date(
//     Date.UTC(year, month - 1, day)
//   );

//   if (
//     date.getUTCFullYear() !== year ||
//     date.getUTCMonth() !== month - 1 ||
//     date.getUTCDate() !== day
//   ) {
//     throw createError(422, "Invalid Aadhaar date of birth");
//   }

//   const today = new Date();

//   const eighteenYearsAgo = new Date(
//     Date.UTC(
//       today.getUTCFullYear() - 18,
//       today.getUTCMonth(),
//       today.getUTCDate()
//     )
//   );

//   if (date > eighteenYearsAgo) {
//     throw createError(
//       403,
//       "You must be at least 18 years old to use MeetZo"
//     );
//   }

//   return date;
// };

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















// import mongoose from "mongoose";

// import {
//   generateDigilockerTokenService,
//   fetchDigilockerDetailsService,
// } from "./ids.instance.js";

// import AadhaarVerification from "../../models/aadharVerificationModel.js";
// import User from "../../models/userModel.js";
// import Profile from "../../models/profileModel.js";

// const createError = (statusCode, message) => {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   return error;
// };

// export const getIdsPayErrorMessage = (error) => {
//   const apiError = error?.response?.data?.error?.error;

//   return (
//     apiError?.metadata?.fields?.[0]?.message ||
//     apiError?.message ||
//     error?.response?.data?.message ||
//     error?.message ||
//     "Verification failed"
//   );
// };

// const extractVerifiedDetails = (data) => {
//   const aadhaarData = data?.data?.aadhaar_xml_data;

//   if (!aadhaarData || !aadhaarData.full_name || !aadhaarData.dob) {
//     throw createError(
//       422,
//       "Verified Aadhaar details are not available"
//     );
//   }

//   return {
//     fullName: aadhaarData.full_name,
//     gender: aadhaarData.gender || null,
//     dob: aadhaarData.dob,
//     state: aadhaarData.address?.state || null,
//   };
// };

// const parseAadhaarDob = (dob) => {
//   if (typeof dob !== "string") {
//     throw createError(422, "Invalid Aadhaar date of birth");
//   }

//   const value = dob.trim();

//   let day;
//   let month;
//   let year;

//   if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)) {
//     const parts = value.split(/[-/]/);

//     day = Number(parts[0]);
//     month = Number(parts[1]);
//     year = Number(parts[2]);
//   } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
//     const parts = value.split("-");

//     year = Number(parts[0]);
//     month = Number(parts[1]);
//     day = Number(parts[2]);
//   } else {
//     throw createError(
//       422,
//       "Unsupported Aadhaar DOB format"
//     );
//   }

//   if (year < 1900 || year > 9999) {
//     throw createError(422, "Invalid Aadhaar date of birth");
//   }

//   const date = new Date(Date.UTC(year, month - 1, day));

//   if (
//     date.getUTCFullYear() !== year ||
//     date.getUTCMonth() !== month - 1 ||
//     date.getUTCDate() !== day
//   ) {
//     throw createError(422, "Invalid Aadhaar date of birth");
//   }

//   const today = new Date();

//   let age = today.getUTCFullYear() - year;

//   if (
//     today.getUTCMonth() + 1 < month ||
//     (
//       today.getUTCMonth() + 1 === month &&
//       today.getUTCDate() < day
//     )
//   ) {
//     age--;
//   }

//   if (age < 18) {
//     throw createError(
//       403,
//       "You must be at least 18 years old to use MeetZo"
//     );
//   }

//   return date;
// };

// const confirmProviderVerification = (providerResult) => {
//   if (!providerResult?.data) {
//     throw createError(
//       502,
//       "Invalid response received from IDSPay"
//     );
//   }

//   // Retained from your previous service.
//   // Replace this guard only after confirming the
//   // documented IDSPay verification-success field.
//   throw createError(
//     502,
//     "IDSPay verification success validation is not configured"
//   );
// };

// const getLatestVerification = async (userId) => {
//   return AadhaarVerification.findOne({
//     userId,
//   }).sort({
//     createdAt: -1,
//     _id: -1,
//   });
// };

// export const generateAadhaarTokenService = async ({
//   userId,
//   aadhaar_number,
// }) => {
//   if (!userId || !mongoose.isValidObjectId(userId)) {
//     throw createError(401, "Authentication is required");
//   }

//   if (
//     typeof aadhaar_number !== "string" ||
//     !/^\d{12}$/.test(aadhaar_number)
//   ) {
//     throw createError(
//       400,
//       "A valid 12-digit Aadhaar number is required"
//     );
//   }

//   const user = await User.findById(userId)
//     .select("_id isBlocked")
//     .lean();

//   if (!user) {
//     throw createError(404, "User not found");
//   }

//   if (user.isBlocked) {
//     throw createError(403, "Your account has been blocked");
//   }

//   const profile = await Profile.findOne({ userId })
//     .select("_id kycStatus isKycVerified")
//     .lean();

//   if (!profile) {
//     throw createError(404, "Profile not found");
//   }

//   if (
//     profile.isKycVerified === true ||
//     profile.kycStatus === "VERIFIED"
//   ) {
//     throw createError(409, "Your KYC is already verified");
//   }

//   const providerResult =
//     await generateDigilockerTokenService(aadhaar_number);

//   const responseData = providerResult?.data;

//   if (!responseData?.client_id) {
//     throw createError(
//       502,
//       "Unable to create DigiLocker verification session"
//     );
//   }

//   const maskedAadhaar =
//     `XXXX-XXXX-${aadhaar_number.slice(-4)}`;

//   const submittedAt = new Date();

//   const verification = await AadhaarVerification.create({
//     userId,
//     maskedAadhaar,
//     verificationId: responseData.client_id,

//     apiProvider: "IDSPay",
//     verificationMethod: "DIGILOCKER",

//     status: "PENDING",
//     verified: false,

//     initiatedAt: submittedAt,
//     verifiedAt: null,
//   });

//   const updatedProfile = await Profile.findOneAndUpdate(
//     {
//       userId,
//       isKycVerified: { $ne: true },
//       kycStatus: { $ne: "VERIFIED" },
//     },
//     {
//       $set: {
//         kycDocumentType: "AADHAAR",
//         kycStatus: "PENDING",
//         isKycVerified: false,
//         kycSubmittedAt: submittedAt,
//         kycVerifiedAt: null,
//         kycRejectionReason: null,
//       },
//     },
//     {
//       returnDocument: "after",
//       runValidators: true,
//     }
//   );

//   if (!updatedProfile) {
//     throw createError(
//       409,
//       "Profile KYC could not be updated"
//     );
//   }

//   return {
//     verificationId: verification._id,
//     client_id: responseData.client_id,

//     status: "PENDING",
//     verified: false,

//     kycStatus: updatedProfile.kycStatus,
//     isKycVerified: updatedProfile.isKycVerified,
//     kycDocumentType: updatedProfile.kycDocumentType,

//     digilocker: responseData,
//   };
// };

// export const fetchAadhaarDetailsService = async ({
//   userId,
//   client_id,
// }) => {
//   if (!userId || !mongoose.isValidObjectId(userId)) {
//     throw createError(401, "Authentication is required");
//   }

//   if (typeof client_id !== "string" || !client_id.trim()) {
//     throw createError(400, "client_id is required");
//   }

//   const verification = await AadhaarVerification.findOne({
//     userId,
//     verificationId: client_id,
//   });

//   if (!verification) {
//     throw createError(404, "Verification session not found");
//   }

//   const latestVerification =
//     await getLatestVerification(userId);

//   if (
//     !latestVerification ||
//     String(latestVerification._id) !==
//       String(verification._id)
//   ) {
//     throw createError(
//       409,
//       "This verification session is no longer active"
//     );
//   }

//   if (verification.verified === true) {
//     const profile = await Profile.findOne({ userId })
//       .select(
//         "dateOfBirth kycStatus isKycVerified kycDocumentType kycVerifiedAt"
//       )
//       .lean();

//     if (
//       profile?.isKycVerified === true &&
//       profile?.kycStatus === "VERIFIED"
//     ) {
//       return {
//         verificationId: verification._id,
//         status: "VERIFIED",
//         verified: true,
//         dateOfBirth: profile.dateOfBirth,
//         kycStatus: profile.kycStatus,
//         isKycVerified: profile.isKycVerified,
//         kycDocumentType: profile.kycDocumentType,
//         verifiedAt: profile.kycVerifiedAt,
//       };
//     }

//     throw createError(
//       409,
//       "KYC records are inconsistent and require reconciliation"
//     );
//   }

//   if (
//     ["REJECTED", "FAILED", "EXPIRED"].includes(
//       verification.status
//     )
//   ) {
//     throw createError(
//       409,
//       "Verification session is no longer active"
//     );
//   }

//   const providerResult =
//     await fetchDigilockerDetailsService(client_id);

//   confirmProviderVerification(providerResult);

//   const verifiedDetails =
//     extractVerifiedDetails(providerResult);

//   const aadhaarDob =
//     parseAadhaarDob(verifiedDetails.dob);

//   const verifiedAt = new Date();

//   const updatedVerification =
//     await AadhaarVerification.findOneAndUpdate(
//       {
//         _id: verification._id,
//         userId,
//         verified: { $ne: true },
//         status: { $in: ["INITIATED", "PENDING"] },
//       },
//       {
//         $set: {
//           fullName: verifiedDetails.fullName,
//           gender: verifiedDetails.gender,
//           dob: verifiedDetails.dob,
//           state: verifiedDetails.state,

//           status: "VERIFIED",
//           verified: true,
//           verifiedAt,
//         },
//       },
//       {
//         returnDocument: "after",
//         runValidators: true,
//       }
//     );

//   if (!updatedVerification) {
//     throw createError(
//       409,
//       "Verification session could not be updated"
//     );
//   }

//   const updatedProfile = await Profile.findOneAndUpdate(
//     { userId },
//     {
//       $set: {
//         dateOfBirth: aadhaarDob,

//         kycDocumentType: "AADHAAR",
//         kycStatus: "VERIFIED",
//         isKycVerified: true,
//         kycVerifiedAt: verifiedAt,
//         kycRejectionReason: null,
//       },
//     },
//     {
//       returnDocument: "after",
//       runValidators: true,
//     }
//   );

//   if (!updatedProfile) {
//     throw createError(404, "Profile not found");
//   }

//   const userKycFields = {};

//   if (User.schema.path("kycStatus")) {
//     userKycFields.kycStatus = "VERIFIED";
//   }

//   if (User.schema.path("isKycVerified")) {
//     userKycFields.isKycVerified = true;
//   }

//   if (User.schema.path("kycVerifiedAt")) {
//     userKycFields.kycVerifiedAt = verifiedAt;
//   }

//   if (Object.keys(userKycFields).length > 0) {
//     await User.findByIdAndUpdate(userId, {
//       $set: userKycFields,
//     });
//   }

//   return {
//     verificationId: updatedVerification._id,

//     status: "VERIFIED",
//     verified: true,
//     verifiedAt,

//     dateOfBirth: updatedProfile.dateOfBirth,

//     kycDocumentType: updatedProfile.kycDocumentType,
//     kycStatus: updatedProfile.kycStatus,
//     isKycVerified: updatedProfile.isKycVerified,
//     kycVerifiedAt: updatedProfile.kycVerifiedAt,
//   };
// };

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
//     throw createError(
//       404,
//       "Verification session not found"
//     );
//   }

//   if (status !== "success") {
//     return {
//       verificationId: verification._id,
//       status: "PENDING",
//       verified: false,
//       message: "Verification not confirmed",
//     };
//   }

//   return fetchAadhaarDetailsService({
//     userId: verification.userId,
//     client_id,
//   });
// };
