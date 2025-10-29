import { PrismaClient } from "@prisma/client";

// ใช้ global variable เพื่อป้องกันการสร้าง instance PrismaClient ซ้ำในโหมด dev
let prisma;
if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}
prisma = global.__prisma;

export { prisma };