import { z } from 'zod';
import ApiError from '../../utils/api.error.js';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: z.string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Phone number must contain 10 to 15 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const signupOtpSchema = z.object({
  otp: z.union([z.string(), z.number()])
    .transform(String)
    .refine((otp) => /^\d{4}$/.test(otp), 'Please enter a valid 4-digit OTP'),
});

export const validateAuthBody = (schema, body) => {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message || 'Invalid request body');
  }

  return result.data;
};