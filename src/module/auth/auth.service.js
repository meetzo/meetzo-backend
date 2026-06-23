import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { generateToken } from "../../utils/generate.token.js";
import ApiError from "../../utils/api.error.js";

// Helper function for safe user response
const sanitizeUser = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
};

// Signup service
export const signupService = async ({ name, email, phone, password }) => {
  if (!name || !email || !phone || !password) {
    throw new ApiError(400, "Name, email, phone and password are required");
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  const trimmedName = name.trim();

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    },
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this email or phone");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: trimmedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isVerified: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  const token = generateToken(user.id);

  return {
    token,
    user,
  };
};

// Login service
export const loginService = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = generateToken(user.id);

  return {
    token,
    user: sanitizeUser(user),
  };
};



export const getUserByIdService = async (userId) => {
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isVerified: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};