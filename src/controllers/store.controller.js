// controllers/store.controller.js
import prisma from '../config/prisma.config.js';
import cloudinary from '../config/cloudinary.config.js';
import fs from 'fs/promises';


/* ----------------------------- helpers ----------------------------- */
function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toBoolOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['true','1','yes','on'].includes(s)) return true;
  if (['false','0','no','off'].includes(s)) return false;
  return null;
}

async function nextOrderInCategory(categoryId) {
  const max = await prisma.store.aggregate({
    where: { category_id: categoryId },
    _max: { order_number: true },
  });
  return (max._max.order_number || 0) + 1;
}

function safeNewDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(+d) ? null : d;
}
function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ก-๙\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getAvailableStoreSlug(baseName) {
  const base = slugify(baseName);
  if (!base) return String(Date.now());

  // ดึง slug ที่ขึ้นต้นด้วย base มาเช็ค
  const existing = await prisma.store.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map(r => r.slug));

  if (!taken.has(base)) return base;

  for (let i = 2; i <= 200; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
/* ============================= CREATE ============================== */
export const createStore = async (req, res, next) => {
  try {
    const {
      name,
      description = '',
      address = '',
      province,
      category_id,
      social_links = '',
      order_number,
      expired_at,
      is_featured_home,
  featured_order,
  featured_until,
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อร้านและหมวดหมู่' });
    }

    // ❶ คำนวณลำดับ
    let desiredOrder = Number(order_number);
    if (!Number.isInteger(desiredOrder) || desiredOrder <= 0) {
      const max = await prisma.store.aggregate({
        where: { category_id },
        _max: { order_number: true },
      });
      desiredOrder = (max._max.order_number || 0) + 1;
    } else {
      const existing = await prisma.store.findFirst({
        where: { category_id, order_number: desiredOrder },
      });
      if (existing) {
        return res.status(400).json({
          message: `ลำดับที่ ${desiredOrder} มีอยู่แล้วในหมวดหมู่นี้ กรุณาเลือกลำดับใหม่`,
        });
      }
    }

    // ❷ อัปโหลด cover
    let coverImageUrl = null;
    if (req.files?.cover?.length > 0) {
      const coverResult = await cloudinary.uploader.upload(req.files.cover[0].path, {
        folder: 'store-covers',
      });
      coverImageUrl = coverResult.secure_url;
      await fs.unlink(req.files.cover[0].path);
    }

    // ❸ สร้างร้าน
    // เตรียม slug ไม่ซ้ำ
const slug = await getAvailableStoreSlug(name);

// (แนะนำ) แปลง social_links เป็น object ถ้าส่งมาเป็น JSON string
let socialLinksVal = undefined;
if (social_links !== undefined && social_links !== null && social_links !== '') {
  try {
    socialLinksVal = typeof social_links === 'string' ? JSON.parse(social_links) : social_links;
  } catch {
    // ถ้า parse ไม่ได้ จะเก็บเป็น string ก็ยัง valid สำหรับ Prisma JSON
    socialLinksVal = social_links;
  }
}
// ✅ parse featured fields
const featuredParsed = toBoolOrNull(is_featured_home); // true/false/null
const featuredOrderVal = toIntOrNull(featured_order);  // number/null
const featuredUntilVal = featured_until ? new Date(featured_until) : null;

// ถ้าไม่ได้ส่ง is_featured_home มาเลย → ถือว่า false (default)
const isFeaturedFinal = featuredParsed === true;

// ถ้าไม่ใช่ featured → เคลียร์ order/until กันค้าง
const featuredOrderFinal = isFeaturedFinal ? featuredOrderVal : null;
const featuredUntilFinal = isFeaturedFinal ? featuredUntilVal : null;
const store = await prisma.store.create({
  data: {
    name,
    slug, // ✅ ต้องมี
    description,
    address,
    province,
    social_links: socialLinksVal,
    category_id,
    order_number: desiredOrder,
    cover_image: coverImageUrl,
    expired_at: expired_at ? new Date(expired_at) : null,
    is_active: true,
    is_featured_home: isFeaturedFinal,
    featured_order: featuredOrderFinal,
    featured_until: featuredUntilFinal,
  },
  select: { id: true },
});

    // ❹ อัปโหลดรูปเพิ่ม (images[] + orders[])
    let orders = [];
    if (req.body.orders) {
      if (Array.isArray(req.body.orders)) {
        orders = req.body.orders.map((o) => Number(o));
      } else {
        const single = Number(req.body.orders);
        if (!isNaN(single)) orders = [single];
      }
    }

    const uploadedImages = await Promise.all(
      (req.files?.images || []).map(async (file, index) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'store-images',
        });
        await fs.unlink(file.path);
        const order = orders[index] || index + 1;
        return {
          image_url: result.secure_url,
          order_number: order,
          alt_text: `รูปที่ ${order}`,
        };
      })
    );

    if (uploadedImages.length > 0) {
      await prisma.store.update({
        where: { id: store.id },
        data: { images: { create: uploadedImages } },
      });
    }

    // ❺ คืนค่า
    const storeWithImages = await prisma.store.findUnique({
      where: { id: store.id },
      include: { images: true, category: true },
    });

    res.status(201).json({
      message: 'สร้างร้านค้าสำเร็จ',
      store: storeWithImages,
    });
  } catch (err) {
    console.error('🔥 CREATE STORE ERROR:', err);
    next(err);
  }
};

