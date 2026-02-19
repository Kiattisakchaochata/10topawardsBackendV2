import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();// ⬆️ ปรับ path ให้ตรงโปรเจกต์คุณ
// บางโปรเจกต์ใช้: import { prisma } from '../prisma.js';

export const getFeedbackSummary = async (req, res) => {
  try {
    // ---------- 1) นับจำนวน feedback ต่อร้าน ----------
    const totals = await prisma.$queryRaw`
      SELECT 
        s.id AS store_id,
        s.name AS store_name,
        COUNT(DISTINCT f.id) AS total_feedback
      FROM feedbacks f
      JOIN stores s ON s.id = f.store_id
      GROUP BY s.id, s.name
    `;

    // ---------- 2) คำนวณค่าเฉลี่ยต่อคำถามต่อร้าน ----------
    const questionStats = await prisma.$queryRaw`
      SELECT
        f.store_id,
        q.id AS question_id,
        q.\`key\` AS \`key\`,
        q.label AS label,
        q.type AS type,
        AVG(CAST(a.value_number AS DECIMAL(10,2))) AS avg,
        COUNT(*) AS count
      FROM feedback_answers a
      JOIN feedbacks f ON f.id = a.feedback_id
      JOIN feedback_questions q ON q.id = a.question_id
      GROUP BY f.store_id, q.id, q.\`key\`, q.label, q.type
    `;

    // ---------- 3) รวมข้อมูล ----------
    const map = new Map();

    for (const t of totals) {
      map.set(String(t.store_id), {
        store_id: String(t.store_id),
        store_name: String(t.store_name || ''),
        total_feedback: Number(t.total_feedback || 0),
        questions: [],
      });
    }

    for (const q of questionStats) {
      const sid = String(q.store_id);

      if (!map.has(sid)) {
        map.set(sid, {
          store_id: sid,
          store_name: '',
          total_feedback: 0,
          questions: [],
        });
      }

      map.get(sid).questions.push({
        key: String(q.key || ''),
        label: String(q.label || ''),
        type: String(q.type || ''),
        avg: q.avg !== null ? Number(q.avg) : null,
        count: Number(q.count || 0),
      });
    }

    const rows = Array.from(map.values())
      .filter((r) => r.total_feedback > 0); // เอาเฉพาะร้านที่มี feedback

    return res.json({ rows });

  } catch (err) {
    console.error('getFeedbackSummary error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};