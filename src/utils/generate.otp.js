import { randomInt } from "node:crypto";

export const generateOtp = () => randomInt(1000, 10000).toString();