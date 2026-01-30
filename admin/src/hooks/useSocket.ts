/**
 * useSocket Hook
 * 
 * A React hook that provides easy access to socket functionality
 * and socket state from Redux store.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import {
  socketConnect,
  socketDisconnect,
  socketJoinRoom,
  socketLeaveRoom,
  socketSendMessage,
  socketTypingStart,
  socketTypingStop,
  socketMarkRead,
  socketEmit,
} from '../store/actions/socketActions';

export const useSocket = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socketState = useSelector((state: RootState) => state.socket);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && !socketState.isConnected && !socketState.isConnecting) {
      dispatch(socketConnect());
    }
  }, [isAuthenticated, socketState.isConnected, socketState.isConnecting, dispatch]);

  // Auto-disconnect when unauthenticated
  useEffect(() => {
    if (!isAuthenticated && socketState.isConnected) {
      dispatch(socketDisconnect());
    }
  }, [isAuthenticated, socketState.isConnected, dispatch]);

  return {
    // State
    isConnected: socketState.isConnected,
    isConnecting: socketState.isConnecting,
    error: socketState.error,
    joinedRooms: socketState.joinedRooms,
    messages: socketState.messages,
    conversations: socketState.conversations,
    unreadCounts: socketState.unreadCounts,
    typingUsers: socketState.typingUsers,
    onlineUsers: socketState.onlineUsers,

    // Actions
    connect: () => dispatch(socketConnect()),
    disconnect: () => dispatch(socketDisconnect()),
    emit: (event: string, data: any) => dispatch(socketEmit(event, data)),
    joinRoom: (conversationId: string) => dispatch(socketJoinRoom(conversationId)),
    leaveRoom: (conversationId: string) => dispatch(socketLeaveRoom(conversationId)),
    sendMessage: (conversationId: string, content: string, attachments?: any[]) => 
      dispatch(socketSendMessage(conversationId, content, attachments)),
    startTyping: (conversationId: string) => dispatch(socketTypingStart(conversationId)),
    stopTyping: (conversationId: string) => dispatch(socketTypingStop(conversationId)),
    markRead: (conversationId: string, messageId: string) => 
      dispatch(socketMarkRead(conversationId, messageId)),
  };
};

export default useSocket;

