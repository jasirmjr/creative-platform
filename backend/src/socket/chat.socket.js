const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initChatSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow connections from frontend dev server
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing.'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRole = socket.user.role;
    // Join personal notification room
    socket.join(`user:${userId}`);

    // Join admin broadcast room for administrative alerts and vendor chat
    if (userRole === 'admin' || userRole === 'super_admin') {
      socket.join('role:admin');
    }

    // Join specific active conversation room
    socket.on('join_conversation', ({ conversation_id }) => {
      if (conversation_id) {
        socket.join(`conv:${conversation_id}`);
      }
    });

    // Leave active conversation room
    socket.on('leave_conversation', ({ conversation_id }) => {
      if (conversation_id) {
        socket.leave(`conv:${conversation_id}`);
      }
    });

    // Real-time typing indicators
    socket.on('typing', ({ conversation_id, user_name }) => {
      if (conversation_id) {
        socket.to(`conv:${conversation_id}`).emit('user_typing', {
          conversation_id,
          user_id: userId,
          user_name: user_name || 'User',
        });
      }
    });

    socket.on('stop_typing', ({ conversation_id }) => {
      if (conversation_id) {
        socket.to(`conv:${conversation_id}`).emit('user_stop_typing', {
          conversation_id,
          user_id: userId,
        });
      }
    });

    socket.on('disconnect', () => {
      // Automatic cleanup handled by socket.io
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    return null;
  }
  return io;
}

module.exports = {
  initChatSocket,
  getIO,
};