/* ============================ READ (ALL) =========================== */
export const getAllStores = async (req, res, next) => {
  try {
    const { select, limit = 1000, q } = req.query;

    // เงื่อนไขค้นหาแบบเบา ๆ
    const where = q
      ? { name: { contains: String(q), mode: 'insensitive' } }
      : {};

    // ⬇️ ถ้าขอแบบ basic ให้คืนแค่ { items: [{id,name}, ...] }
    if (String(select) === 'basic') {
      const items = await prisma.store.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: Number(limit) || 1000,
        select: { id: true, name: true },
      });
      return res.json({ items });
    }

    // ⬇️ กรณีอื่นๆ คืนเต็มเหมือนเดิม (แต่ใส่ทั้ง keys: items และ stores เพื่อไม่ให้หน้าเก่าแตก)
    const stores = await prisma.store.findMany({
      where,
      orderBy: [
        { category_id: 'asc' },
        { order_number: 'asc' },
        { created_at: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        address: true,
         province: true,
        description: true,
        social_links: true,
        category_id: true,
        is_active: true,
      is_featured_home: true,
       featured_order: true,
     featured_until: true,
        order_number: true,
        created_at: true,
        updated_at: true,
        expired_at: true,
        cover_image: true,
        category: true,
        images: true,
        reviews: true,
        visitorCounter: true,
        renewal_count: true,
      },
    });

    const mapped = stores.map((s) => ({ ...s, renew_count: s.renewal_count }));

    // ใส่ทั้งสองคีย์: FE บางหน้าใช้ stores, หน้าใหม่ใช้ items
    res.json({ items: mapped, stores: mapped });
  } catch (err) {
    next(err);
  }
};
/* ============================ READ (ONE) =========================== */
export const getStoreById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        social_links: true,
        category_id: true,
        order_number: true,
        cover_image: true,
        is_featured_home: true,
       featured_order: true,
      featured_until: true,
        created_at: true,
        updated_at: true,
        expired_at: true,
        is_active: true,
        category: true,
        images: true,
        renewal_count: true,
        reviews: {
          include: { user: { select: { id: true, name: true } } },
        },
        visitorCounter: true,
      },
    });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้านี้' });
    res.json({ ...store, renew_count: store.renewal_count });
  } catch (err) {
    next(err);
  }
};

