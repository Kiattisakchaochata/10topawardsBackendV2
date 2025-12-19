// src/lib/tiktokCover.js
import { v2 as cloudinary } from "cloudinary";

// ถ้า Node ของคุณยังไม่มี fetch (เวอร์ชัน < 18) ให้ uncomment 2 บรรทัดด้านล่างนี้
// import fetch from "node-fetch";
// global.fetch = fetch;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const DEFAULT_FOLDER = process.env.CLOUDINARY_TIKTOK_FOLDER || "tiktok-covers";

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.warn(
    "[tiktokCover] Missing Cloudinary envs (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET). " +
      "Upload functions will fail."
  );
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

/**
 * ดึง thumbnail_url จาก TikTok oEmbed
 */
async function getTikTokThumbnailUrl(tiktokUrl) {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`
    );

    if (!res.ok) {
      console.warn("[tiktokCover] oEmbed non-200:", res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const thumb = data && data.thumbnail_url;
    if (!thumb || typeof thumb !== "string") {
      console.warn("[tiktokCover] No thumbnail_url in oEmbed response");
      return null;
    }
    return thumb;
  } catch (err) {
    console.warn("[tiktokCover] oEmbed fetch error:", err && err.message ? err.message : err);
    return null;
  }
}

/**
 * โหลดไฟล์รูปจาก URL แล้วคืนค่า Buffer
 */
async function downloadImageAsBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[tiktokCover] image download failed:", res.status, res.statusText);
      return null;
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (err) {
    console.warn("[tiktokCover] image download error:", err && err.message ? err.message : err);
    return null;
  }
}

/**
 * อัปโหลด Buffer รูปขึ้น Cloudinary แล้วคืน URL ถาวร
 */
async function uploadBufferToCloudinary(buffer, opts) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.warn("[tiktokCover] Cloudinary not configured, skip upload");
    return null;
  }

  const folder = opts.folder || DEFAULT_FOLDER;
  const publicId = opts.publicId;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
      },
      (err, result) => {
        if (err) {
          console.error("[tiktokCover] Cloudinary upload error:", err);
          return reject(err);
        }
        const secureUrl = result && result.secure_url;
        if (!secureUrl) {
          console.warn("[tiktokCover] upload ok but no secure_url");
          return resolve(null);
        }
        resolve(secureUrl);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * ฟังก์ชันหลัก:
 * - ถ้า video ยังไม่มี cover_image แต่มี tiktokUrl
 * - จะดึง thumbnail จาก TikTok → ดาวน์โหลด → อัปโหลด Cloudinary
 * - แล้วคืน URL ใหม่ (ให้เอาไปเซฟใส่ DB)
 */
export async function ensureTikTokCoverUrl({ tiktokUrl, videoId, currentCoverUrl }) {
  // ถ้ามี cover อยู่แล้ว ก็ใช้ต่อ
  if (currentCoverUrl) return currentCoverUrl;

  // 1) ขอ thumbnail URL จาก TikTok
  const thumbUrl = await getTikTokThumbnailUrl(tiktokUrl);
  if (!thumbUrl) return null;

  // 2) ดาวน์โหลดรูป
  const buffer = await downloadImageAsBuffer(thumbUrl);
  if (!buffer) return null;

  // 3) อัปโหลด Cloudinary
  const stableUrl = await uploadBufferToCloudinary(buffer, {
    publicId: videoId,
  });

  return stableUrl;
}