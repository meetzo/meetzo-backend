import {
  generateAadhaarTokenService,
  fetchAadhaarDetailsService,
  processDigilockerCallbackService,
} from "./ids.service.js";

// ==========================================
// 1. GENERATE DIGILOCKER TOKEN
// ==========================================

export const generateDigilockerToken = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { aadhaar_number } = req.body || {};

    const result = await generateAadhaarTokenService({
      userId,
      aadhaar_number,
    });

    return res.status(200).json({
      success: true,
      message: "Digilocker token generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. FETCH DIGILOCKER DETAILS
// ==========================================

export const fetchDigilockerDetails = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { client_id } = req.body || {};

    const result = await fetchAadhaarDetailsService({
      userId,
      client_id,
    });

    return res.status(200).json({
      success: true,
      message: "Digilocker verification details fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. DIGILOCKER CALLBACK
// ==========================================

export const digilockerCallback = async (req, res, next) => {
  try {
    const { client_id, status } = req.query;

    // The callback route must authenticate the
    // provider request before this service is called.
    const result = await processDigilockerCallbackService({
      client_id,
      status,
    });

    return res.status(200).json({
      success: true,
      message: "Digilocker callback processed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
