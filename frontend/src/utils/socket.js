import { io } from 'socket.io-client';

let socket = null;

export function getSocket(token) {
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  // If already connected with same token
  if (socket && socket.connected) {
    return socket;
  }

  // If socket exists but disconnected or token changed
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  // Create new socket connection
  socket = io('http://127.0.0.1:5000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO Connection Warning]:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
