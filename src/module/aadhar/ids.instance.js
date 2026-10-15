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

const getEndpoint = () => {
  if (!config.ids_base_url) {
    throw new Error("IDSPay base URL is not configured");
  }

  return `${config.ids_base_url.replace(/\/+$/, "")}/srv2/validation/digilocker-digital-kyc`;
};

const safeStatusValue = (value) => {
  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.length <= 40 ? value : "[REDACTED]";
  }

  return undefined;
};

const getSafeStatusObject = (value) => {
  if (!value || typeof value !== "object") {
    return {
      type: typeof value,
      value: safeStatusValue(value),
    };
  }

  return {
    type: Array.isArray(value) ? "array" : "object",
    keys: Object.keys(value),
    code: safeStatusValue(value.code),
    status: safeStatusValue(value.status),
    success: safeStatusValue(value.success),
    status_code: safeStatusValue(value.status_code),
    message_code: safeStatusValue(value.message_code),
    verified: safeStatusValue(value.verified),
  };
};

const logResponseStatus = (methodName, response) => {
  const result = response.data;

  console.log(`[IDSPay] ${methodName} RESPONSE DEBUG:`, {
    httpStatus: response.status,

    responseKeys: Object.keys(result || {}),
    dataKeys: Object.keys(result?.data || {}),

    success: safeStatusValue(result?.success),

    status: getSafeStatusObject(result?.status),

    statusCode: safeStatusValue(result?.status_code),
    messageCode: safeStatusValue(result?.message_code),

    dataStatus: getSafeStatusObject(result?.data?.status),

    dataSuccess: safeStatusValue(result?.data?.success),

    verificationStatus: safeStatusValue(result?.data?.verification_status),

    metadataKeys:
      result?.data?.digilocker_metadata &&
      typeof result.data.digilocker_metadata === "object"
        ? Object.keys(result.data.digilocker_metadata)
        : [],

    hasClientId: Boolean(result?.data?.client_id),

    hasLaunchUrl: Boolean(result?.data?.url),

    hasAadhaarXml: Boolean(result?.data?.aadhaar_xml_data),
  });
};

const logProviderError = (methodName, error) => {
  const result = error.response?.data;

  console.error(`[IDSPay] ${methodName} ERROR:`, {
    httpStatus: error.response?.status,
    errorCode: error.code,

    responseKeys: Object.keys(result || {}),

    success: safeStatusValue(result?.success),

    status: getSafeStatusObject(result?.status),

    statusCode: safeStatusValue(result?.status_code),

    messageCode: safeStatusValue(result?.message_code),
  });
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

    console.log("[IDSPay] Generating token");

    const response = await axios.post(getEndpoint(), payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    logResponseStatus("GENERATE TOKEN", response);

    return response.data;
  } catch (error) {
    logProviderError("GENERATE TOKEN", error);
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

    console.log("[IDSPay] Fetching verification details");

    const response = await axios.post(getEndpoint(), payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    logResponseStatus("FETCH DETAILS", response);

    return response.data;
  } catch (error) {
    logProviderError("FETCH DETAILS", error);
    throw error;
  }
};
