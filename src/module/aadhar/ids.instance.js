// import config from "../../config/config.js";

// import axios from "axios";

// export const generateDigilockerTokenService = async (aadhaar_number) => {
//   try {
//     const payload = {
//       api_id:config.ids_api_id,

//       api_key: config.ids_api_key,

//       token_id: config.ids_token_id,

//       methodName: "generateToken",

//       aadhaar_number,

//       redirectUrl: "https://backend.meetzo.in/api/kyc/digilocker-callback",

//       logoUrl: "https://via.placeholder.com/200x200.png",
//     };

//     console.log("PAYLOAD:", payload);

//     const response = await axios.post(
//       `${config.ids_base_url}/srv2/validation/digilocker-digital-kyc`,
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     return response.data;
//   } catch (error) {
//     console.log("IDSPAY ERROR:", error.response?.data || error.message);

//     throw error;
//   }
// };

// export const fetchDigilockerDetailsService =
//   async (client_id) => {

//     try {

//       const payload = {

//         api_id: config.ids_api_id,

//         api_key: config.ids_api_key,

//         token_id: config.ids_token_id,

//         methodName: "fetchDetails",

//         client_id,
//       };

//       console.log(
//         "FETCH DETAILS PAYLOAD:",
//         payload
//       );

//       const response = await axios.post(
//         `${config.ids_base_url}/srv2/validation/digilocker-digital-kyc`,
//         payload,
//         {
//           headers: {
//             "Content-Type":
//               "application/json",
//           },
//         }
//       );

//       return response.data;

//     } catch (error) {

//       console.log(
//         "FETCH DETAILS ERROR:",
//         error.response?.data ||
//         error.message
//       );

//       throw error;
//     }
//   };

import config from "../../config/config.js";
import axios from "axios";

const IDSPAY_ENDPOINT = `${config.ids_base_url}/srv2/validation/digilocker-digital-kyc`;

const getStatusDiagnostics = (result) => {
  const safeValue = (value) =>
    typeof value === "boolean" ||
    typeof value === "number" ||
    (typeof value === "string" && value.length <= 32)
      ? value
      : undefined;

  return {
    responseKeys: Object.keys(result || {}),
    dataKeys: Object.keys(result?.data || {}),

    success: safeValue(result?.success),
    status: safeValue(result?.status),

    dataSuccess: safeValue(result?.data?.success),
    dataStatus: safeValue(result?.data?.status),

    verificationStatus: safeValue(result?.data?.verification_status),

    hasClientId: Boolean(result?.data?.client_id),

    hasAadhaarXml: Boolean(result?.data?.aadhaar_xml_data),
  };
};

export const generateDigilockerTokenService = async (aadhaar_number) => {
  try {
    const payload = {
      api_id: config.ids_api_id,
      api_key: config.ids_api_key,
      token_id: config.ids_token_id,

      methodName: "generateToken",
      aadhaar_number,

      redirectUrl: "https://backend.meetzo.in/api/kyc/digilocker-callback",

      logoUrl: "https://via.placeholder.com/200x200.png",
    };

    console.log("[IDSPay] Generating DigiLocker token");

    console.log("[IDSPay] Configuration:", {
      baseUrlConfigured: Boolean(config.ids_base_url),
      apiIdConfigured: Boolean(config.ids_api_id),
      apiKeyConfigured: Boolean(config.ids_api_key),
      tokenIdConfigured: Boolean(config.ids_token_id),
    });

    const response = await axios.post(IDSPAY_ENDPOINT, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log("[IDSPay] Generate token response:", {
      httpStatus: response.status,
      ...getStatusDiagnostics(response.data),
    });

    return response.data;
  } catch (error) {
    console.error("[IDSPay] Generate token failed:", {
      httpStatus: error.response?.status,
      errorCode: error.code,
      message: error.message,
    });

    throw error;
  }
};

export const fetchDigilockerDetailsService = async (client_id) => {
  try {
    const payload = {
      api_id: config.ids_api_id,
      api_key: config.ids_api_key,
      token_id: config.ids_token_id,

      methodName: "fetchDetails",
      client_id,
    };

    console.log("[IDSPay] Fetching DigiLocker details");

    const response = await axios.post(IDSPAY_ENDPOINT, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log("[IDSPay] FETCH DETAILS DEBUG:", {
      httpStatus: response.status,
      ...getStatusDiagnostics(response.data),
    });

    return response.data;
  } catch (error) {
    console.error("[IDSPay] Fetch details failed:", {
      httpStatus: error.response?.status,
      errorCode: error.code,
      message: error.message,
    });

    throw error;
  }
};
