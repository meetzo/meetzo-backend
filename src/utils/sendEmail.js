// utils/sendEmail.js (using nodemailer, for example)
import nodemailer from "nodemailer";
import config from "../config/config.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: config.EMAIL_USER, pass: config.APP_PASSWORD },
});

export const sendOtpEmail = async (email, otp) => {
  await transporter.sendMail({
    from: config.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
  });
};