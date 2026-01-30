import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { io, Socket } from 'socket.io-client';
import {
  socketConnecting,
  socketConnected,
  socketDisconnected,
  socketError,
  roomJoined,
  roomLeft,
  messageReceived,
  messageSent,
  messageRead,
  conversationUpdated,
  unreadCountUpdated,
  userTyping,
  userStoppedTyping,
  userOnline,
  userOffline,
  onlineUsersUpdated,
  clearSocketState,
} from '../slices/socketSlice';
import {
  SOCKET_CONNECT,
  SOCKET_DISCONNECT,
  SOCKET_EMIT,
  SOCKET_JOIN_ROOM,
  SOCKET_LEAVE_ROOM,
  SOCKET_SEND_MESSAGE,
  SOCKET_TYPING_START,
  SOCKET_TYPING_STOP,
  SOCKET_MARK_READ,
} from '../actions/socketActions';
import { logout } from '../slices/authSlice';

let socket: Socket | null = null;
let lastToken: string | null = null;

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

const createSocket = (token: string): Socket => {
  const socketUrl = `${SOCKET_BASE_URL}/chat`;
  
  console.log('🔌 Creating Socket.IO connection:', socketUrl);
  
  return io(socketUrl, {
    auth: { token },
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false,
    withCredentials: true,
    autoConnect: true,
    upgrade: true,
  });
};

