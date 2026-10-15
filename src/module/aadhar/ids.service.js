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
//   const apiError = error?.response?.data?.error?.error;

//   return (
//     apiError?.metadata?.fields?.[0]?.message ||
//     apiError?.message ||
//     error?.response?.data?.message ||
//     error?.message ||
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

//   return {
//     fullName: aadhaarData.full_name,
//     gender: aadhaarData.gender || null,
//     dob: aadhaarData.dob,
//     state: aadhaarData.address?.state || null,
//   };
// };

// // extract date from aadharcard
// // const parseAadhaarDob = (dob) => {
// //   if (typeof dob !== "string") {
// //     throw createError(422, "Invalid Aadhaar date of birth");
// //   }

// //   const value = dob.trim();

// //   let year;
// //   let month;
// //   let day;

// //   if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)) {
// //     const parts = value.split(/[-/]/);
// //     day = Number(parts[0]);
// //     month = Number(parts[1]);
// //     year = Number(parts[2]);
// //   } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
// //     const parts = value.split("-");
// //     year = Number(parts[0]);
// //     month = Number(parts[1]);
// //     day = Number(parts[2]);
// //   } else {
// //     throw createError(422, "Unsupported Aadhaar DOB format");
// //   }

// //   const date = new Date(
// //     Date.UTC(year, month - 1, day)
// //   );

// //   if (
// //     date.getUTCFullYear() !== year ||
// //     date.getUTCMonth() !== month - 1 ||
// //     date.getUTCDate() !== day
// //   ) {
// //     throw createError(422, "Invalid Aadhaar date of birth");
// //   }

// //   const today = new Date();

// //   const eighteenYearsAgo = new Date(
// //     Date.UTC(
// //       today.getUTCFullYear() - 18,
// //       today.getUTCMonth(),
// //       today.getUTCDate()
// //     )
// //   );

// //   if (date > eighteenYearsAgo) {
// //     throw createError(
// //       403,
// //       "You must be at least 18 years old to use MeetZo"
// //     );
// //   }

// //   return date;
// // };

// // ==========================================
// // HELPER: VERIFY IDSPAY SUCCESS
// // ==========================================

// const confirmProviderVerification = (providerResult) => {
//   if (!providerResult?.data) {
//     throw createError(502, "Invalid response received from IDSPay");
//   }

//   // Replace with the documented IDSPay
//   // fetchDetails success condition.
//   //
//   // A callback containing status=success,
//   // or a response containing Aadhaar XML,
//   // is not sufficient to confirm verification.

//   throw createError(
//     502,
//     "IDSPay verification success validation is not configured",
//   );
// };

// // ==========================================
// // HELPER: GET LATEST VERIFICATION
// // ==========================================

// const getLatestVerification = async (userId) => {
//   return AadhaarVerification.findOne({
//     userId,
//   }).sort({
//     createdAt: -1,
//     _id: -1,
//   });
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

//   // ========================================
//   // CHECK EXISTING PROFILE
//   // ========================================

//   const profile = await Profile.findOne({
//     userId,
//   })
//     .select("_id kycStatus isKycVerified")
//     .lean();

//   if (!profile) {
//     throw createError(404, "Profile not found");
//   }

//   if (profile.isKycVerified === true || profile.kycStatus === "VERIFIED") {
//     throw createError(409, "Your KYC is already verified");
//   }

//   // ========================================
//   // GENERATE TOKEN FROM IDSPAY
//   // ========================================

//   // Obtain explicit user consent in the
//   // controller/UI before initiating this API.

//   const providerResult = await generateDigilockerTokenService(aadhaar_number);

//   const responseData = providerResult?.data;

//   if (!responseData?.client_id) {
//     throw createError(502, "Unable to create DigiLocker verification session");
//   }

//   const maskedAadhaar = `XXXX-XXXX-${aadhaar_number.slice(-4)}`;

//   const submittedAt = new Date();

//   // ========================================
//   // SAVE AADHAAR VERIFICATION
//   // ========================================

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

//   // ========================================
//   // UPDATE PROFILE KYC TO PENDING
//   // ========================================

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
//       new: true,
//       runValidators: true,
//     },
//   );

//   if (!updatedProfile) {
//     throw createError(409, "Profile KYC could not be updated");
//   }

//   // ========================================
//   // RESPONSE
//   // ========================================

//   return {
//     verificationId: verification._id,
//     client_id: responseData.client_id,

//     status: "PENDING",
//     verified: false,

