// src/middlewares/upload.middleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// สร้างโฟลเดอร์ temp-pic ถ้ายังไม่มี (กันพังครั้งแรกที่รัน)
const TEMP_DIR = 'temp-pic';
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// กำหนดที่เก็บไฟล์ชั่วคราว
const storage = multer.diskStorage({
  destination: TEMP_DIR + '/',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, uuidv4() + ext);
  },
});

// อัพโหลดพื้นฐาน (จำกัดขนาด + รับเฉพาะรูปภาพ)
const baseUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    if (!ok) return cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น'));
    cb(null, true);
  },
});

// ---------- ของเดิม (คงไว้เพื่อไม่ให้ของอื่นพัง) ----------
export const upload = baseUpload; // ภายนอกใช้ .single() / .array() ต่อได้
export const storeUpload = baseUpload.fields([
  { name: 'cover',  maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);
export const storeUploadSingleCover = baseUpload.single('cover');

// ---------- ใหม่: ยอมรับได้ทั้ง 'cover' และ 'cover_image' ----------
/**
 * ใช้กับ categories: รับไฟล์จากฟิลด์ชื่อ 'cover' หรือ 'cover_image'
 * แล้ว map ให้มาอยู่ใน req.file เสมอ (เพื่อไม่ต้องแก้ controller)
 */
export const categoryUploadSingleCoverFlexible = (req, res, next) => {
  const handler = baseUpload.fields([
    { name: 'cover',       maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (err) return next(err);

    // ปรับให้ controller ใช้ req.file ได้เหมือน .single()
    if (req.files?.cover?.[0]) {
      req.file = req.files.cover[0];
    } else if (req.files?.cover_image?.[0]) {
      req.file = req.files.cover_image[0];
    }
    next();
  });
};

export default baseUpload;