const socketMiddleware: Middleware = (store) => {
  return (next) => (action: AnyAction) => {
    const { type, payload } = action;

    // Handle socket connect action
    if (type === SOCKET_CONNECT) {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.warn('❌ No access token found, cannot connect to socket');
        store.dispatch(socketError('No access token available'));
        return next(action);
      }

      // If token changed, disconnect old socket
      if (lastToken && lastToken !== token && socket) {
        console.log('🔄 Token changed, reconnecting socket');
        socket.disconnect();
        socket = null;
      }
      lastToken = token;

      // Don't create new socket if already connected
      if (socket?.connected) {
        console.log('✅ Socket already connected');
        return next(action);
      }

      store.dispatch(socketConnecting());

      // Create new socket
      socket = createSocket(token);

      // Connection event handlers
      socket.on('connect', () => {
        console.log('✅ Socket connected');
        store.dispatch(socketConnected());
        
        // Update token on successful connection
        const currentToken = localStorage.getItem('accessToken');
        if (currentToken) {
          lastToken = currentToken;
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        store.dispatch(socketDisconnected(reason));

        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect with latest token
          const tokenNow = localStorage.getItem('accessToken');
          if (tokenNow && socket && !socket.connected) {
            socket.auth = { token: tokenNow };
            lastToken = tokenNow;
            if (socket.disconnected) {
              socket.connect();
            }
          }
        }
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
        store.dispatch(socketConnected());
        
        // Update auth with latest token
        const currentToken = localStorage.getItem('accessToken');
        if (currentToken && socket) {
          lastToken = currentToken;
          socket.auth = { token: currentToken };
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
        store.dispatch(socketError(error.message));

        if (String(error?.message || '').toLowerCase().includes('jwt expired')) {
          store.dispatch(logout());
          window.dispatchEvent(new CustomEvent('auth-expired', { 
            detail: { reason: 'jwt_expired' } 
          }));
        }
      });

      socket.on('auth_error', (data: any) => {
        console.warn('⚠️ Socket auth error:', data?.reason);
        store.dispatch(socketError(data?.reason || 'Authentication error'));

        if (data?.reason === 'jwt_expired' || data?.reason === 'invalid_token') {
          store.dispatch(logout());
          window.dispatchEvent(new CustomEvent('auth-expired', { 
            detail: { reason: data.reason } 
          }));
        }
      });

      socket.on('error', (error: any) => {
        console.error('❌ Socket error:', error);
        store.dispatch(socketError(error?.message || 'Socket error'));

        if (error?.message && String(error.message).toLowerCase().includes('not authenticated')) {
          const currentToken = localStorage.getItem('accessToken');
          if (currentToken && socket) {
            socket.auth = { token: currentToken };
            lastToken = currentToken;
          } else {
            store.dispatch(logout());
          }
        }
      });

      // Message event handlers
      socket.on('new_message', (message: any) => {
        console.log('📨 New message received:', message);
        store.dispatch(messageReceived(message));
      });

      socket.on('message_sent', (message: any) => {
        console.log('✉️ Message sent confirmed:', message);
        store.dispatch(messageSent(message));
      });

      socket.on('message_read', (data: any) => {
        console.log('✓ Message read:', data);
        store.dispatch(messageRead(data));
      });

      // Conversation event handlers
      socket.on('conversation_updated', (conversation: any) => {
        console.log('💬 Conversation updated:', conversation);
        store.dispatch(conversationUpdated(conversation));
      });

      socket.on('unread_count', (data: any) => {
        console.log('🔔 Unread count updated:', data);
        store.dispatch(unreadCountUpdated(data));
      });

      // Typing indicator handlers
      socket.on('user_typing', (data: any) => {
        console.log('✍️ User typing:', data);
        store.dispatch(userTyping(data));
      });

      socket.on('user_stopped_typing', (data: any) => {
        console.log('✋ User stopped typing:', data);
        store.dispatch(userStoppedTyping(data));
      });

      // Online status handlers
      socket.on('user_online', (userId: string) => {
        console.log('🟢 User online:', userId);
        store.dispatch(userOnline(userId));
      });

      socket.on('user_offline', (userId: string) => {
        console.log('🔴 User offline:', userId);
        store.dispatch(userOffline(userId));
      });

      socket.on('online_users', (userIds: string[]) => {
        console.log('👥 Online users:', userIds);
        store.dispatch(onlineUsersUpdated(userIds));
      });

      return next(action);
    }

    // Handle socket disconnect action
    if (type === SOCKET_DISCONNECT) {
      if (socket) {
        console.log('🔌 Disconnecting socket');
        socket.disconnect();
        socket = null;
        lastToken = null;
      }
      store.dispatch(clearSocketState());
      return next(action);
    }

    // Handle generic socket emit action
    if (type === SOCKET_EMIT) {
      if (socket?.connected) {
        console.log(`📤 Emitting socket event: ${payload.event}`, payload.data);
        socket.emit(payload.event, payload.data);
      } else {
        console.warn('⚠️ Socket not connected, cannot emit event:', payload.event);
      }
      return next(action);
    }

    // Handle join room action
    if (type === SOCKET_JOIN_ROOM) {
      if (socket?.connected) {
        const { conversationId } = payload;
        console.log('🚪 Joining conversation:', conversationId);
        socket.emit('join_conversation', { conversationId });
        store.dispatch(roomJoined(conversationId));
      } else {
        console.warn('⚠️ Socket not connected, cannot join room');
      }
      return next(action);
    }

    // Handle leave room action
    if (type === SOCKET_LEAVE_ROOM) {
      if (socket?.connected) {
        const { conversationId } = payload;
        console.log('🚪 Leaving conversation:', conversationId);
        socket.emit('leave_conversation', { conversationId });
        store.dispatch(roomLeft(conversationId));
      }
      return next(action);
    }

    // Handle send message action
    if (type === SOCKET_SEND_MESSAGE) {
      if (socket?.connected) {
        const { conversationId, content, attachments } = payload;
        console.log('📤 Sending message:', { conversationId, content });
        socket.emit('send_message', { conversationId, content, attachments });
      } else {
        console.warn('⚠️ Socket not connected, cannot send message');
      }
      return next(action);
    }

    // Handle typing start action
    if (type === SOCKET_TYPING_START) {
      if (socket?.connected) {
        const { conversationId } = payload;
        socket.emit('typing_start', { conversationId });
      }
      return next(action);
    }

    // Handle typing stop action
    if (type === SOCKET_TYPING_STOP) {
      if (socket?.connected) {
        const { conversationId } = payload;
        socket.emit('typing_stop', { conversationId });
      }
      return next(action);
    }

    // Handle mark read action
    if (type === SOCKET_MARK_READ) {
      if (socket?.connected) {
        const { conversationId, messageId } = payload;
        socket.emit('mark_read', { conversationId, messageId });
      }
      return next(action);
    }

    // Handle logout action - disconnect socket
    if (type === 'auth/logout') {
      if (socket) {
        console.log('🔌 Logging out, disconnecting socket');
        socket.disconnect();
        socket = null;
        lastToken = null;
      }
      store.dispatch(clearSocketState());
    }

    return next(action);
  };
};

export default socketMiddleware;

// Export for external use if needed
export const getSocketInstance = () => socket;