/* ============================== UPDATE ============================ */
export const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      address,
      province,
      social_links,
      category_id,
      existing_image_orders = [],
      order_number,
      expired_at,
      is_active,
      is_featured_home,
      featured_order,
      featured_until,
    } = req.body;

    if (category_id) {
      const categoryExists = await prisma.category.findUnique({ where: { id: category_id } });
      if (!categoryExists) return res.status(400).json({ message: 'ไม่พบ category ที่ระบุ' });
    }

    // re-order images (optional)
    const parsedOrders = Array.isArray(existing_image_orders)
      ? existing_image_orders.map((o) => (typeof o === 'string' ? JSON.parse(o) : o))
      : [typeof existing_image_orders === 'string' ? JSON.parse(existing_image_orders) : existing_image_orders];

    if (parsedOrders.filter(Boolean).length > 0) {
      const uniqueOrderNumbers = new Set(parsedOrders.map((o) => `${o.order_number}`));
      if (uniqueOrderNumbers.size !== parsedOrders.length) {
        return res.status(400).json({ message: 'ลำดับรูปภาพซ้ำกัน กรุณาตรวจสอบอีกครั้ง' });
      }
    }

    // cover ใหม่ (ถ้ามี)
    let coverImageUrl = null;
    if (req.files?.cover?.length > 0) {
      const result = await cloudinary.uploader.upload(req.files.cover[0].path, {
        folder: 'store-covers',
      });
      coverImageUrl = result.secure_url;
      await fs.unlink(req.files.cover[0].path);
    }

    // ตรวจ order_number ถ้าส่งมา
    const newOrder = toIntOrNull(order_number);
    if (newOrder !== null) {
      const current = await prisma.store.findUnique({
        where: { id },
        select: { category_id: true, order_number: true },
      });
      const catId = category_id || current?.category_id;
      if (!catId) return res.status(400).json({ message: 'ไม่ทราบหมวดหมู่ของร้าน' });

      const conflict = await prisma.store.findFirst({
        where: { category_id: catId, order_number: newOrder, id: { not: id } },
        select: { id: true },
      });
      if (conflict) {
        return res.status(400).json({ message: `มีร้านในหมวดนี้ใช้ลำดับ ${newOrder} อยู่แล้ว` });
      }
    }

    /* ================== ⬇⬇⬇ เพิ่มบล็อกนี้ (แค่เพิ่ม ไม่แก้อันเดิม) ⬇⬇⬇ ================== */
    // กรณีเปลี่ยนหมวดหมู่แต่ "ไม่ได้ส่ง" order_number → ใช้ลำดับเดิมของร้านในหมวดใหม่
    // พร้อมตรวจชนในหมวดใหม่ให้ก่อน
    let __effectiveOrderToApply = null;
    try {
      const currentStore = await prisma.store.findUnique({
        where: { id },
        select: { category_id: true, order_number: true },
      });

      const targetCatId = category_id || currentStore?.category_id;

      if (category_id && newOrder === null) {
        __effectiveOrderToApply = currentStore?.order_number ?? null;
      }

      if (targetCatId && __effectiveOrderToApply !== null) {
        const conflict2 = await prisma.store.findFirst({
          where: {
            category_id: targetCatId,
            order_number: __effectiveOrderToApply,
            id: { not: id },
          },
          select: { id: true },
        });
        if (conflict2) {
          return res.status(400).json({
            message: `มีร้านในหมวดนี้ใช้ลำดับ ${__effectiveOrderToApply} อยู่แล้ว`,
          });
        }
      }
    } catch {}
    /* ================== ⬆⬆⬆ เพิ่มบล็อกนี้ (แค่เพิ่ม ไม่แก้อันเดิม) ⬆⬆⬆ ================== */

    await prisma.$transaction(async (tx) => {
      // 1) สลับลำดับรูป (best-effort)
      if (parsedOrders.filter(Boolean).length > 0) {
        for (const { id: imageId } of parsedOrders) {
          try {
            await tx.image.update({
              where: { id: imageId },
              data: { order_number: -(Math.floor(Math.random() * 10000 + 1)) },
            });
          } catch {}
        }
        for (const { id: imageId, order_number: ord } of parsedOrders) {
          try {
            await tx.image.update({
              where: { id: imageId },
              data: { order_number: Number(ord) },
            });
          } catch {}
        }
      }

      // 2) สร้าง payload ตามฟิลด์ที่ถูกส่งมาเท่านั้น
      const data = {};
      if (name !== undefined && name !== '') {
  const current = await prisma.store.findUnique({
    where: { id },
    select: { name: true },
  });
  if (current && String(current.name).trim() !== String(name).trim()) {
    const newSlug = await getAvailableStoreSlug(name);
    data.slug = newSlug; // ✅ ปรับ slug ให้ไม่ซ้ำ
  }
  data.name = name;
}
      if (description !== undefined) data.description = description;
      if (address !== undefined) data.address = address;
      // ✅ parse ให้เป็น object เสมอ (เหมือนใน createStore)
if (social_links !== undefined) {
  let socialLinksVal = social_links;
  try {
    if (typeof social_links === 'string' && social_links.trim() !== '') {
      socialLinksVal = JSON.parse(social_links);
    }
  } catch {
    // ถ้า parse ไม่ได้ ก็เก็บตามที่ส่งมา (string) แต่ควรหลีกเลี่ยง
  }
  data.social_links = socialLinksVal;
}
      if (category_id) data.category_id = category_id;
      if (coverImageUrl) data.cover_image = coverImageUrl;
      if (newOrder !== null) data.order_number = newOrder;
      if (expired_at !== undefined) {
        data.expired_at = expired_at ? new Date(expired_at) : null;
      }

      // ⬇⬇⬇ เพิ่ม: ใช้ลำดับเดิมเมื่อย้ายหมวดแต่ไม่ได้ส่ง order_number
      if (newOrder === null && __effectiveOrderToApply !== null) {
        data.order_number = __effectiveOrderToApply;
      }

      // ⬇⬇⬇ เพิ่ม: parse is_active ถ้าส่งมา
      const activeParsed = toBoolOrNull(is_active);
      if (activeParsed !== null) data.is_active = activeParsed;
      // ✅ Featured fields (ร้านรายปี/เด่นหน้าแรก)
const featuredParsed = toBoolOrNull(is_featured_home);
if (featuredParsed !== null) data.is_featured_home = featuredParsed;

// featured_order: "" = null
if (featured_order !== undefined) {
  data.featured_order = toIntOrNull(featured_order);
}

// featured_until: "" = null (รองรับ date string)
if (featured_until !== undefined) {
  data.featured_until = featured_until ? new Date(featured_until) : null;
}

// ถ้าปิด featured → เคลียร์ค่าที่เกี่ยวข้อง ป้องกันค้าง
if (featuredParsed === false) {
  data.featured_order = null;
  data.featured_until = null;
}
      if (province !== undefined) data.province = province;
      if (Object.keys(data).length > 0) {
        await tx.store.update({ where: { id }, data });
      }
    });

    // 3) อัปโหลดรูปใหม่ (ต่อท้าย)
    if (req.files?.images?.length > 0) {
      const maxOrder = await prisma.image.aggregate({
        where: { store_id: id },
        _max: { order_number: true },
      });

      let nextOrder = (maxOrder._max.order_number || 0) + 1;

      const newImages = await Promise.all(
        req.files.images.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path, { folder: 'store-images' });
          await fs.unlink(file.path);
          return {
            image_url: result.secure_url,
            order_number: nextOrder++,
            alt_text: 'ภาพใหม่',
          };
        })
      );

      await prisma.store.update({
        where: { id },
        data: { images: { create: newImages } },
      });
    }

    const updatedStore = await prisma.store.findUnique({
      where: { id },
      include: { images: true },
    });

    res.json({ message: 'อัปเดตร้านค้าสำเร็จ', store: updatedStore });
  } catch (err) {
    next(err);
  }
};