//     kycStatus: updatedProfile.kycStatus,
//     isKycVerified: updatedProfile.isKycVerified,
//     kycDocumentType: updatedProfile.kycDocumentType,

//     // Keep only URL/launch fields needed by
//     // Flutter after confirming IDSPay's
//     // documented response structure.
//     // The callback URL is not the launch URL.
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

//   // ========================================
//   // FIND VERIFICATION SESSION
//   // ========================================

//   const verification = await AadhaarVerification.findOne({
//     userId,
//     verificationId: client_id,
//   });

//   if (!verification) {
//     throw createError(404, "Verification session not found");
//   }

//   // ========================================
//   // VERIFY THIS IS THE LATEST SESSION
//   // ========================================

//   const latestVerification = await getLatestVerification(userId);

//   if (
//     !latestVerification ||
//     String(latestVerification._id) !== String(verification._id)
//   ) {
//     throw createError(409, "This verification session is no longer active");
//   }

//   // ========================================
//   // HANDLE ALREADY VERIFIED SESSION
//   // ========================================

//   if (verification.verified === true) {
//     const profile = await Profile.findOne({
//       userId,
//     })
//       .select("kycStatus isKycVerified kycDocumentType kycVerifiedAt")
//       .lean();

//     if (profile?.isKycVerified === true && profile?.kycStatus === "VERIFIED") {
//       return {
//         verificationId: verification._id,
//         status: "VERIFIED",
//         verified: true,
//         kycStatus: profile.kycStatus,
//         isKycVerified: profile.isKycVerified,
//         kycDocumentType: profile.kycDocumentType,
//         verifiedAt: profile.kycVerifiedAt,
//       };
//     }

//     throw createError(
//       409,
//       "KYC records are inconsistent and require reconciliation",
//     );
//   }

//   if (["REJECTED", "FAILED", "EXPIRED"].includes(verification.status)) {
//     throw createError(409, "Verification session is no longer active");
//   }

//   // ========================================
//   // FETCH DETAILS FROM IDSPAY
//   // ========================================

//   const providerResult = await fetchDigilockerDetailsService(client_id);

//   // Must validate explicit provider success
//   // before updating any record to VERIFIED.
//   confirmProviderVerification(providerResult);

//   const verifiedDetails = extractVerifiedDetails(providerResult);

//   const verifiedAt = new Date();

//   // ========================================
//   // UPDATE AADHAAR VERIFICATION RECORD
//   // ========================================

//   const updatedVerification = await AadhaarVerification.findOneAndUpdate(
//     {
//       _id: verification._id,
//       userId,
//       verified: { $ne: true },
//       status: { $in: ["INITIATED", "PENDING"] },
//     },
//     {
//       $set: {
//         fullName: verifiedDetails.fullName,
//         gender: verifiedDetails.gender,
//         dob: verifiedDetails.dob,
//         state: verifiedDetails.state,

//         status: "VERIFIED",
//         verified: true,
//         verifiedAt: verifiedAt,
//       },
//     },
//     {
//       new: true,
//       runValidators: true,
//     },
//   );

//   if (!updatedVerification) {
//     throw createError(409, "Verification session could not be updated");
//   }

//   // ========================================
//   // UPDATE PROFILE KYC TO VERIFIED
//   // ========================================

//   const updatedProfile = await Profile.findOneAndUpdate(
//     { userId },
//     {
//       $set: {
//         kycDocumentType: "AADHAAR",
//         kycStatus: "VERIFIED",
//         isKycVerified: true,
//         kycVerifiedAt: verifiedAt,
//         kycRejectionReason: null,
//       },
//     },
//     {
//       new: true,
//       runValidators: true,
//     },
//   );

//   if (!updatedProfile) {
//     throw createError(404, "Profile not found");
//   }

//   // ========================================
//   // UPDATE USER KYC (IF SCHEMA SUPPORTS IT)
//   // ========================================

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

//   // ========================================
//   // RESPONSE
//   // ========================================

//   return {
//     verificationId: updatedVerification._id,

//     status: "VERIFIED",
//     verified: true,
//     verifiedAt,

//     kycDocumentType: updatedProfile.kycDocumentType,
//     kycStatus: updatedProfile.kycStatus,
//     isKycVerified: updatedProfile.isKycVerified,
//     kycVerifiedAt: updatedProfile.kycVerifiedAt,
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

//   // ========================================
//   // FIND VERIFICATION SESSION
//   // ========================================

//   const verification = await AadhaarVerification.findOne({
//     verificationId: client_id,
//   });

