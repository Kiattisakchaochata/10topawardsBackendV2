// src/controllers/storeFeedback.controller.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ---------------- helpers ---------------- */
const toSlugOrId = (v) => String(v || '').trim();

async function findStoreBySlugOrId(slugOrId) {
  return prisma.store.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    select: { id: true, name: true, slug: true },
  });
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function ensureDefaultQuestions(storeId) {
  // ต้องมี @@unique([store_id, key]) ใน schema (คุณมีแล้ว)
  // และต้องมี @@unique([store_id, order_no]) (คุณมีแล้ว)
  const defaults = [
    { key: 'food', label: 'รสชาติอาหาร', type: 'STAR_1_5', required: true, order_no: 1 },
    { key: 'service', label: 'การบริการ', type: 'STAR_1_5', required: true, order_no: 2 },
  ];

  await Promise.all(
    defaults.map((q) =>
      prisma.storeFeedbackQuestion.upsert({
        where: { store_id_key: { store_id: storeId, key: q.key } },
        update: {
          label: q.label,
          type: q.type,
          required: q.required,
          order_no: q.order_no,
          is_active: true,
        },
        create: {
          store_id: storeId,
          key: q.key,
          label: q.label,
          type: q.type,
          required: q.required,
          order_no: q.order_no,
          is_active: true,
        },
      })
    )
  );
}

function validateByType(type, valueNumber, valueText) {
  if (type === 'TEXT') {
    const t = (valueText || '').trim();
    if (!t) return { ok: false, message: 'คำตอบแบบข้อความต้องไม่ว่าง' };
    return { ok: true };
  }

  if (typeof valueNumber !== 'number' || !Number.isFinite(valueNumber)) {
    return { ok: false, message: 'คำตอบต้องเป็นตัวเลข' };
  }

  if (type === 'STAR_1_5') {
    if (valueNumber < 1 || valueNumber > 5) return { ok: false, message: 'คะแนนต้องอยู่ระหว่าง 1 ถึง 5' };
    return { ok: true };
  }

  if (type === 'NUMBER_0_10') {
    if (valueNumber < 0 || valueNumber > 10) return { ok: false, message: 'คะแนนต้องอยู่ระหว่าง 0 ถึง 10' };
    return { ok: true };
  }

  return { ok: false, message: 'ชนิดคำถามไม่รองรับ' };
}

/* ---------------- PUBLIC ---------------- */
/**
 * POST /api/public/stores/:slug/feedback
 * รองรับ 2 แบบ:
 * 1) แบบใหม่: { comment?, answers: [{ key, value_number?, value_text? }] }
 * 2) แบบเก่า: { food_rating, service_rating, comment? } => map เป็น answers key=food/service
 */
