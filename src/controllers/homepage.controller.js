// backend/src/controllers/homepage.controller.js
import prisma from '../config/prisma.config.js'

// ===== Length limits & helpers (วางต่อจาก import) =====
const HOMEPAGE_LIMITS = {
  hero_title: 255,
  hero_subtitle: 255,
  missions_subtitle: 255,
};

function safeCut(str, max) {
  if (str == null) return str;
  const arr = [...String(str)];
  return arr.length > max ? arr.slice(0, max).join('') : str;
}

function pushIfTooLong(label, val, max, errors) {
  if (val === undefined || val === null) return;
  const len = [...String(val)].length;
  if (len > max) errors.push(`${label} ยาว ${len} ตัวอักษร (เกิน ${max})`);
}

/** Public: ใช้หน้าเว็บเรียก */
// ---------- Public: หน้าเว็บเรียก ----------
export const getHomepagePublic = async (_req, res, next) => {
  try {
    const h = await prisma.homepage.findUnique({ where: { id: 'default' } })

    // --- network logos -> storesMini ---
    const row = await prisma.homeRow.findFirst({
      where: { kind: 'network', visible: true },
      orderBy: { order_number: 'asc' },
    })

    let storesMini = []
    if (row && Array.isArray(row.store_ids) && row.store_ids.length) {
      const containIds = (row?.images && typeof row.images === 'object' && !Array.isArray(row.images))
   ? (row.images.containIds || [])
   : []const containIds = row.images?.containIds ?? []
      const stores = await prisma.store.findMany({
        where: { id: { in: row.store_ids } },
        select: { id: true, name: true, slug: true, logo_url: true, cover_image: true },
      })
      storesMini = stores.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        logo: s.logo_url || s.cover_image || null,
        contain: containIds.includes(s.id),
      }))
    }

    // 👇 อ่าน subtitle จาก missions JSON เท่านั้น (ไม่ใช้ missions_subtitle แล้ว)
    const missionSub =
      (h?.missions && typeof h.missions === 'object' && !Array.isArray(h.missions) && h.missions.subtitle) || null

    const items = Array.isArray(h?.missions) ? h.missions : (h?.missions?.items ?? [])

    const payload = {
      hero: {
        title: h?.hero_title ?? null,
        subtitle: h?.hero_subtitle ?? null,
        showSearch: false,
      },
      missions: items,
      missionsSubtitle: missionSub,
      rows: Array.isArray(h?.rows) ? h.rows : [],
      storesMini,
      updatedAt: h?.updated_at?.toISOString?.() ?? new Date().toISOString(),
    }

    res.json(payload)
  } catch (err) {
    next(err)
  }
}

// ---------- Admin: อ่านค่าเดิม ----------
export const getHomepageAdmin = async (_req, res, next) => {
  try {
    const h = await prisma.homepage.findUnique({ where: { id: 'default' } })
    res.json(h ?? {})
  } catch (err) { next(err) }
}

// ---------- Admin: บันทึก ----------
export const updateHomepageAdmin = async (req, res, next) => {
  try {
    const { hero_title, hero_subtitle, missions, missions_subtitle, rows } = req.body
    const rowsArray = Array.isArray(rows) ? rows : []

    // รองรับทั้งแบบส่งมาเป็น array หรือ object {subtitle, items}
    let subtitle = typeof missions_subtitle === 'string' ? missions_subtitle : ''
    let items = []

    if (Array.isArray(missions)) {
      items = missions
    } else if (missions && typeof missions === 'object') {
      if (Array.isArray(missions.items)) items = missions.items
      if (!subtitle && typeof missions.subtitle === 'string') subtitle = missions.subtitle
    }

    // ✅ เก็บเป็น JSON เดียวในคอลัมน์ missions
    const missionsJson = { subtitle: subtitle || null, items }

    // ===== Sanitize lengths (auto-truncate) — วางบล็อกนี้ก่อน upsert =====
    {
      if (typeof hero_title === 'string') {
        req.body.hero_title = safeCut(hero_title, HOMEPAGE_LIMITS.hero_title);
      }
      if (typeof hero_subtitle === 'string') {
        req.body.hero_subtitle = safeCut(hero_subtitle, HOMEPAGE_LIMITS.hero_subtitle);
      }
      if (typeof subtitle === 'string') {
        subtitle = safeCut(subtitle, HOMEPAGE_LIMITS.missions_subtitle);
      }
    }

    const updated = await prisma.homepage.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        hero_title: req.body.hero_title ?? null,
        hero_subtitle: req.body.hero_subtitle ?? null,
        missions: { ...missionsJson, subtitle },
        rows: rows ?? [],
        rows: rowsArray,
      },
      update: {
        hero_title: req.body.hero_title ?? null,
        hero_subtitle: req.body.hero_subtitle ?? null,
        missions: { ...missionsJson, subtitle },
        rows: rows ?? [],
        rows: rowsArray,
      },
    })

    res.json({ message: 'บันทึกแล้ว', homepage: updated })
  } catch (err) { next(err) }
}