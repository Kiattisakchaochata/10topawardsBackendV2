// src/controllers/storeFeedbackQuestion.controller.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ✅ GET /api/admin/stores/:id/feedback/questions
 * ดึงคำถามของร้านสำหรับ admin (รวม is_active เพื่อใช้เปิด/ปิดใน UI)
 */
export const listStoreFeedbackQuestionsAdmin = async (req, res) => {
  try {
    const { id: storeId } = req.params;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, slug: true },
    });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    const questions = await prisma.storeFeedbackQuestion.findMany({
      where: { store_id: store.id },
      orderBy: { order_no: 'asc' },
      select: {
        id: true,
        key: true,
        label: true,
        type: true,
        required: true,
        order_no: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.json({ store, data: questions });
  } catch (err) {
    console.error('listStoreFeedbackQuestionsAdmin error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ✅ POST /api/admin/stores/:id/feedback/questions
 * body: { title/label, type, required?, isActive?, order? }
 */
export const createStoreFeedbackQuestionAdmin = async (req, res) => {
  try {
    const { id: storeId } = req.params;
    const body = req.body || {};

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, slug: true },
    });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

    const label = String(body.title ?? body.label ?? '').trim();
    if (!label) {
      return res.status(400).json({ message: 'กรุณากรอกข้อความคำถาม (title/label)' });
    }

    // ✅ map type จาก UI -> backend (ถ้าคุณยังใช้ STAR/TEXT/YESNO/CHOICE)
    let type = String(body.type || '').trim();
    if (!type) return res.status(400).json({ message: 'กรุณาระบุ type' });

    if (type === 'STAR') type = 'STAR_1_5';
    if (type === 'YESNO') type = 'NUMBER_0_10'; // หรือจะทำเป็น enum ใหม่ก็ได้ (ชั่วคราว map ไว้ก่อน)
    if (type === 'CHOICE') type = 'TEXT';       // ชั่วคราว (ถ้าจะทำ choice จริง ต้องมี schema เพิ่ม)

    const required = !!body.required;
    const is_active = body.isActive === undefined ? true : !!body.isActive;

    // order_no: ถ้าส่ง order มาให้ใช้ แต่ต้องกันชน unique (store_id, order_no, is_active=true)
let order_no = Number(body.order ?? body.order_no);

const getMaxPlusOne = async () => {
  const maxRow = await prisma.storeFeedbackQuestion.aggregate({
    where: { store_id: store.id },
    _max: { order_no: true },
  });
  return (maxRow._max.order_no || 0) + 1;
};

if (!Number.isFinite(order_no) || order_no <= 0) {
  // ไม่ส่ง order -> auto max+1
  order_no = await getMaxPlusOne();
} else {
  // ส่ง order มา -> ถ้าชนกับคำถาม active เดิม ให้ย้ายไปท้ายสุด (กัน P2002)
  const conflict = await prisma.storeFeedbackQuestion.findFirst({
    where: { store_id: store.id, order_no, is_active: true },
    select: { id: true },
  });

  if (conflict) {
    order_no = await getMaxPlusOne();
  }
}

    // key: สร้างจาก label แบบง่าย ๆ กันชน unique (store_id, key)
    const baseKey =
      label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_ก-๙]/g, '')
        .slice(0, 40) || 'q';

    let key = baseKey;
    for (let i = 0; i < 50; i++) {
      const exists = await prisma.storeFeedbackQuestion.findFirst({
        where: { store_id: store.id, key },
        select: { id: true },
      });
      if (!exists) break;
      key = `${baseKey}_${i + 1}`;
    }

    const created = await prisma.storeFeedbackQuestion.create({
      data: {
        store_id: store.id,
        key,
        label,
        type,
        required,
        order_no,
        is_active,
      },
      select: {
        id: true,
        key: true,
        label: true,
        type: true,
        required: true,
        order_no: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json({ message: 'created', data: created });
  } catch (err) {
    console.error('createStoreFeedbackQuestionAdmin error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};
export const updateStoreFeedbackQuestionAdmin = async (req, res) => {
  try {
    const { id: storeId, questionId } = req.params;
    const body = req.body || {};

    const question = await prisma.storeFeedbackQuestion.findFirst({
      where: { id: questionId, store_id: storeId },
    });

    if (!question) {
      return res.status(404).json({ message: 'ไม่พบคำถาม' });
    }

    let type = body.type ? String(body.type).trim() : question.type;
    if (type === 'STAR') type = 'STAR_1_5';
    if (type === 'YESNO') type = 'NUMBER_0_10';
    if (type === 'CHOICE') type = 'TEXT';

    const updated = await prisma.storeFeedbackQuestion.update({
      where: { id: questionId },
      data: {
        label: body.title ?? body.label ?? question.label,
        type,
        required: body.required ?? question.required,
        is_active: body.isActive ?? question.is_active,
      },
    });

    return res.json({ message: 'updated', data: updated });
  } catch (err) {
    console.error('updateStoreFeedbackQuestionAdmin error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};
export const deleteStoreFeedbackQuestionAdmin = async (req, res) => {
  try {
    const { id: storeId, questionId } = req.params;

    const question = await prisma.storeFeedbackQuestion.findFirst({
      where: { id: questionId, store_id: storeId },
    });

    if (!question) {
      return res.status(404).json({ message: 'ไม่พบคำถาม' });
    }

    await prisma.storeFeedbackQuestion.delete({
      where: { id: questionId },
    });

    return res.json({ message: 'deleted' });
  } catch (err) {
    console.error('deleteStoreFeedbackQuestionAdmin error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};