require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initChatSocket } = require('./src/socket/chat.socket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initChatSocket(server);

server.listen(PORT, '0.0.0.0', () => {
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