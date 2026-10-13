import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.MESSAGE_ENC_KEY, "base64");
const KEY_VERSION = "v1";

if (KEY.length !== 32) throw new Error("MESSAGE_ENC_KEY must be 32 bytes (base64)");

export const encrypt = (plainText) => {
  if (plainText == null) return plainText;
  const iv = crypto.randomBytes(12);                     // new IV for every message
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();                   // detects tampering
  return [KEY_VERSION, iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
};

export const decrypt = (payload) => {
  if (!payload || !payload.startsWith(`${KEY_VERSION}:`)) return payload; // old plaintext messages pass through
  const [, ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
};