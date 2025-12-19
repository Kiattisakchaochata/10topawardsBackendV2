// src/controllers/storeFeedback.controller.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/public/stores/:slug/feedback
 * รับ feedback จาก QR (ไม่บังคับต้อง login)
 */
export const createStoreFeedback = async (req, res) => {
  try {
    const { slug } = req.params;
    const { food_rating, service_rating, comment } = req.body;

    if (!food_rating || !service_rating) {
      return res.status(400).json({
        message: 'กรุณาให้คะแนนรสชาติอาหารและการบริการ',
      });
    }

    const food = Number(food_rating);
    const service = Number(service_rating);

    if (
      Number.isNaN(food) ||
      Number.isNaN(service) ||
      food < 1 || food > 5 ||
      service < 1 || service > 5
    ) {
      return res.status(400).json({
        message: 'คะแนนต้องอยู่ระหว่าง 1 ถึง 5 ดาว',
      });
    }

    const slugOrId = String(req.params.slug);

const store = await prisma.store.findFirst({
  where: {
    OR: [
      { slug: slugOrId },
      { id: slugOrId },
    ],
  },
  select: { id: true, name: true, slug: true },
});

    if (!store) {
      return res.status(404).json({ message: 'ไม่พบร้านค้า' });
    }

    // ถ้าในอนาคตอยากใช้ user จาก token ก็เติม middleware แล้วดึง req.user.id ได้เลย
    let userId = null;
    if (req.user && req.user.id) {
      userId = req.user.id;
    }

    const feedback = await prisma.storeFeedback.create({
      data: {
        store_id: store.id,
        user_id: userId,
        food_rating: food,
        service_rating: service,
        comment: comment || null,
        source: 'QR',
      },
    });

    return res.status(201).json({
      message: 'ขอบคุณสำหรับการให้คะแนน',
      store,
      feedback,
    });
  } catch (err) {
    console.error('createStoreFeedback error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * GET /api/admin/stores/:id/feedback/stats
 * สถิติ feedback ของร้าน (admin dashboard)
 */
export const getStoreFeedbackStats = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!store) {
      return res.status(404).json({ message: 'ไม่พบร้านค้า' });
    }

    const [agg, recent] = await Promise.all([
      prisma.storeFeedback.aggregate({
        where: { store_id: store.id },
        _avg: {
          food_rating: true,
          service_rating: true,
        },
        _count: { id: true },
      }),
      prisma.storeFeedback.findMany({
        where: { store_id: store.id },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: {
          id: true,
          food_rating: true,
          service_rating: true,
          comment: true,
          source: true,
          created_at: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      store,
      total_feedback: agg._count.id || 0,
      avg_food_rating: agg._avg.food_rating || 0,
      avg_service_rating: agg._avg.service_rating || 0,
      recent_feedbacks: recent,
    });
  } catch (err) {
    console.error('getStoreFeedbackStats error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};
// ✨ NEW: สรุป feedback ของ "ทุกร้าน" สำหรับ Admin Dashboard
// GET /api/admin/feedback/summary
export const getAllStoreFeedbackSummary = async (req, res) => {
  try {
    // groupBy ตาม store_id
    const grouped = await prisma.storeFeedback.groupBy({
      by: ['store_id'],
      _avg: {
        food_rating: true,
        service_rating: true,
      },
      _count: {
        id: true,
      },
    });

    if (!grouped || grouped.length === 0) {
      return res.json([]);
    }

    // ดึงชื่อร้านจาก model Store ตาม store_id ที่ได้จาก groupBy
    const storeIds = grouped.map((g) => g.store_id);
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: {
        id: true,
        name: true,
      },
    });

    const storeMap = new Map(stores.map((s) => [s.id, s.name]));

    // map ให้อยู่ในรูปแบบที่ DashboardClient ใช้ (FeedbackRow)
    const rows = grouped.map((g) => ({
      store_id: g.store_id,
      store_name: storeMap.get(g.store_id) || '(ไม่พบชื่อร้าน)',
      avg_food: Number(g._avg.food_rating || 0),
      avg_service: Number(g._avg.service_rating || 0),
      total_feedback: g._count.id || 0,
    }));

    return res.json(rows);
  } catch (err) {
    console.error('getAllStoreFeedbackSummary error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};