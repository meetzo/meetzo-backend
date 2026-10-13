import config from "../../config/config.js";

import axios from "axios";


export const generateDigilockerTokenService = async (aadhaar_number) => {
  try {
    const payload = {
      api_id:config.ids_api_id,

      api_key: config.ids_api_key,

      token_id: config.ids_token_id,

      methodName: "generateToken",

      aadhaar_number,

      redirectUrl: "https://backend.meetzo.in/api/kyc/digilocker-callback",

      logoUrl: "https://via.placeholder.com/200x200.png",
    };

    console.log("PAYLOAD:", payload);

    const response = await axios.post(
      `${config.ids_base_url}/srv2/validation/digilocker-digital-kyc`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    console.log("IDSPAY ERROR:", error.response?.data || error.message);

    throw error;
  }
};

export const fetchDigilockerDetailsService =
  async (client_id) => {

    try {

      const payload = {

        api_id: config.ids_api_id,

        api_key: config.ids_api_key,

        token_id: config.ids_token_id,

        methodName: "fetchDetails",

        client_id,
      };

      console.log(
        "FETCH DETAILS PAYLOAD:",
        payload
      );

      const response = await axios.post(
        `${config.ids_base_url}/srv2/validation/digilocker-digital-kyc`,
        payload,
        {
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      return response.data;

    } catch (error) {

      console.log(
        "FETCH DETAILS ERROR:",
        error.response?.data ||
        error.message
      );

      throw error;
    }
  };