//   if (!verification) {
//     throw createError(404, "Verification session not found");
//   }

//   // ========================================
//   // CALLBACK STATUS
//   // ========================================

//   if (status !== "success") {
//     return {
//       verificationId: verification._id,
//       status: "PENDING",
//       verified: false,
//       message: "Verification not confirmed",
//     };
//   }

//   // ========================================
//   // FETCH AND CONFIRM VERIFIED DETAILS
//   // ========================================

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

const SESSION_RETRY_MINUTES = 15;

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

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

const validateUserId = (userId) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError(401, "Authentication is required");
  }
};

const validateClientId = (client_id) => {
  if (
    typeof client_id !== "string" ||
    !client_id.trim() ||
    client_id.length > 200
  ) {
    throw createError(400, "Invalid client_id");
  }

  return client_id.trim();
};

const parseAadhaarDob = (dob) => {
  if (typeof dob !== "string") {
    throw createError(422, "Invalid Aadhaar date of birth");
  }

  const value = dob.trim();

  let day;
  let month;
  let year;

  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)) {
    const parts = value.split(/[-/]/);

    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-");

    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else {
    throw createError(
      422,
      "Unsupported Aadhaar DOB format"
    );
  }

  if (year < 1900 || year > 9999) {
    throw createError(422, "Invalid Aadhaar date of birth");
  }

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createError(422, "Invalid Aadhaar date of birth");
  }

  const today = new Date();

  let age =
    today.getUTCFullYear() - date.getUTCFullYear();

  const monthDifference =
    today.getUTCMonth() - date.getUTCMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getUTCDate() < date.getUTCDate()
    )
  ) {
    age--;
  }

  if (age < 18) {
    throw createError(
      403,
      "You must be at least 18 years old to use MeetZo"
    );
  }

  return date;
};

const extractVerifiedDetails = (data) => {
  const aadhaarData = data?.data?.aadhaar_xml_data;

  if (
    !aadhaarData ||
    typeof aadhaarData.full_name !== "string" ||
    !aadhaarData.full_name.trim() ||
    typeof aadhaarData.dob !== "string" ||
    !aadhaarData.dob.trim()
  ) {
    throw createError(
      422,
      "Verified Aadhaar details are not available"
    );
  }

  return {
    fullName: aadhaarData.full_name.trim(),
    gender: aadhaarData.gender || null,
    dob: aadhaarData.dob.trim(),
    state: aadhaarData.address?.state || null,
  };
};

const confirmProviderVerification = (providerResult) => {
  if (
    !providerResult ||
    typeof providerResult !== "object" ||
    !providerResult.data
  ) {
    throw createError(
      502,
      "Invalid response received from IDSPay"
    );
  }

  // REQUIRED:
  // Verify the exact authoritative completion
  // field documented by IDSPay for fetchDetails.
  //
  // The current IDSPay response specification
  // has not been provided, so verification
  // must fail closed.
  //
  // Do not approve KYC using only:
  // - Browser callback status=success
  // - The presence of aadhaar_xml_data
  // - A generic HTTP 200 response

  throw createError(
    503,
    "IDSPay verification success validation is not configured"
  );
};

const getLatestVerification = async (
  userId,
  session = null
) => {
  let query = AadhaarVerification.findOne({
    userId,
  }).sort({
    createdAt: -1,
    _id: -1,
  });

  if (session) {
    query = query.session(session);
  }

  return query;
};

const getSessionRetryTime = (verification) => {
  const startedAt =
    verification?.initiatedAt ||
    verification?.createdAt;

  if (!startedAt) {
    return null;
  }

  return new Date(
    new Date(startedAt).getTime() +
      SESSION_RETRY_MINUTES * 60 * 1000
  );
};

const isActiveVerification = (verification) => {
  if (
    !verification ||
    !["INITIATED", "PENDING"].includes(
      verification.status
    )
  ) {
    return false;
  }

  const retryTime =
    getSessionRetryTime(verification);

  return Boolean(
    retryTime &&
    retryTime.getTime() > Date.now()
  );
};

const getVerifiedResponse = (
  verification,
  profile
) => {
  return {
    verificationId: verification._id,
    status: "VERIFIED",
    verified: true,
    verifiedAt:
      verification.verifiedAt ||
      profile.kycVerifiedAt,

    dateOfBirth: profile.dateOfBirth,
    kycDocumentType: profile.kycDocumentType,
    kycStatus: profile.kycStatus,
    isKycVerified: profile.isKycVerified,
    kycVerifiedAt: profile.kycVerifiedAt,
  };
};

