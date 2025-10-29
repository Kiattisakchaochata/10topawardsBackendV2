// controllers/tracking.controller.js
import prisma from '../config/prisma.config.js';

/**
 * Admin: list ทั้งหมด (ดูได้ว่า script ไหนผูกกับร้านไหน)
 */
export async function listTrackingScripts(_req, res, next) {
  try {
    const items = await prisma.trackingScript.findMany({
      include: { store: { select: { id: true, name: true } } },
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: สร้าง/แก้ไข Tracking Script
 * - ถ้าไม่ได้ส่ง storeId หรือส่งค่าว่าง => จะถือเป็น "เว็บไซต์หลัก" (storeId = null)
 * - ต้องมีอย่างน้อย 1 อย่างใน trackingId หรือ script
 */
export async function upsertTrackingScript(req, res, next) {
  try {
    const {
      id,
      provider,
      trackingId,
      script,
      placement = 'HEAD',
      strategy = 'afterInteractive',
      enabled = true,
      storeId = null, // null = เว็บไซต์หลัก
    } = req.body;

    if (!provider) {
      return res.status(400).json({ message: 'provider is required' });
    }
    if (!trackingId && !script) {
      return res.status(400).json({ message: 'ต้องกรอกอย่างน้อย 1 อย่าง (Tracking ID หรือ Script)' });
    }

    const data = {
      provider,
      trackingId: trackingId ?? null,
      script: script ?? null,
      placement,
      strategy,
      enabled: !!enabled,
      storeId: storeId || null, // ค่าว่าง => null (เว็บไซต์หลัก)
    };

    const saved = id
      ? await prisma.trackingScript.update({ where: { id }, data })
      : await prisma.trackingScript.create({ data });

    res.status(id ? 200 : 201).json({ item: saved });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: ลบ
 */
export async function deleteTrackingScript(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.trackingScript.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Public: ดึงเฉพาะ enabled
 *
 * พารามิเตอร์:
 * - ?storeId=<id>  => ดึง "ของร้านนั้น" + "ของเว็บไซต์หลัก (global)" พร้อมกัน (OR)
 * - ?only=store&storeId=<id> => ดึงเฉพาะของร้านนั้น
 * - ?only=global            => ดึงเฉพาะของเว็บไซต์หลัก
 * - ไม่ส่งอะไรเลย           => ดึงเฉพาะของเว็บไซต์หลัก
 */
export async function listEnabledTrackingScripts(req, res, next) {
  try {
    const { storeId, only } = req.query;

    let where;
    if (only === 'store' && storeId) {
      // เฉพาะของร้าน
      where = { enabled: true, storeId };
    } else if (only === 'global') {
      // เฉพาะของเว็บไซต์หลัก
      where = { enabled: true, storeId: null };
    } else if (storeId) {
      // ✅ ดีฟอลต์กรณีมี storeId: รวม "ร้านนั้น" + "เว็บไซต์หลัก"
      where = { enabled: true, OR: [{ storeId }, { storeId: null }] };
    } else {
      // ไม่มีอะไรเลย: เว็บไซต์หลักเท่านั้น
      where = { enabled: true, storeId: null };
    }

    const items = await prisma.trackingScript.findMany({
      where,
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
}