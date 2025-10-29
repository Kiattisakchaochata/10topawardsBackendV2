// src/controllers/search.controller.js
import prisma from "../config/prisma.config.js";

/**
 * GET /api/search?q=คำค้น&limit=20
 * คืน { q, categories, stores }
 */
export const searchAll = async (req, res, next) => {
  try {
    const qRaw = String(req.query.q ?? "").trim();
    const take = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);

    // ถ้าไม่มีคำค้น คืนว่าง ๆ ไปก่อน
    if (!qRaw) {
      return res.json({ q: "", categories: [], stores: [] });
    }

    // ตัดเป็นคำ ๆ (เว้นวรรคหลายตัว / เว้นวรรคไทยก็จับได้)
    const tokens = qRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // MySQL ส่วนใหญ่ case-insensitive อยู่แล้ว => ไม่ใส่ mode: 'insensitive'
    const catWhere = {
      OR: tokens.map((t) => ({ name: { contains: t } })),
    };

    // หา category ที่ตรงก่อน เพื่อเอา id ไปช่วยค้นหาร้านตามหมวด
    const categories = await prisma.category.findMany({
      where: catWhere,
      orderBy: { name: "asc" },
      take,
      select: { id: true, name: true },
    });
    const catIds = categories.map((c) => c.id);

    // เงื่อนไขร้าน: ช่วยค้นหลายฟิลด์ + ถ้าหมวดตรง ให้ดึงร้านในหมวดนั้นด้วย
    const stores = await prisma.store.findMany({
      where: {
        AND: [
          { is_active: true },
          {
            OR: [
              // name / description / address ตรงคำใดคำหนึ่งก็ถือว่าเจอ
              ...tokens.map((t) => ({ name: { contains: t } })),
              ...tokens.map((t) => ({ description: { contains: t } })),
              ...tokens.map((t) => ({ address: { contains: t } })),
              // ถ้ามีหมวดที่ตรงคำค้น ให้ดึงร้านในหมวดนั้น ๆ มาด้วย
              ...(catIds.length > 0 ? [{ category_id: { in: catIds } }] : []),
            ],
          },
        ],
      },
      orderBy: { updated_at: "desc" },
      take,
      select: {
        id: true,
        name: true,
        description: true,
        cover_image: true,
      },
    });

    res.json({ q: qRaw, categories, stores });
  } catch (err) {
    next(err);
  }
};