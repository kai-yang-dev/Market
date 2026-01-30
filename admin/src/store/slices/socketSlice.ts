import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: any[];
  createdAt: string;
  readAt?: string;
}

export interface Conversation {
  id: string;
  participants: any[];
  lastMessage?: Message;
  unreadCount?: number;
  updatedAt: string;
}

interface SocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  joinedRooms: string[];
  messages: Record<string, Message[]>; // conversationId -> messages
  conversations: Record<string, Conversation>;
  unreadCounts: Record<string, number>;
  typingUsers: Record<string, string[]>; // conversationId -> userIds
  onlineUsers: string[];
}

const initialState: SocketState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  joinedRooms: [],
  messages: {},
  conversations: {},
  unreadCounts: {},
  typingUsers: {},
  onlineUsers: [],
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    // Connection actions
    socketConnecting: (state) => {
      state.isConnecting = true;
      state.error = null;
    },
    socketConnected: (state) => {
      state.isConnected = true;
      state.isConnecting = false;
      state.error = null;
    },
    socketDisconnected: (state, action: PayloadAction<string | undefined>) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.error = action.payload || null;
      state.joinedRooms = [];
    },
    socketError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isConnecting = false;
    },

    // Room actions
    roomJoined: (state, action: PayloadAction<string>) => {
      if (!state.joinedRooms.includes(action.payload)) {
        state.joinedRooms.push(action.payload);
      }
    },
    roomLeft: (state, action: PayloadAction<string>) => {
      state.joinedRooms = state.joinedRooms.filter(room => room !== action.payload);
    },

    // Message actions
    messageReceived: (state, action: PayloadAction<Message>) => {
      const { conversationId } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      // Avoid duplicates
      const exists = state.messages[conversationId].some(msg => msg.id === action.payload.id);
      if (!exists) {
        state.messages[conversationId].push(action.payload);
      }
    },
    messageSent: (state, action: PayloadAction<Message>) => {
      const { conversationId } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      // Replace temp message or add new
      const tempIndex = state.messages[conversationId].findIndex(
        msg => msg.id === action.payload.id
      );
      if (tempIndex !== -1) {
        state.messages[conversationId][tempIndex] = action.payload;
      } else {
        state.messages[conversationId].push(action.payload);
      }
    },
    messagesLoaded: (state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) => {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },
    messageRead: (state, action: PayloadAction<{ messageId: string; conversationId: string; readAt: string }>) => {
      const { conversationId, messageId, readAt } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        const message = messages.find(msg => msg.id === messageId);
        if (message) {
          message.readAt = readAt;
        }
      }
    },

    // Conversation actions
    conversationUpdated: (state, action: PayloadAction<Conversation>) => {
      state.conversations[action.payload.id] = action.payload;
    },
    conversationsLoaded: (state, action: PayloadAction<Conversation[]>) => {
      action.payload.forEach(conv => {
        state.conversations[conv.id] = conv;
      });
    },

    // Unread count actions
    unreadCountUpdated: (state, action: PayloadAction<{ conversationId: string; count: number }>) => {
      state.unreadCounts[action.payload.conversationId] = action.payload.count;
    },
    unreadCountCleared: (state, action: PayloadAction<string>) => {
      state.unreadCounts[action.payload] = 0;
    },

    // Typing indicator actions
    userTyping: (state, action: PayloadAction<{ conversationId: string; userId: string }>) => {
      const { conversationId, userId } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      if (!state.typingUsers[conversationId].includes(userId)) {
        state.typingUsers[conversationId].push(userId);
      }
    },
    userStoppedTyping: (state, action: PayloadAction<{ conversationId: string; userId: string }>) => {
      const { conversationId, userId } = action.payload;
      if (state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
          id => id !== userId
        );
      }
    },

    // Online status actions
    userOnline: (state, action: PayloadAction<string>) => {
      if (!state.onlineUsers.includes(action.payload)) {
        state.onlineUsers.push(action.payload);
      }
    },
    userOffline: (state, action: PayloadAction<string>) => {
      state.onlineUsers = state.onlineUsers.filter(id => id !== action.payload);
    },
    onlineUsersUpdated: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = action.payload;
    },

    // Clear state
    clearSocketState: () => {
      return initialState;
    },
  },
});

export const {
  socketConnecting,
  socketConnected,
  socketDisconnected,
  socketError,
  roomJoined,
  roomLeft,
  messageReceived,
  messageSent,
  messagesLoaded,
  messageRead,
  conversationUpdated,
  conversationsLoaded,
  unreadCountUpdated,
  unreadCountCleared,
  userTyping,
  userStoppedTyping,
  userOnline,
  userOffline,
  onlineUsersUpdated,
  clearSocketState,
} = socketSlice.actions;

export default socketSlice.reducer;

