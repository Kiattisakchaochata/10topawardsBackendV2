
import prisma from "../config/prisma.config.js";

export const deactivateExpiredStores = async () => {
  try {
    const now = new Date();
    const updated = await prisma.store.updateMany({
      where: {
        expired_at: {
          lte: now,
        },
        is_active: true,
      },
      data: {
        is_active: false,
      },
    });

    console.log(`🕐 ปิดร้านที่หมดอายุแล้ว ${updated.count} ร้าน`);
  } catch (err) {
    console.error("❌ Cron error:", err);
  }
};