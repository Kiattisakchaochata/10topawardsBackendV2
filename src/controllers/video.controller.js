import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/* ---------------- helpers ---------------- */
function isValidYoutubeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

function isValidTiktokUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.includes('tiktok.com') && /\/video\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

// รับได้ทั้ง store_id / storeId
function parseStoreId(body = {}) {
  const raw = body.store_id ?? body.storeId;
  if (raw === undefined) return undefined;        // ไม่ได้ส่งฟิลด์นี้มา => ไม่แตะต้องค่าเดิม
  if (raw === null) return null;                  // ตั้งใจล้าง
  const s = String(raw).trim();
  return s === '' ? null : s;                     // "" => null
}

/* --------------- ADMIN --------------- */
export const adminListVideos = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const rows = await prisma.video.findMany({
      where: q
        ? { OR: [
            { title: { contains: q } },
            { youtube_url: { contains: q } },
            { tiktok_url: { contains: q } },
          ] }
        : undefined,
      orderBy: [{ order_number: 'asc' }, { created_at: 'desc' }],
    });
    res.json({ videos: rows });
  } catch (err) {
    next(err);
  }
};

export const adminCreateVideo = async (req, res, next) => {
  try {
    const {
      title = '',
      youtube_url = '',
      tiktok_url = '',
      order_number = 0,
      is_active = true,
      start_date,
      end_date,
      thumbnail_url,
    } = req.body || {};

    const storeId = parseStoreId(req.body);

    if (!title.trim()) return res.status(400).json({ message: 'กรุณาใส่ชื่อเรื่อง' });

    // ต้องมีอย่างน้อย 1 ลิงก์ (YouTube หรือ TikTok)
    if (!youtube_url && !tiktok_url) {
      return res.status(400).json({ message: 'กรุณาใส่ลิงก์อย่างน้อย 1 ช่อง (YouTube หรือ TikTok)' });
    }
    // ต้องมีอย่างน้อย YouTube หรือ TikTok
if ((!youtube_url || !isValidYoutubeUrl(youtube_url)) && !req.body.tiktok_url) {
  return res.status(400).json({ message: 'กรุณาใส่ YouTube หรือ TikTok อย่างน้อย 1 ช่อง' });
}
    if (tiktok_url && !isValidTiktokUrl(tiktok_url)) {
      return res.status(400).json({ message: 'ลิงก์ TikTok ไม่ถูกต้อง' });
    }

    const row = await prisma.video.create({
  data: {
  title: title.trim(),
  youtube_url: (youtube_url ?? '').trim(),   // ← รองรับว่างได้
  tiktok_url: req.body.tiktok_url?.trim() || null, // ← เพิ่มบรรทัดนี้
  thumbnail_url: thumbnail_url ?? null,
  order_number: Number(order_number) || 0,
  is_active: !!is_active,
  start_date: start_date ? new Date(start_date) : null,
  end_date: end_date ? new Date(end_date) : null,
  store_id: storeId ?? null,
},
});

    res.status(201).json({ video: row });
  } catch (err) {
    next(err);
  }
};

export const adminUpdateVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      youtube_url,
      tiktok_url,
      order_number,
      is_active,
      start_date,
      end_date,
      thumbnail_url,
    } = req.body || {};

    const payload = {};

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ message: 'ชื่อเรื่องห้ามว่าง' });
      payload.title = String(title).trim();
    }

    if (youtube_url !== undefined) {
      // ใหม่: ต้องมีอย่างน้อย YouTube หรือ TikTok
if ((!youtube_url || !isValidYoutubeUrl(youtube_url)) && !req.body.tiktok_url) {
  return res.status(400).json({ message: 'กรุณาใส่ YouTube หรือ TikTok อย่างน้อย 1 ช่อง' });
}
      payload.youtube_url = youtube_url ? String(youtube_url).trim() : null;
    }

    if (tiktok_url !== undefined) {
      if (tiktok_url && !isValidTiktokUrl(tiktok_url)) {
        return res.status(400).json({ message: 'ลิงก์ TikTok ไม่ถูกต้อง' });
      }
      payload.tiktok_url = tiktok_url ? String(tiktok_url).trim() : null;
    }

    if (thumbnail_url !== undefined) payload.thumbnail_url = thumbnail_url ?? null;
    if (order_number !== undefined) payload.order_number = Number(order_number) || 0;
    if (is_active !== undefined) payload.is_active = !!is_active;
    if (start_date !== undefined) payload.start_date = start_date ? new Date(start_date) : null;
    if (end_date !== undefined) payload.end_date = end_date ? new Date(end_date) : null;

    // ✅ อัปเดตการผูกร้าน (รองรับล้างค่า)
    const storeId = parseStoreId(req.body);
    if (storeId !== undefined) {
      payload.store_id = storeId; // อาจเป็นค่าจริงหรือ null
    }

    const row = await prisma.video.update({
      where: { id },
      data: payload,
    });

    res.json({ video: row });
  } catch (err) {
    next(err);
  }
};

export const adminDeleteVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.video.delete({ where: { id } });
    res.json({ message: 'deleted' });
  } catch (err) {
    next(err);
  }
};

/* --------------- PUBLIC --------------- */
export const publicListVideos = async (req, res, next) => {
  try {
    const now = new Date();

    const activeParam = String(req.query.active ?? '1').toLowerCase();
    const filterActive = activeParam === '1' || activeParam === 'true';

    const storeId = (req.query.store_id || req.query.store) ? String(req.query.store_id || req.query.store) : undefined;

    const where = {
      ...(filterActive
        ? {
            is_active: true,
            OR: [{ start_date: null }, { start_date: { lte: now } }],
            AND: [{ end_date: null }, { end_date: { gte: now } }],
          }
        : {}),
      ...(storeId ? { store_id: storeId } : {}),
    };

    const rows = await prisma.video.findMany({
      where,
      orderBy: [{ order_number: 'asc' }, { created_at: 'desc' }],
    });

    res.json({ videos: rows });
  } catch (err) {
    next(err);
  }
};