// ==========================================
// 1. GENERATE DIGILOCKER TOKEN
// ==========================================

export const generateAadhaarTokenService = async ({
  userId,
  aadhaar_number,
}) => {
  validateUserId(userId);

  if (
    typeof aadhaar_number !== "string" ||
    !/^\d{12}$/.test(aadhaar_number)
  ) {
    throw createError(
      400,
      "A valid 12-digit Aadhaar number is required"
    );
  }

  const [user, profile] = await Promise.all([
    User.findById(userId)
      .select("_id isBlocked")
      .lean(),

    Profile.findOne({ userId })
      .select("_id kycStatus isKycVerified")
      .lean(),
  ]);

  if (!user) {
    throw createError(404, "User not found");
  }

  if (user.isBlocked) {
    throw createError(
      403,
      "Your account has been blocked"
    );
  }

  if (!profile) {
    throw createError(
      404,
      "Profile not found"
    );
  }

  if (
    profile.isKycVerified === true ||
    profile.kycStatus === "VERIFIED"
  ) {
    throw createError(
      409,
      "Your KYC is already verified"
    );
  }

  const latestVerification =
    await getLatestVerification(userId);

  if (latestVerification?.verified === true) {
    throw createError(
      409,
      "Your Aadhaar verification is already completed"
    );
  }

  if (isActiveVerification(latestVerification)) {
    throw createError(
      409,
      "A DigiLocker verification session is already active"
    );
  }

  // User consent must be collected by the
  // app before sending Aadhaar to IDSPay.

  const providerResult =
    await generateDigilockerTokenService(
      aadhaar_number
    );

  const responseData = providerResult?.data;

  if (
    typeof responseData?.client_id !== "string" ||
    !responseData.client_id.trim()
  ) {
    throw createError(
      502,
      "Unable to create DigiLocker verification session"
    );
  }

  const clientId = responseData.client_id.trim();
  const submittedAt = new Date();

  const maskedAadhaar =
    `XXXX-XXXX-${aadhaar_number.slice(-4)}`;

  const session = await mongoose.startSession();

  let verification;
  let updatedProfile;

  try {
    await session.withTransaction(async () => {
      const currentLatest =
        await getLatestVerification(userId, session);

      if (currentLatest?.verified === true) {
        throw createError(
          409,
          "Your KYC is already verified"
        );
      }

      if (isActiveVerification(currentLatest)) {
        throw createError(
          409,
          "A DigiLocker verification session is already active"
        );
      }

      if (
        currentLatest &&
        ["INITIATED", "PENDING"].includes(
          currentLatest.status
        )
      ) {
        await AadhaarVerification.updateOne(
          {
            _id: currentLatest._id,
            status: {
              $in: ["INITIATED", "PENDING"],
            },
          },
          {
            $set: {
              status: "EXPIRED",
              verified: false,
            },
          },
          { session }
        );
      }

      const created =
        await AadhaarVerification.create(
          [
            {
              userId,
              maskedAadhaar,
              verificationId: clientId,
              apiProvider: "IDSPay",
              verificationMethod: "DIGILOCKER",
              status: "PENDING",
              verified: false,
              initiatedAt: submittedAt,
              verifiedAt: null,
            },
          ],
          { session }
        );

      verification = created[0];

      updatedProfile =
        await Profile.findOneAndUpdate(
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
            session,
          }
        );

      if (!updatedProfile) {
        throw createError(
          409,
          "Profile KYC could not be updated"
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    verificationId: verification._id,
    client_id: clientId,
    status: "PENDING",
    verified: false,

    kycDocumentType:
      updatedProfile.kycDocumentType,

    kycStatus:
      updatedProfile.kycStatus,

    isKycVerified:
      updatedProfile.isKycVerified,

    // Preserve your original IDSPay response
    // shape for existing Flutter integration.
    // Confirm that the provider payload contains
    // only frontend-safe launch information.
    digilocker: responseData,
  };
};

// ==========================================
// 2. FETCH DIGILOCKER DETAILS
// ==========================================

export const fetchAadhaarDetailsService = async ({
  userId,
  client_id,
}) => {
  validateUserId(userId);

  const clientId =
    validateClientId(client_id);

  const verification =
    await AadhaarVerification.findOne({
      userId,
      verificationId: clientId,
    });

  if (!verification) {
    throw createError(
      404,
      "Verification session not found"
    );
  }

  const latestVerification =
    await getLatestVerification(userId);

  if (
    !latestVerification ||
    String(latestVerification._id) !==
      String(verification._id)
  ) {
    throw createError(
      409,
      "This verification session is no longer active"
    );
  }

  if (verification.verified === true) {
    const profile = await Profile.findOne({
      userId,
    })
      .select(
        "dateOfBirth kycStatus isKycVerified kycDocumentType kycVerifiedAt"
      )
      .lean();

    if (
      profile?.kycStatus === "VERIFIED" &&
      profile?.isKycVerified === true
    ) {
      return getVerifiedResponse(
        verification,
        profile
      );
    }

    throw createError(
      409,
      "KYC records require reconciliation"
    );
  }

  if (
    ["REJECTED", "FAILED", "EXPIRED"].includes(
      verification.status
    )
  ) {
    throw createError(
      409,
      "Verification session is no longer active"
    );
  }

  const providerResult =
    await fetchDigilockerDetailsService(
      clientId
    );

  confirmProviderVerification(providerResult);

  const verifiedDetails =
    extractVerifiedDetails(providerResult);

  const aadhaarDob =
    parseAadhaarDob(verifiedDetails.dob);

  const verifiedAt = new Date();

  const session = await mongoose.startSession();

  let updatedVerification;
  let updatedProfile;

  try {
    await session.withTransaction(async () => {
      const currentLatest =
        await getLatestVerification(userId, session);

      if (
        !currentLatest ||
        String(currentLatest._id) !==
          String(verification._id)
      ) {
        throw createError(
          409,
          "This verification session is no longer active"
        );
      }

      if (currentLatest.verified === true) {
        const existingProfile =
          await Profile.findOne({ userId })
            .session(session);

        if (
          existingProfile?.kycStatus === "VERIFIED" &&
          existingProfile?.isKycVerified === true
        ) {
          updatedVerification = currentLatest;
          updatedProfile = existingProfile;
          return;
        }

        throw createError(
          409,
          "KYC records require reconciliation"
        );
      }

      if (
        !["INITIATED", "PENDING"].includes(
          currentLatest.status
        )
      ) {
        throw createError(
          409,
          "Verification session is no longer active"
        );
      }

      updatedVerification =
        await AadhaarVerification.findOneAndUpdate(
          {
            _id: verification._id,
            userId,
            verified: { $ne: true },
            status: {
              $in: ["INITIATED", "PENDING"],
            },
          },
          {
            $set: {
              fullName: verifiedDetails.fullName,
              gender: verifiedDetails.gender,
              dob: verifiedDetails.dob,
              state: verifiedDetails.state,

              status: "VERIFIED",
              verified: true,
              verifiedAt,
              lastCheckedAt: verifiedAt,
              failureReason: null,
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!updatedVerification) {
        throw createError(
          409,
          "Verification session could not be updated"
        );
      }

      updatedProfile =
        await Profile.findOneAndUpdate(
          {
            userId,
            isKycVerified: { $ne: true },
            kycStatus: { $ne: "VERIFIED" },
          },
          {
            $set: {
              dateOfBirth: aadhaarDob,

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
            session,
          }
        );

      if (!updatedProfile) {
        throw createError(
          409,
          "Profile KYC could not be updated"
        );
      }

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

      if (
        Object.keys(userKycFields).length > 0
      ) {
        const updatedUser =
          await User.findByIdAndUpdate(
            userId,
            { $set: userKycFields },
            {
              new: true,
              runValidators: true,
              session,
            }
          );

        if (!updatedUser) {
          throw createError(
            404,
            "User not found"
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return getVerifiedResponse(
    updatedVerification,
    updatedProfile
  );
};

// ==========================================
// 3. DIGILOCKER CALLBACK PROCESSING
// ==========================================

export const processDigilockerCallbackService = async ({
  client_id,
  status,
}) => {
  const clientId =
    validateClientId(client_id);

  const verification =
    await AadhaarVerification.findOne({
      verificationId: clientId,
    });

  if (!verification) {
    throw createError(
      404,
      "Verification session not found"
    );
  }

  await AadhaarVerification.updateOne(
    { _id: verification._id },
    {
      $set: {
        callbackReceivedAt: new Date(),
      },
    }
  );

  if (status !== "success") {
    return {
      verificationId: verification._id,
      status: verification.status,
      verified: verification.verified === true,
      message: "Verification not confirmed",
    };
  }

  return fetchAadhaarDetailsService({
    userId: verification.userId,
    client_id: clientId,
  });
};
