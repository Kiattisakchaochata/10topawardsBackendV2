// src/routes/proxyImage.route.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const ALLOW_HOSTS = [
  "tiktokcdn-us.com",
  "tiktokcdn.com",
  "tiktokcdn-eu.com",
  "tiktokcdn-asia.com",
  "tiktok.com",
  "ttwstatic.com",
  "img.youtube.com",
  "ytimg.com",
];

const FALLBACK_IMAGE_PATH = "/og-image.jpg";

function isAllowed(url) {
  try {
    const u = new URL(url);
    const ok =
      (u.protocol === "http:" || u.protocol === "https:") &&
      ALLOW_HOSTS.some((h) => u.hostname.endsWith(h));

    if (!ok) {
      console.warn("[proxy-image] blocked host:", u.hostname, "for url:", url);
    }

    return ok;
  } catch (e) {
    console.warn("[proxy-image] invalid url:", url, e?.message);
    return false;
  }
}

// ใช้ handler เดียวรองรับได้หลาย path
async function handleProxy(req, res) {
  const u = req.query.u;
  console.log("[proxy-image] hit", {
    path: req.path,
    u,
  });

  if (!u) {
    return res.status(400).json({ error: "missing query param 'u'" });
  }
  if (!isAllowed(u)) {
    return res.status(403).json({ error: "blocked host" });
  }

  try {
    console.log("[proxy-image] fetching upstream:", u);
    const r = await fetch(u, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        referer: "https://www.tiktok.com/",
        origin: "https://www.tiktok.com",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    console.log("[proxy-image] upstream status:", r.status);

    if (!r.ok) {
      console.warn(`[proxy-image] upstream error ${r.status} from ${u}`);

      // ถ้า TikTok / YouTube ตอบ 403 หรือ 404 → ส่งรูป fallback ให้เลย
      if (r.status === 403 || r.status === 404) {
        console.log("[proxy-image] using fallback image:", FALLBACK_IMAGE_PATH);
        return res.redirect(302, FALLBACK_IMAGE_PATH);
        // ถ้าอยากไม่ redirect แต่ส่งไฟล์จาก backend เอง:
        // return res.sendFile(path.resolve("public/og-image.jpg"));
      }

      return res.status(r.status).send("upstream error");
    }

    res.setHeader("Content-Type", r.headers.get("content-type") || "image/*");
    res.setHeader("Cache-Control", "public, max-age=86400");

    r.body.pipe(res);
  } catch (err) {
    console.error("proxy-image error:", err);
    res.status(500).json({ error: "proxy failed" });
  }
}

// ✅ รับได้ทั้ง /proxy/image และ /public/proxy/image
router.get("/proxy/image", handleProxy);
router.get("/public/proxy/image", handleProxy);

export default router;