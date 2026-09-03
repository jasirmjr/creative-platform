require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});

// Process-level exception guards to prevent unexpected exit
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

// Keep event loop active
setInterval(() => {}, 60000);