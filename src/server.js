// /var/www/10topawards/backend/src/server.js
import 'dotenv/config';
import app from './app.js';
import shutdown from './utils/shutdown.util.js';

const HOST = process.env.HOST || '127.0.0.1';   // ให้ Nginx ต่อเข้ามาที่ 127.0.0.1
const PORT = Number(process.env.PORT || 8900);

// ==== start server ==========================================================
const server = app
  .listen(PORT, HOST, () => {
    console.log(`[api] listening on http://${HOST}:${PORT} (pid: ${process.pid})`);
  })
  .on('error', onError);

// ปรับ timeout ให้เข้ากับ proxy/Nginx เพื่อลด 502 ระหว่างโหลดช้า ๆ
server.keepAliveTimeout = 65_000;  // default 5s → เพิ่มเป็น 65s
server.headersTimeout   = 66_000;  // ต้องมากกว่า keepAliveTimeout เล็กน้อย
server.requestTimeout   = 65_000;  // ป้องกันการค้างนานเกินไป

// ==== graceful shutdown =====================================================
const stop = (reason) => {
  console.error(`[api] stopping due to: ${reason}`);
  shutdown(reason, server);
};

process.on('SIGINT',  () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[api] Uncaught Exception:', err);
  stop('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[api] Unhandled Rejection:', reason, 'at', promise);
  stop('unhandledRejection');
});

// ==== helpers ===============================================================
function onError(err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] Port ${PORT} already in use`);
  } else if (err.code === 'EACCES') {
    console.error(`[api] Port ${PORT} requires elevated privileges`);
  } else {
    console.error('[api] Server error:', err);
  }
  process.exit(1);
}