export const createStoreFeedback = async (req, res) => {
  try {
    const slugOrId = toSlugOrId(req.params.slug);
    const body = req.body || {};

    const store = await findStoreBySlugOrId(slugOrId);
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    // โหลดคำถาม (active) ของร้าน
    let questions = await prisma.storeFeedbackQuestion.findMany({
      where: { store_id: store.id, is_active: true },
      orderBy: { order_no: 'asc' },
      select: { id: true, key: true, label: true, type: true, required: true, order_no: true },
    });

    // รับ answers แบบใหม่ หรือ map จาก legacy
    let answersInput = Array.isArray(body.answers) ? body.answers : null;

    if (!answersInput) {
      // legacy compatibility
      const food = body.food_rating;
      const service = body.service_rating;
      if (food != null || service != null) {
        answersInput = [];
        if (food != null) answersInput.push({ key: 'food', value_number: food });
        if (service != null) answersInput.push({ key: 'service', value_number: service });
      }
    }

    if (!answersInput || answersInput.length === 0) {
      return res.status(400).json({
        message: 'กรุณาส่ง answers (หรือ food_rating/service_rating แบบเดิม)',
      });
    }
    // ✅ กัน key ซ้ำใน request (กันชน unique ตอนบันทึก answers)
    const keySeen = new Set();
    for (const a of answersInput) {
      const k = String(a?.key || '').trim();
      if (!k) continue;
      if (keySeen.has(k)) {
        return res.status(400).json({ message: `ส่งคำตอบซ้ำสำหรับ key="${k}"` });
      }
      keySeen.add(k);
    }

    // ถ้าร้านยังไม่มีคำถามเลย และส่ง food/service มา -> สร้าง default questions ให้
    if (!questions.length) {
      const hasLegacyKeys = answersInput.some((a) => a?.key === 'food' || a?.key === 'service');
      if (hasLegacyKeys) {
        await ensureDefaultQuestions(store.id);
        questions = await prisma.storeFeedbackQuestion.findMany({
          where: { store_id: store.id, is_active: true },
          orderBy: { order_no: 'asc' },
          select: { id: true, key: true, label: true, type: true, required: true, order_no: true },
        });
      }
    }

    const qMap = new Map(questions.map((q) => [q.key, q]));

    // normalize + validate
    const normalized = [];
    for (const a of answersInput) {
      const key = String(a?.key || '').trim();
      if (!key) return res.status(400).json({ message: 'answers[].key ห้ามว่าง' });

      const q = qMap.get(key);
      if (!q) {
        return res.status(400).json({
          message: `ไม่พบคำถาม key="${key}" ของร้านนี้ (admin ต้องสร้างคำถามก่อน)`,
          key,
        });
      }

      const valueNumber = a?.value_number != null ? toNumberOrNull(a.value_number) : null;
      const valueText = a?.value_text != null ? String(a.value_text) : null;

      const check = validateByType(q.type, valueNumber, valueText);
      if (!check.ok) {
        return res.status(400).json({
          message: `คำตอบไม่ถูกต้อง (${q.label}): ${check.message}`,
          key,
        });
      }

      normalized.push({
        question_id: q.id,
        value_number: q.type === 'TEXT' ? null : valueNumber,
        value_text: q.type === 'TEXT' ? (valueText || '').trim() : null,
      });
    }

    // required check
    const answered = new Set(normalized.map((x) => x.question_id));
    const missing = questions.filter((q) => q.required && !answered.has(q.id));
    if (missing.length) {
      return res.status(400).json({
        message: `กรุณาตอบคำถามให้ครบ: ${missing.map((m) => m.label).join(', ')}`,
      });
    }

    // user optional
    const userId = req.user?.id || null;

    // create feedback + answers
    const feedback = await prisma.storeFeedback.create({
      data: {
        store_id: store.id,
        user_id: userId,
        comment: body.comment || null,
        source: 'QR',
        answers: { create: normalized },
      },
      include: {
        answers: {
          include: { question: { select: { key: true, label: true, type: true } } },
        },
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
 * ✅ GET /api/public/stores/:slug/feedback/questions
 * ดึง “คำถามของร้าน” เพื่อให้หน้า QR/render ฟอร์มได้
 */
export const listStoreFeedbackQuestionsPublic = async (req, res) => {
  try {
    const slugOrId = toSlugOrId(req.params.slug);

    const store = await findStoreBySlugOrId(slugOrId);
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    const questions = await prisma.storeFeedbackQuestion.findMany({
      where: { store_id: store.id, is_active: true },
      orderBy: { order_no: 'asc' },
      select: {
        id: true,
        key: true,
        label: true,
        type: true,
        required: true,
        order_no: true,
      },
    });

    return res.json({ store, data: questions });
  } catch (err) {
    console.error('listStoreFeedbackQuestionsPublic error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * GET /api/public/stores/:slug/feedback
 * list feedback ของร้าน (public)
 */
export const listStoreFeedbackPublic = async (req, res) => {
  try {
    const slugOrId = toSlugOrId(req.params.slug);
    const takeRaw = Number(req.query.take || 20);
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 50) : 20;

    const store = await findStoreBySlugOrId(slugOrId);
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    const rows = await prisma.storeFeedback.findMany({
      where: { store_id: store.id },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        comment: true,
        source: true,
        created_at: true,
        answers: {
          select: {
            id: true,
            value_number: true,
            value_text: true,
            question: { select: { key: true, label: true, type: true, order_no: true } },
          },
          orderBy: { question: { order_no: 'asc' } },
        },
      },
    });

    return res.json({ store, data: rows });
  } catch (err) {
    console.error('listStoreFeedbackPublic error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * GET /api/public/stores/:slug/feedback/stats
 * summary stats ของร้าน (public) — แบบใหม่
 * - count: จำนวน feedback
 * - questions: avg/count ต่อคำถาม (เฉพาะ numeric)
 */
export const getStoreFeedbackStatsPublic = async (req, res) => {
  try {
    const slugOrId = toSlugOrId(req.params.slug);

    const store = await findStoreBySlugOrId(slugOrId);
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    const [count, questions] = await Promise.all([
      prisma.storeFeedback.count({ where: { store_id: store.id } }),
      prisma.storeFeedbackQuestion.findMany({
        where: { store_id: store.id, is_active: true },
        orderBy: { order_no: 'asc' },
        select: { id: true, key: true, label: true, type: true, order_no: true },
      }),
    ]);

    const numericIds = questions.filter((q) => q.type !== 'TEXT').map((q) => q.id);

    let grouped = [];
    if (numericIds.length) {
      grouped = await prisma.storeFeedbackAnswer.groupBy({
        by: ['question_id'],
        where: {
          question_id: { in: numericIds },
          value_number: { not: null },
        },
        _avg: { value_number: true },
        _count: { id: true },
      });
    }

    const gMap = new Map(grouped.map((g) => [g.question_id, g]));

    return res.json({
      store,
      count,
      questions: questions.map((q) => {
        const g = gMap.get(q.id);
        return {
          key: q.key,
          label: q.label,
          type: q.type,
          avg: g?._avg?.value_number != null ? Number(g._avg.value_number) : null,
          count: g?._count?.id || 0,
        };
      }),
    });
  } catch (err) {
    console.error('getStoreFeedbackStatsPublic error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/* ---------------- ADMIN ---------------- */
/**
 * GET /api/admin/stores/:id/feedback/stats
 * สถิติ feedback ของร้าน (admin dashboard) — แบบใหม่
 */
export const getStoreFeedbackStats = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    const [count, questions, recent] = await Promise.all([
      prisma.storeFeedback.count({ where: { store_id: store.id } }),
      prisma.storeFeedbackQuestion.findMany({
        where: { store_id: store.id, is_active: true },
        orderBy: { order_no: 'asc' },
        select: { id: true, key: true, label: true, type: true, order_no: true },
      }),
      prisma.storeFeedback.findMany({
        where: { store_id: store.id },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: {
          id: true,
          comment: true,
          source: true,
          created_at: true,
          user: { select: { id: true, name: true, email: true } },
          answers: {
            select: {
              id: true,
              value_number: true,
              value_text: true,
              question: { select: { key: true, label: true, type: true, order_no: true } },
            },
            orderBy: { question: { order_no: 'asc' } },
          },
        },
      }),
    ]);

    const numericIds = questions.filter((q) => q.type !== 'TEXT').map((q) => q.id);

    let grouped = [];
    if (numericIds.length) {
      grouped = await prisma.storeFeedbackAnswer.groupBy({
        by: ['question_id'],
        where: {
          question_id: { in: numericIds },
          value_number: { not: null },
        },
        _avg: { value_number: true },
        _count: { id: true },
      });
    }
    const gMap = new Map(grouped.map((g) => [g.question_id, g]));

    return res.json({
      store,
      total_feedback: count,
      questions: questions.map((q) => {
        const g = gMap.get(q.id);
        return {
          key: q.key,
          label: q.label,
          type: q.type,
          avg: g?._avg?.value_number != null ? Number(g._avg.value_number) : null,
          count: g?._count?.id || 0,
        };
      }),
      recent_feedbacks: recent,
    });
  } catch (err) {
    console.error('getStoreFeedbackStats error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * GET /api/admin/feedback/summary
 * สรุป feedback ของทุกร้าน (admin dashboard)
 * - avg_score: ค่าเฉลี่ยรวมของ numeric answers ต่อร้าน
 */
export const getAllStoreFeedbackSummary = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        s.id AS store_id,
        s.name AS store_name,
        CAST(COUNT(DISTINCT f.id) AS UNSIGNED) AS total_feedback,
CAST(AVG(a.value_number) AS DECIMAL(10,2)) AS avg_score
      FROM stores s
      JOIN store_feedbacks f ON f.store_id = s.id
      JOIN store_feedback_answers a ON a.feedback_id = f.id
      WHERE a.value_number IS NOT NULL
      GROUP BY s.id, s.name
      ORDER BY total_feedback DESC
      LIMIT 500
    `;

    return res.json(
      (rows || []).map((r) => ({
        store_id: r.store_id,
        store_name: r.store_name,
        total_feedback: Number(r.total_feedback || 0),
        avg_score: r.avg_score != null ? Number(r.avg_score) : 0,
      }))
    );
  } catch (err) {
    console.error('getAllStoreFeedbackSummary error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};