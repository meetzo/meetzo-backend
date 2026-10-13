import {config as dotenvConfig} from 'dotenv';


dotenvConfig();

const _config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'secret',
  MONGO_URI: process.env.MONGO_URI ,
  OTP_TOKEN_SECRET: process.env.OTP_TOKEN_SECRET || 'otp_secret',
  EMAIL_USER: process.env.EMAIL_USER ,
  APP_PASSWORD: process.env.APP_PASSWORD,
  ids_base_url: process.env.IDSPAY_BASE_URL,
  ids_api_id: process.env.IDSPAY_API_ID,
  ids_api_key: process.env.IDSPAY_API_KEY,
  ids_token_id: process.env.IDSPAY_TOKEN_ID,


};




export default _config;