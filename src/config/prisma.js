import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  log: ["error", "warn"],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Prisma connected successfully");
  } catch (error) {
    console.error("Prisma connection failed:", error.message);
    process.exit(1);
  }
};

export { prisma };
export default connectDB;