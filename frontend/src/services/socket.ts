import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    console.warn('No access token found, cannot connect to chat server');
    return null;
  }

  if (!socket || !socket.connected) {
    // Use the full URL with namespace - Socket.IO will handle the /socket.io path automatically
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/chat'
      : `${window.location.protocol}//${window.location.host}/chat`;
    
    console.log('Connecting to Socket.IO server:', socketUrl);
    
    socket = io(socketUrl, {
      auth: {
        token: token,
      },
      query: {
        token: token, // Also send as query parameter as fallback
      },
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      forceNew: false,
      withCredentials: true,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to chat server');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, need to reconnect manually
        socket?.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const reconnectSocket = () => {
  disconnectSocket();
  return getSocket();
};