// เปลี่ยนสถานะตรง ๆ (รับ JSON หรือ multipart ก็ได้)
export const setStoreStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const desired = toBoolOrNull(req.body?.is_active);
    if (desired === null) {
      return res.status(400).json({ message: 'กรุณาส่ง is_active เป็น true/false' });
    }
    const updated = await prisma.store.update({
      where: { id },
      data: { is_active: desired },
      include: { images: true, category: true },
    });
    return res.json({ message: 'อัปเดตร้านค้าสำเร็จ', store: updated });
  } catch (err) {
    next(err);
  }
};

// เปิดใช้งาน
export const enableStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await prisma.store.update({
      where: { id },
      data: { is_active: true },
      include: { images: true, category: true },
    });
    return res.json({ message: 'เปิดใช้งานแล้ว', store });
  } catch (err) {
    next(err);
  }
};

// ปิดใช้งาน
export const disableStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await prisma.store.update({
      where: { id },
      data: { is_active: false },
      include: { images: true, category: true },
    });
    return res.json({ message: 'ปิดใช้งานแล้ว', store });
  } catch (err) {
    next(err);
  }
};

/* ============================== DELETE ============================ */
export const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.store.delete({ where: { id } });
    res.json({ message: 'ลบร้านค้าสำเร็จ' });
  } catch (err) {
    next(err);
  }
};

/* =========================== UPLOAD IMAGES ======================== */
export const uploadImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป' });
    }

    const maxOrder = await prisma.image.aggregate({
      where: { store_id: id },
      _max: { order_number: true },
    });
    let nextOrder = (maxOrder._max.order_number || 0) + 1;

    const images = await Promise.all(
      files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'store-images' });
        await fs.unlink(file.path);
        return {
          image_url: result.secure_url,
          order_number: nextOrder++,
          alt_text: 'รูปภาพใหม่',
        };
      })
    );

    const updated = await prisma.store.update({
      where: { id },
      data: { images: { create: images } },
      include: { images: true },
    });

    res.json({ message: 'อัปโหลดรูปภาพสำเร็จ', images: updated.images, store: updated });
  } catch (err) {
    next(err);
  }
};

