// src/controllers/seo.controller.js
import { prisma } from "../lib/prisma.js";


/* ---------- utils ---------- */
function safeParseJson(x) {
  if (!x) return null;
  if (typeof x === 'object') return x;
  try { return JSON.parse(String(x)); } catch { return null; }
}
function normPath(p) {
  if (!p) return '/';
  let s = String(p).trim();
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1) s = s.replace(/\/+$/, ''); // ตัด '/' ท้าย ยกเว้น root
  return s;
}

/* ====== ขีดจำกัดตาม Prisma schema ====== */
const LIMITS = {
  PATH: 255,
  TITLE: 255,
  DESC: 512,
  OG: 512,
  KEYWORDS: 512,
};

/* ====== keywords utils ====== */
function normalizeKeywords(v) {
  if (!v) return '';
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');
}

/* เผื่อจะใช้ clamp ในอนาคต */
function clamp(str, max) {
  if (!str) return '';
  return String(str).slice(0, max);
}

/* ====== Admin: Global (SiteSeo) ====== */
export async function getSiteSeo(_req, res) {
  const site = await prisma.siteSeo.findUnique({ where: { id: 'global' } });
  res.json(site ?? {});
}

export async function upsertSiteSeo(req, res) {
  try {
    const { meta_title, meta_description, keywords, og_image, jsonld } = req.body ?? {};
    const jsonldParsed = safeParseJson(jsonld) || {};

    // normalize + validate keywords
    const normalized = normalizeKeywords(keywords);
    if (normalized && normalized.length > LIMITS.KEYWORDS) {
      return res.status(400).json({
        error: 'KEYWORDS_TOO_LONG',
        message: `keywords ยาวเกินกำหนด (สูงสุด ${LIMITS.KEYWORDS} ตัวอักษร รวมจุลภาคและช่องว่าง)`,
      });
    }

    // sync keywords ลง JSON-LD ถ้ามี
    if (typeof jsonldParsed === 'object' && jsonldParsed) {
      if (normalized) jsonldParsed.keywords = normalized;
    }

    // ความยาวฟิลด์อื่น (กัน dev เผลอส่งเกิน schema)
    const errs = [];
    if (meta_title && String(meta_title).length > LIMITS.TITLE) {
      errs.push(`meta_title เกิน ${LIMITS.TITLE}`);
    }
    if (meta_description && String(meta_description).length > LIMITS.DESC) {
      errs.push(`meta_description เกิน ${LIMITS.DESC}`);
    }
    if (og_image && String(og_image).length > LIMITS.OG) {
      errs.push(`og_image เกิน ${LIMITS.OG}`);
    }
    if (errs.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: errs });
    }

    const data = await prisma.siteSeo.upsert({
      where: { id: 'global' },
      create: { id: 'global', meta_title, meta_description, keywords: normalized, og_image, jsonld: jsonldParsed },
      update: {           meta_title, meta_description, keywords: normalized, og_image, jsonld: jsonldParsed },
    });
    res.json(data);
  } catch (err) {
    // ดัก Prisma P2000 แบบเจาะจงคอลัมน์
    if (err?.code === 'P2000') {
      const col = err?.meta?.column_name || '';
      const map = {
        keywords: LIMITS.KEYWORDS,
        meta_title: LIMITS.TITLE,
        meta_description: LIMITS.DESC,
        og_image: LIMITS.OG,
      };
      if (map[col]) {
        return res.status(400).json({
          error: 'FIELD_TOO_LONG',
          column: col,
          limit: map[col],
          message: `${col} ยาวเกินกำหนด (สูงสุด ${map[col]})`,
        });
      }
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err?.message || 'Unexpected error' });
  }
}

/* ====== Admin: Per Page (PageSeo) ====== */
export async function listPageSeo(_req, res) {
  const pages = await prisma.pageSeo.findMany({ orderBy: { updated_at: 'desc' }, take: 200 });
  res.json({ pages });
}

export async function getPageSeoByPath(req, res) {
  const path = normPath(req.query.path || '');
  if (!path) return res.status(400).json({ message: 'path is required' });
  const page = await prisma.pageSeo.findUnique({ where: { path } });
  if (!page) return res.status(404).json({ message: 'not found' });
  res.json(page);
}

export async function upsertPageSeo(req, res) {
  try {
    const { title, description, og_image, jsonld, noindex } = req.body ?? {};
    const path = normPath(req.body?.path);
    if (!path) return res.status(400).json({ message: 'path is required' });

    // validate length ก่อนชน DB
    const errs = [];
    if (path.length > LIMITS.PATH) errs.push(`path เกิน ${LIMITS.PATH}`);
    if (title && String(title).length > LIMITS.TITLE) errs.push(`title เกิน ${LIMITS.TITLE}`);
    if (description && String(description).length > LIMITS.DESC) errs.push(`description เกิน ${LIMITS.DESC}`);
    if (og_image && String(og_image).length > LIMITS.OG) errs.push(`og_image เกิน ${LIMITS.OG}`);
    if (errs.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: errs });
    }

    const jsonldParsed = safeParseJson(jsonld);

    const data = await prisma.pageSeo.upsert({
      where: { path },
      create: { path, title, description, og_image, jsonld: jsonldParsed, noindex: !!noindex },
      update: {       title, description, og_image, jsonld: jsonldParsed, noindex: !!noindex },
    });
    res.json(data);
  } catch (err) {
    if (err?.code === 'P2000') {
      const col = err?.meta?.column_name || '';
      const map = {
        path: LIMITS.PATH,
        title: LIMITS.TITLE,
        description: LIMITS.DESC,
        og_image: LIMITS.OG,
      };
      if (map[col]) {
        return res.status(400).json({
          error: 'FIELD_TOO_LONG',
          column: col,
          limit: map[col],
          message: `${col} ยาวเกินกำหนด (สูงสุด ${map[col]})`,
        });
      }
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err?.message || 'Unexpected error' });
  }
}

export async function deletePageSeo(req, res) {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ message: 'id is required' });
  await prisma.pageSeo.delete({ where: { id } });
  res.json({ ok: true });
}

/* ---------- Public SEO API (read-only, no auth) ---------- */
/* ✅ ปรับคีย์ให้ตรงกับที่ FE คาด (meta_title, meta_description, og_image) */
export async function getSitePublic() {
  const site = await prisma.siteSeo.findUnique({ where: { id: 'global' } });
  if (!site) return {};
  return {
    meta_title: site.meta_title || null,
    meta_description: site.meta_description || null,
    keywords: site.keywords || null,
    og_image: site.og_image || null,
    jsonld: site.jsonld || null,
  };
}

export async function getPagePublic(path) {
  const norm = normPath(path);
  const page = await prisma.pageSeo.findUnique({ where: { path: norm } });
  if (!page) return null;
  return {
    title: page.title || null,
    description: page.description || null,
    og_image: page.og_image || null,
    jsonld: page.jsonld || null,
    noindex: !!page.noindex,
  };
}


/* ---------- Public list of pages (read-only) ---------- */
// ✅ ดึงรายการ SEO ทุกเพจที่ "อนุญาต index" มาใช้แสดงหน้า /
export async function listPagesPublic() {
  const pages = await prisma.pageSeo.findMany({
    where: { noindex: false },
    select: {
      id: true,
      path: true,
      title: true,
      description: true,
      og_image: true,
      jsonld: true,        // ✅ เพิ่มบรรทัดนี้
      updated_at: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 500,
  });
  return pages;
}