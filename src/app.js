// src/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoute from "./routes/health.route.js";
import proxyImageRouter from "./routes/proxyImage.route.js";

import reviewRoutes from './routes/review.route.js';
import authRoute from './routes/auth.route.js';
import storeAdminRoute from './routes/admin/store.admin.route.js';
import categoryAdminRoute from './routes/admin/category.admin.route.js';
import userAdminRoute from './routes/admin/user.admin.route.js';
import publicStoreRoutes from './routes/public/store.public.route.js';
import publicCategoryRoutes from './routes/public/category.public.route.js';
import imageAdminRoute from './routes/admin/image.admin.route.js';
import visitorRoutes from './routes/visitor.routes.js';
import { startCronJobs } from './cron.js';

import bannerRoute from './routes/admin/banner.routes.js';
import publicBannerRoute from './routes/public/banner.public.routes.js';
import videoAdminRoute from './routes/admin/video.routes.js';
import searchPublicRoute from './routes/public/search.public.routes.js';
import seoAdminRoutes from './routes/admin/seo.routes.js';
import seoPublicRoutes from './routes/public/seo.public.route.js';
import adminTrackingRoutes from './routes/admin/tracking.admin.routes.js';
import publicTrackingRoutes from './routes/public/tracking.public.routes.js';

// ⬇⬇⬇ public videos route
import publicVideoRoutes from './routes/public/video.public.route.js';
import storeFeedbackAdminRoute from './routes/admin/storeFeedback.admin.route.js';
import storeFeedbackPublicRoute from './routes/public/storeFeedback.public.route.js';

const app = express();

/** CORS allow-list */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://10topawards.com',
  'https://www.10topawards.com',
  process.env.CORS_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // อนุญาตเครื่องมือ/งานเบื้องหลังที่ไม่มี header Origin
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health
app.use("/api/health", healthRoute);


// Admin/Public Routes
app.use('/api/admin/banners', bannerRoute);
app.use('/api/banners', publicBannerRoute);
app.use('/api/admin/stores', storeAdminRoute);
app.use('/api/admin/categories', categoryAdminRoute);
app.use('/api/users', userAdminRoute);
app.use('/api/auth', authRoute);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin/images', imageAdminRoute);
app.use('/api/admin/tracking', adminTrackingRoutes);
app.use('/api', publicTrackingRoutes);
app.use('/api/stores', publicStoreRoutes);
app.use('/api/categories', publicCategoryRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/admin/videos', videoAdminRoute);
app.use('/api/search', searchPublicRoute);
app.use('/api/admin/seo', seoAdminRoutes);
app.use('/api/public/seo', seoPublicRoutes);

app.use('/api/admin', storeFeedbackAdminRoute);
app.use('/api/public', storeFeedbackPublicRoute);

// public videos
app.use('/api/videos', publicVideoRoutes);
app.use("/api/public", proxyImageRouter);



// Cron
startCronJobs();

// GSI test page (optional)
app.get('/test/google', (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Google ID Token Test</title>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <script>
      function handleCredentialResponse(resp) {
        console.log('ID_TOKEN:', resp.credential);
        document.getElementById('out').textContent = resp.credential;
      }
    </script>
  </head>
  <body style="font-family: ui-sans-serif, system-ui">
    <h2>Google ID Token Test</h2>
    <p>ลงชื่อเข้าใช้แล้วคัดลอก ID Token ที่ด้านล่างไปใส่ใน Postman</p>
    <div id="g_id_onload"
      data-client_id="${process.env.GOOGLE_CLIENT_ID}"
      data-callback="handleCredentialResponse"
      data-auto_prompt="false"></div>
    <div class="g_id_signin" data-type="standard"></div>
    <pre id="out" style="margin-top:16px; padding:12px; border:1px solid #ddd; border-radius:8px; overflow:auto;"></pre>
  </body>
</html>
  `);
});

export default app;