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
  const socketUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? window.location.origin
    : 'http://127.0.0.1:5000';

  socket = io(socketUrl, {
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
