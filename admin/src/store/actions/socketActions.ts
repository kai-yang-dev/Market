// Socket action types with special prefix for middleware
export const SOCKET_CONNECT = 'socket/connect';
export const SOCKET_DISCONNECT = 'socket/disconnect';
export const SOCKET_EMIT = 'socket/emit';
export const SOCKET_JOIN_ROOM = 'socket/joinRoom';
export const SOCKET_LEAVE_ROOM = 'socket/leaveRoom';
export const SOCKET_SEND_MESSAGE = 'socket/sendMessage';
export const SOCKET_TYPING_START = 'socket/typingStart';
export const SOCKET_TYPING_STOP = 'socket/typingStop';
export const SOCKET_MARK_READ = 'socket/markRead';

// Action creators
export const socketConnect = () => ({
  type: SOCKET_CONNECT,
});

export const socketDisconnect = () => ({
  type: SOCKET_DISCONNECT,
});

export const socketEmit = (event: string, data: any) => ({
  type: SOCKET_EMIT,
  payload: { event, data },
});

export const socketJoinRoom = (conversationId: string) => ({
  type: SOCKET_JOIN_ROOM,
  payload: { conversationId },
});

export const socketLeaveRoom = (conversationId: string) => ({
  type: SOCKET_LEAVE_ROOM,
  payload: { conversationId },
});

export const socketSendMessage = (conversationId: string, content: string, attachments?: any[]) => ({
  type: SOCKET_SEND_MESSAGE,
  payload: { conversationId, content, attachments },
});

export const socketTypingStart = (conversationId: string) => ({
  type: SOCKET_TYPING_START,
  payload: { conversationId },
});

export const socketTypingStop = (conversationId: string) => ({
  type: SOCKET_TYPING_STOP,
  payload: { conversationId },
});

export const socketMarkRead = (conversationId: string, messageId: string) => ({
  type: SOCKET_MARK_READ,
  payload: { conversationId, messageId },
});

