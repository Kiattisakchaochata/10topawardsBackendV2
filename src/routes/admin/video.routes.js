import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";

const prisma = new PrismaClient();
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/** helper: ดึง videoId จากลิงก์ YouTube */
function getYouTubeId(url = "") {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    // รูปแบบ /embed/VIDEOID หรือ /shorts/VIDEOID
    const m = u.pathname.match(/\/(embed|shorts)\/([^/?#]+)/);
    if (m?.[2]) return m[2];
  } catch {
    // ignore
  }
  return null;
}

/** helper: เดา thumbnail จาก videoId */
function guessThumbFromId(id) {
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
/** helper: ดึงรูปตัวอย่างจาก TikTok oEmbed */
async function fetchTikTokThumb(tiktokUrl = "") {
  try {
    const res = await fetch(
      "https://www.tiktok.com/oembed?url=" + encodeURIComponent(tiktokUrl),
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.thumbnail_url || null;
  } catch {
    return null;
  }
}
/** แปลงค่า store จาก body ให้ชัดเจน (รองรับ store_id และ storeId, ค่าว่าง = null) */
function parseStoreId(body = {}) {
  const raw = body.store_id ?? body.storeId;
  if (raw === undefined) return undefined;  // ผู้ใช้ไม่ได้ส่งฟิลด์นี้มา
  if (raw === null) return null;            // ตั้งใจล้าง
  const s = String(raw).trim();
  return s === "" ? null : s;               // "" => null
}

/**
 * GET /api/admin/videos
 * query: take, skip, activeOnly (true/false), q (ค้นหาชื่อ)
 */
router.get("/", async (req, res) => {
  try {
    const take = Math.min(Number(req.query.take ?? 100), 500);
    const skip = Number(req.query.skip ?? 0);
    const activeOnly = String(req.query.activeOnly ?? "").toLowerCase() === "true";
    const q = String(req.query.q ?? "").trim();

    const where = {
      ...(activeOnly ? { is_active: true } : {}),
      ...(q ? { title: { contains: q } } : {}),
    };

    const [items, total] = await Promise.all([
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
          created_at: true,
          updated_at: true,
          // ✅ ต้อง select store_id กลับไปด้วยเพื่อให้หน้าแก้ไขเห็นค่าที่ map อยู่
          store_id: true,
          // ถ้าอยากโชว์ชื่อร้านด้วย เปิดอันนี้ได้ (ไม่จำเป็นต่อการบันทึก)
          // store: { select: { id: true, name: true } },
        },
      }),
      prisma.video.count({ where }),
    ]);

    res.json({ videos: items, total, take, skip });
  } catch (e) {
    console.error("GET /admin/videos error:", e);
    res.status(500).json({ message: "internal error" });
  }
});

/**
 * POST /api/admin/videos
 * body: { title, youtube_url, thumbnail_url?, order_number?, is_active?, start_date?, end_date?, store_id?|storeId? }
 */
router.post("/", upload.single("thumbnail"), async (req, res) => {
  try {
    const {
      title = "",
      youtube_url = "",
      tiktok_url = "",
      thumbnail_url,
      order_number = 0,
      is_active = true,
      start_date,
      end_date,
    } = req.body ?? {};

    const storeId = parseStoreId(req.body);

    if (!title.trim()) {
      return res.status(400).json({ message: "กรุณาใส่ชื่อเรื่อง" });
    }

    // ต้องมีอย่างน้อย 1 ลิงก์
    if (!youtube_url && !tiktok_url) {
      return res.status(400).json({
        message: "กรุณาใส่ลิงก์อย่างน้อย 1 ช่อง (YouTube หรือ TikTok)",
      });
    }

    // validate youtube ถ้าส่งมา
    const ytId = youtube_url ? getYouTubeId(String(youtube_url)) : null;
    if (youtube_url && !ytId) {
      return res.status(400).json({ message: "ลิงก์ YouTube ไม่ถูกต้อง" });
    }

    // validate tiktok ถ้าส่งมา
    if (tiktok_url && !/tiktok\.com\/@[^/]+\/video\/\d+/.test(String(tiktok_url))) {
      return res.status(400).json({ message: "ลิงก์ TikTok ไม่ถูกต้อง" });
    }

    // ถ้ามีไฟล์แนบ (multipart) — คุณค่อยอัปโหลดไปสตอเรจจริงแล้วได้ URL มา
    // ตัวอย่างสมมติ:
    // let uploadedThumbUrl: string | null = null;
    // if (req.file) {
    //   const uploaded = await putToS3(req.file.buffer, req.file.mimetype);
    //   uploadedThumbUrl = uploaded.url;
    // }

    let thumb = thumbnail_url ?? null;

if (!thumb) {
  if (ytId) {
    thumb = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  } else if (tiktok_url) {
    thumb = await fetchTikTokThumb(String(tiktok_url));
  }
}

    const created = await prisma.video.create({
      data: {
        title: title.trim(),
        youtube_url: youtube_url?.trim() || null,
        tiktok_url:  tiktok_url?.trim()  || null,
        thumbnail_url: thumb,
        order_number: Number(order_number) || 0,
        is_active: !!is_active,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        store_id: storeId ?? null,
      },
    });

    res.status(201).json({ video: created });
  } catch (e) {
    console.error("POST /admin/videos error:", e);
    res.status(500).json({ message: "internal error" });
  }
});

/**
 * PATCH /api/admin/videos/:id
 * body: ฟิลด์ใด ๆ ตามต้องการ (partial update) + รองรับ store_id/storeId
 */
router.patch("/:id", upload.single("thumbnail"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "missing id" });

    const data = {};   // ← ✅ ใช้แบบนี้พอ ไม่ต้องมี : any

    const allow = [
      "title",
      "youtube_url",
      "tiktok_url",
      "thumbnail_url",
      "order_number",
      "is_active",
      "start_date",
      "end_date",
    ];
    for (const k of allow) {
      if (k in req.body) data[k] = req.body[k];
    }

    // ✅ ถ้ามีไฟล์อัปโหลดมา ให้เขียนทับ thumbnail_url
    if (req.file) {
      data.thumbnail_url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      // หรือถ้าอัปโหลดไป Cloudinary/S3 ให้เปลี่ยนเป็น URL ที่ storage คืนมา
    }

    const storeId = parseStoreId(req.body);
    if (storeId !== undefined) {
      data.store_id = storeId;
    }

    if ("youtube_url" in data) {
      const newYtId = data.youtube_url ? getYouTubeId(String(data.youtube_url)) : null;
      if (data.youtube_url && !newYtId) {
        return res.status(400).json({ message: "ลิงก์ YouTube ไม่ถูกต้อง" });
      }
      if (!("thumbnail_url" in data) || !data.thumbnail_url) {
        data.thumbnail_url = newYtId ? guessThumbFromId(newYtId) : null;
      }
    }

    if ("tiktok_url" in data) {
  const tik = String(data.tiktok_url || "");
  if (tik && !/tiktok\.com\/@[^/]+\/video\/\d+/.test(tik)) {
    return res.status(400).json({ message: "ลิงก์ TikTok ไม่ถูกต้อง" });
  }

  // ถ้าไม่มี thumbnail ใหม่ (ทั้งจาก body และไฟล์) ให้ลองดึงจาก oEmbed
  const noThumbInBody = !("thumbnail_url" in data) || !data.thumbnail_url;
  const noFile = !req.file;
  if (tik && noThumbInBody && noFile) {
    const tikThumb = await fetchTikTokThumb(tik);
    if (tikThumb) data.thumbnail_url = tikThumb;
  }
}

    if ("order_number" in data) data.order_number = Number(data.order_number) || 0;
    if ("is_active" in data) data.is_active = Boolean(data.is_active);
    if ("start_date" in data) data.start_date = data.start_date ? new Date(data.start_date) : null;
    if ("end_date" in data) data.end_date = data.end_date ? new Date(data.end_date) : null;

    const updated = await prisma.video.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (e) {
    console.error("PATCH /admin/videos/:id error:", e);
    if (e?.code === "P2025") return res.status(404).json({ message: "not found" });
    res.status(500).json({ message: "internal error" });
  }
});

/**
 * ✅ Endpoint เฉพาะ: map ร้านให้วิดีโอ (ใช้ง่ายกับ Postman/หน้าแอดมิน)
 * PATCH /api/admin/videos/:id/store
 * body: { store_id?: string | null } (หรือ storeId)
 */
router.patch("/:id/store", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "missing id" });

    const storeId = parseStoreId(req.body);
    if (storeId === undefined) {
      return res.status(400).json({ message: "missing store_id / storeId in body" });
    }

    const updated = await prisma.video.update({
      where: { id },
      data: { store_id: storeId },
    });

    res.json(updated);
  } catch (e) {
    console.error("PATCH /admin/videos/:id/store error:", e);
    if (e?.code === "P2025") return res.status(404).json({ message: "not found" });
    res.status(500).json({ message: "internal error" });
  }
});

/**
 * DELETE /api/admin/videos/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "missing id" });

    await prisma.video.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /admin/videos/:id error:", e);
    if (e?.code === "P2025") return res.status(404).json({ message: "not found" });
    res.status(500).json({ message: "internal error" });
  }
});

export default router;