/* ============================== SEARCH =========================== */
export const searchStore = async (req, res, next) => {
  try {
    let { q } = req.query;
    if (!q) return res.status(400).json({ message: 'กรุณาระบุคำค้นหา เช่น ?q=อาหาร' });

    q = String(q).trim().toLowerCase();

    const stores = await prisma.store.findMany({
      include: { category: true, images: true, reviews: true },
      orderBy: { created_at: 'desc' },
    });

    const filtered = stores.filter((store) => {
      const nameMatch = store.name?.toLowerCase().includes(q);
      const descMatch = store.description?.toLowerCase().includes(q);
      const categoryMatch = store.category?.name?.toLowerCase().includes(q);
      return nameMatch || descMatch || categoryMatch;
    });

    res.json({ stores: filtered });
  } catch (err) {
    next(err);
  }
};

/* ============================ DELETE IMAGE ======================== */
export const deleteStoreImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const image = await prisma.image.findUnique({ where: { id: imageId } });
    if (!image) return res.status(404).json({ message: 'ไม่พบรูปภาพที่ต้องการลบ' });

    try {
      const urlParts = image.image_url.split('/');
      const publicId = urlParts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
      await cloudinary.uploader.destroy(publicId);
    } catch {}

    await prisma.image.delete({ where: { id: imageId } });
    res.json({ message: 'ลบรูปภาพสำเร็จ' });
  } catch (err) {
    next(err);
  }
};

/* ========================= UPDATE STORE ORDER ===================== */
export const updateStoreOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_id, order_number } = req.body;

    if (!category_id || order_number === undefined || order_number === null) {
      return res.status(400).json({ message: 'กรุณาระบุ category_id และ order_number' });
    }

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้านี้' });

    const newOrder = Number(order_number);
    const targetStore = await prisma.store.findFirst({
      where: { category_id, order_number: newOrder, id: { not: id } },
    });

    await prisma.$transaction(async (tx) => {
      if (targetStore) {
        await tx.store.update({ where: { id: targetStore.id }, data: { order_number: -1 } });
      }

      await tx.store.update({ where: { id }, data: { order_number: newOrder } });

      if (targetStore) {
        await tx.store.update({ where: { id: targetStore.id }, data: { order_number: store.order_number } });
      }
    });

    res.json({ message: 'สลับลำดับร้านเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('🔥 updateStoreOrder error:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({
        message: 'มีร้านค้าในหมวดหมู่นี้ใช้ลำดับนี้อยู่แล้ว กรุณาเลือกลำดับใหม่',
      });
    }
    next(err);
  }
};

/* ======================= RENEW ===================== */
// ✅ ต่ออายุแบบเพิ่มเดือน และ +1 ที่ renewal_count (DB) + alias กลับเป็น renew_count (API)
export const renewStore = async (req, res, next) => {
  try {
    const { id } = req.params;

    // months รับได้ทั้ง string/number
    const monthsRaw = req.body?.months;
    const months = Number(monthsRaw);
    if (!id) return res.status(400).json({ message: 'Missing store id' });
    if (!Number.isFinite(months) || months <= 0) {
      return res.status(400).json({ message: 'months must be a positive number' });
    }

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้านี้' });

    const now = new Date();
    const exp = safeNewDate(store.expired_at);
    const base = exp && exp > now ? exp : now;

    let nextExpire = new Date(base);
    if (months >= 600) {
      nextExpire.setFullYear(nextExpire.getFullYear() + 100); // ถือว่า lifetime
    } else {
      nextExpire.setMonth(nextExpire.getMonth() + months);
    }

    const updated = await prisma.store.update({
      where: { id },
      data: {
        expired_at: nextExpire,
        is_active: true,
        renewal_count: { increment: 1 },
      },
      select: {
        id: true,
        name: true,
        expired_at: true,
        is_active: true,
        renewal_count: true,
      },
    });

    return res.json({
      message: 'ต่ออายุสำเร็จ',
      store: {
        ...updated,
        renew_count: updated.renewal_count, // alias ให้ FE เก่าด้วย
      },
    });
  } catch (err) {
    console.error('🔥 RENEW STORE ERROR:', err);
    next(err);
  }
};
/* ======================= FEATURED (HOME) ===================== */
export const getFeaturedStores = async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12) || 12));
    const now = new Date();

    const stores = await prisma.store.findMany({
      where: {
        is_active: true,
        is_featured_home: true,
        OR: [{ featured_until: null }, { featured_until: { gte: now } }],
      },
      orderBy: [{ featured_order: "asc" }, { created_at: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        address: true,
        province: true,
        description: true,
        social_links: true,
        category_id: true,
        is_active: true,
        order_number: true,
        created_at: true,
        updated_at: true,
        expired_at: true,
        cover_image: true,

        is_featured_home: true,
        featured_order: true,
        featured_until: true,

        category: true,
        images: true,
        reviews: true,
        visitorCounter: true,
        renewal_count: true,
      },
    });

    const mapped = stores.map((s) => ({ ...s, renew_count: s.renewal_count }));
    return res.json({ stores: mapped });
  } catch (err) {
    next(err);
  }
};
/* ======================= REPORTS / STATS ===================== */
export const getPopularStores = async (_req, res, next) => {
  try {
    const stores = await prisma.store.findMany({
      include: { category: true, images: true, reviews: true },
    });

    const withAvgRating = stores
      .map((store) => {
        const total = store.reviews.length;
        const avg = total > 0 ? store.reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
        return { ...store, avg_rating: avg };
      })
      .filter((s) => s.avg_rating >= 4.0) // 4.0+
      .sort((a, b) => b.avg_rating - a.avg_rating);

    res.json({ stores: withAvgRating });
  } catch (err) {
    next(err);
  }
};

