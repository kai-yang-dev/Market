/**
 * Socket Service - Redux Integration Layer
 * 
 * This service provides a clean API for components to interact with the socket
 * through Redux actions. It replaces the old socket.ts direct connection approach.
 */

import { store } from '../store/store';
import {
  socketConnect,
  socketDisconnect,
  socketEmit,
  socketJoinRoom,
  socketLeaveRoom,
  socketSendMessage,
  socketTypingStart,
  socketTypingStop,
  socketMarkRead,
} from '../store/actions/socketActions';
import { getSocketInstance } from '../store/middleware/socketMiddleware';

/**
 * Initialize socket connection
 */
export const connectSocket = () => {
  store.dispatch(socketConnect());
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  store.dispatch(socketDisconnect());
};

/**
 * Emit a generic socket event
 */
export const emitSocketEvent = (event: string, data: any) => {
  store.dispatch(socketEmit(event, data));
};

/**
 * Join a conversation room
 */
export const joinConversation = (conversationId: string) => {
  store.dispatch(socketJoinRoom(conversationId));
};

/**
 * Leave a conversation room
 */
export const leaveConversation = (conversationId: string) => {
  store.dispatch(socketLeaveRoom(conversationId));
};

/**
 * Send a message in a conversation
 */
export const sendMessage = (conversationId: string, content: string, attachments?: any[]) => {
  store.dispatch(socketSendMessage(conversationId, content, attachments));
};

/**
 * Start typing indicator in a conversation
 */
export const startTyping = (conversationId: string) => {
  store.dispatch(socketTypingStart(conversationId));
};

/**
 * Stop typing indicator in a conversation
 */
export const stopTyping = (conversationId: string) => {
  store.dispatch(socketTypingStop(conversationId));
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = (conversationId: string, messageId: string) => {
  store.dispatch(socketMarkRead(conversationId, messageId));
};

/**
 * Get current socket instance (for advanced use cases)
 * @returns Socket instance or null if not connected
 */
export const getSocket = () => {
  return getSocketInstance();
};

/**
 * Check if socket is connected
 */
export const isSocketConnected = (): boolean => {
  const state = store.getState();
  return state.socket.isConnected;
};

/**
 * Get socket connection status
 */
export const getSocketStatus = () => {
  const state = store.getState();
  return {
    isConnected: state.socket.isConnected,
    isConnecting: state.socket.isConnecting,
    error: state.socket.error,
  };
};

// Export default for backward compatibility
export default {
  connectSocket,
  disconnectSocket,
  emitSocketEvent,
  joinConversation,
  leaveConversation,
  sendMessage,
  startTyping,
  stopTyping,
  markMessageAsRead,
  getSocket,
  isSocketConnected,
  getSocketStatus,
};

