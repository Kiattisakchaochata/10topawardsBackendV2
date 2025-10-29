// src/controllers/banner.controller.js
import prisma from '../config/prisma.config.js';
import cloudinary from '../config/cloudinary.config.js';
import fs from 'fs/promises';

/** ADMIN: ดูทั้งหมด (ไม่ฟิลเตอร์วันที่) */
export const getBanners = async (_req, res, next) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ banners });
  } catch (err) {
    next(err);
  }
};

/** ADMIN: สร้างใหม่ */
export const createBanner = async (req, res, next) => {
  try {
    const {
      title,
      alt_text,
      order = 0,
      href,
      is_active = true,
      // หมายเหตุ: ยังไม่ใช้ start_date/end_date เพื่อหลีกเลี่ยง Prisma error
    } = req.body;

    if (!req.file) return res.status(400).json({ message: 'กรุณาอัปโหลดภาพ' });

    const upload = await cloudinary.uploader.upload(req.file.path, {
      folder: 'homepage-banners',
    });
    await fs.unlink(req.file.path);

    const banner = await prisma.banner.create({
      data: {
        image_url: upload.secure_url,
        cloudinary_public_id: upload.public_id ?? null,
        title: title || null,
        alt_text: (alt_text || title || 'banner') ?? null,
        order: Number(order) || 0,
        href: href || null,
        is_active: String(is_active) === 'false' ? false : Boolean(is_active),
      },
    });

    res.status(201).json({ message: 'สร้างแบนเนอร์สำเร็จ', banner });
  } catch (err) {
    next(err);
  }
};

/** ADMIN: แก้ไข (เลือกรูปใหม่ได้/ไม่ก็ได้) */
export const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exists = await prisma.banner.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: 'ไม่พบแบนเนอร์' });

    const { title, alt_text, order, href, is_active } = req.body;

    let image_url = exists.image_url;
    let cloudinary_public_id = exists.cloudinary_public_id;

    if (req.file) {
      if (cloudinary_public_id) {
        try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch {}
      }
      const upload = await cloudinary.uploader.upload(req.file.path, {
        folder: 'homepage-banners',
      });
      await fs.unlink(req.file.path);
      image_url = upload.secure_url;
      cloudinary_public_id = upload.public_id ?? null;
    }

    const updated = await prisma.banner.update({
      where: { id },
      data: {
        image_url,
        cloudinary_public_id,
        title: title ?? exists.title,
        alt_text: alt_text ?? exists.alt_text,
        order: typeof order !== 'undefined' ? Number(order) : exists.order,
        href: typeof href !== 'undefined' ? href : exists.href,
        is_active:
          typeof is_active !== 'undefined'
            ? String(is_active) === 'false'
              ? false
              : Boolean(is_active)
            : exists.is_active,
      },
    });

    res.json({ message: 'อัปเดตแบนเนอร์สำเร็จ', banner: updated });
  } catch (err) {
    next(err);
  }
};

/** ADMIN: ลบ */
export const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exists = await prisma.banner.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: 'ไม่พบแบนเนอร์' });

    if (exists.cloudinary_public_id) {
      try { await cloudinary.uploader.destroy(exists.cloudinary_public_id); } catch {}
    }

    await prisma.banner.delete({ where: { id } });
    res.json({ message: 'ลบแบนเนอร์สำเร็จ' });
  } catch (err) {
    next(err);
  }
};

/** PUBLIC: เอาเฉพาะ active (ต่อยอดเรื่องช่วงวันทีหลังได้) */
export const getActiveBannersPublic = async (_req, res, next) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { is_active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        alt_text: true,
        image_url: true,
        href: true,
        order: true,
        is_active: true,
      },
    });

    // ⬇️ ปิด cache ทุกชั้นให้ผลลัพธ์สดเสมอ
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    });

    res.json({ banners });
  } catch (err) {
    next(err);
  }
};