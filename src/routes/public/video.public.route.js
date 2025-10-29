// src/routes/public/video.public.routes.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/** แปลงค่า truthy จาก query เช่น 1, '1', true, 'true' */
function asBool(v) {
  if (v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * GET /api/videos
 * query:
 *  - store_id หรือ store   : รหัสร้าน (บังคับถ้าต้องการวิดีโอเฉพาะร้าน)
 *  - active=1              : เอาเฉพาะที่ is_active และอยู่ในช่วงวันแสดงผล
 *  - take, skip            : paging
 */
router.get("/", async (req, res) => {
  try {
    const take = Math.min(Number(req.query.take ?? 100), 500);
    const skip = Number(req.query.skip ?? 0);
    const storeId =
      (req.query.store_id ?? req.query.store ?? "").toString().trim() || null;
    const activeOnly = asBool(req.query.active);

    // เงื่อนไขพื้นฐาน
    const where = {};
    if (storeId) where.store_id = storeId;

    if (activeOnly) {
      const now = new Date();
      where.is_active = true;
      // อยู่ในช่วงเวลา หรือไม่กำหนดวัน ก็ให้ผ่าน
      where.AND = [
        { OR: [{ start_date: null }, { start_date: { lte: now } }] },
        { OR: [{ end_date: null }, { end_date: { gte: now } }] },
      ];
    }

    // ลอง log ช่วยดีบัก (comment ออกได้)
    // console.log("PUBLIC /api/videos where =", JSON.stringify(where));

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: [{ order_number: "asc" }, { created_at: "desc" }],
        take: Number.isNaN(take) ? 100 : take,
        skip: Number.isNaN(skip) ? 0 : skip,
        select: {
          id: true,
          title: true,
          youtube_url: true,
          tiktok_url: true,
          thumbnail_url: true,
          order_number: true,
          is_active: true,
          start_date: true,
          end_date: true,
          store_id: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.video.count({ where }),
    ]);

    res.json({ videos, total, take, skip });
  } catch (e) {
    console.error("GET /api/videos error:", e);
    res.status(500).json({ message: "internal error" });
  }
});

/**
 * (สะดวกเรียกแบบ path) GET /api/videos/by-store/:storeId
 * รองรับ ?active=1 เหมือนกัน
 */
router.get("/by-store/:storeId", async (req, res) => {
  try {
    const activeOnly = asBool(req.query.active);
    const storeId = req.params.storeId;
    const now = new Date();

    const where = { store_id: storeId };
    if (activeOnly) {
  const now = new Date();
  where.is_active = true;
  where.AND = [
    { OR: [{ start_date: null }, { start_date: { lte: now } }] },
    { OR: [{ end_date: null }, { end_date: { gte: now } }] },
  ];
}

    const videos = await prisma.video.findMany({
      where,
      orderBy: [{ order_number: "asc" }, { created_at: "desc" }],
    });

    res.json({ videos });
  } catch (e) {
    console.error("GET /api/videos/by-store error:", e);
    res.status(500).json({ message: "internal error" });
  }
});

export default router;