export const updateStoreCover = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพหน้าปกใหม่' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'store-covers' });
    await fs.unlink(req.file.path);

    const updated = await prisma.store.update({
      where: { id },
      data: { cover_image: result.secure_url },
    });

    res.json({ message: 'อัปเดตรูปภาพหน้าปกเรียบร้อย', store: updated });
  } catch (err) {
    console.error('🔥 updateStoreCover error:', err);
    next(err);
  }
};

export const getExpiringSoonStores = async (_req, res, next) => {
  try {
    const now = new Date();
    const next30Days = new Date();
    next30Days.setDate(now.getDate() + 30);

    const expiringStores = await prisma.store.findMany({
      where: {
        expired_at: { gte: now, lte: next30Days },
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        expired_at: true,
        category: { select: { name: true } },
      },
    });

    res.json({ stores: expiringStores });
  } catch (err) {
    next(err);
  }
};

// เปิดใช้งานอีกครั้งแบบกำหนดวันใหม่ตรงๆ (+1 renewal_count แล้ว map กลับ)
export const reactivateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_expired_at } = req.body;

    if (!new_expired_at) {
      return res.status(400).json({ message: 'กรุณาระบุวันหมดอายุใหม่' });
    }

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) return res.status(404).json({ message: 'ไม่พบร้านค้านี้' });

    const updated = await prisma.store.update({
      where: { id },
      data: {
        is_active: true,
        expired_at: new Date(new_expired_at),
        renewal_count: { increment: 1 },
      },
      select: {
        id: true,
        name: true,
        expired_at: true,
        is_active: true,
        renewal_count: true,
      },
    });

    res.json({
      message: 'เปิดใช้งานร้านอีกครั้งเรียบร้อย',
      store: {
        ...updated,
        renew_count: updated.renewal_count,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getExpiredStores = async (req, res, next) => {
  try {
    const now = new Date();
    const onlyInactive = String(req.query.onlyInactive || '').toLowerCase() === 'true';

    const where = onlyInactive
      ? { expired_at: { lte: now }, is_active: false }
      : { expired_at: { lte: now } };

    const expiredStores = await prisma.store.findMany({
      where,
      select: {
        id: true,
        name: true,
        expired_at: true,
        category: { select: { name: true } },
        renewal_count: true,
      },
    });

    res.json({
      stores: expiredStores.map(s => ({ ...s, renew_count: s.renewal_count })),
    });
  } catch (err) {
    next(err);
  }
};

export const getStoreLoyaltyStats = async (_req, res, next) => {
  try {
    const stores = await prisma.store.findMany({
      select: { id: true, name: true, created_at: true, renewal_count: true },
    });

    const now = new Date();
    const data = stores.map((store) => {
      const diffYears = (now - store.created_at) / (1000 * 60 * 60 * 24 * 365.25);
      return {
        id: store.id,
        name: store.name,
        created_at: store.created_at,
        renew_count: store.renewal_count, // map เป็นชื่อเดิมที่ FE ใช้
        years_with_us: parseFloat(diffYears.toFixed(1)),
      };
    });

    res.json({ stores: data });
  } catch (err) {
    next(err);
  }
};