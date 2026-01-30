# Socket Redux Implementation - Quick Reference

## Quick Start

### 1. Import the Hook
```typescript
import { useSocket } from '../hooks/useSocket';
```

### 2. Use in Component
```typescript
function MyComponent() {
  const socket = useSocket();
  
  // Socket auto-connects when user is authenticated
  // Access state and actions directly from socket object
}
```

## useSocket Hook API

### State Properties
```typescript
const socket = useSocket();

socket.isConnected        // boolean - Connection status
socket.isConnecting       // boolean - Connection in progress
socket.error              // string | null - Last error
socket.joinedRooms        // string[] - Joined conversation IDs
socket.messages           // Record<string, Message[]> - Messages by conversation
socket.conversations      // Record<string, Conversation> - Conversations data
socket.unreadCounts       // Record<string, number> - Unread counts
socket.typingUsers        // Record<string, string[]> - Typing users per conversation
socket.onlineUsers        // string[] - Online user IDs
```

### Action Methods
```typescript
const socket = useSocket();

// Connection
socket.connect()          // Connect to socket server
socket.disconnect()       // Disconnect from socket server

// Rooms
socket.joinRoom(conversationId)           // Join conversation
socket.leaveRoom(conversationId)          // Leave conversation

// Messages
socket.sendMessage(conversationId, content, attachments?)  // Send message
socket.markRead(conversationId, messageId)                 // Mark as read

// Typing
socket.startTyping(conversationId)       // Start typing indicator
socket.stopTyping(conversationId)        // Stop typing indicator

// Custom events
socket.emit(event, data)                 // Emit custom event
```

## Socket Service API (Non-React)

```typescript
import socketService from '../services/socketService';

// Connection
socketService.connectSocket()
socketService.disconnectSocket()

// Rooms
socketService.joinConversation(conversationId)
socketService.leaveConversation(conversationId)

// Messages
socketService.sendMessage(conversationId, content, attachments?)
socketService.markMessageAsRead(conversationId, messageId)

// Typing
socketService.startTyping(conversationId)
socketService.stopTyping(conversationId)

// Status
socketService.isSocketConnected()        // Returns boolean
socketService.getSocketStatus()          // Returns {isConnected, isConnecting, error}
socketService.getSocket()                // Returns socket instance

// Custom
socketService.emitSocketEvent(event, data)
```

## Redux Actions

```typescript
import { useDispatch } from 'react-redux';
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

const dispatch = useDispatch();

// Dispatch actions
dispatch(socketConnect());
dispatch(socketJoinRoom('conv-123'));
dispatch(socketSendMessage('conv-123', 'Hello!'));
dispatch(socketTypingStart('conv-123'));
dispatch(socketMarkRead('conv-123', 'msg-456'));
```

## Redux Selectors

```typescript
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

// Select socket state
const isConnected = useSelector((state: RootState) => state.socket.isConnected);
const messages = useSelector((state: RootState) => state.socket.messages);
const conversations = useSelector((state: RootState) => state.socket.conversations);
const onlineUsers = useSelector((state: RootState) => state.socket.onlineUsers);

// Select specific conversation messages
const conversationMessages = useSelector((state: RootState) => 
  state.socket.messages[conversationId] || []
);

// Select typing users for conversation
const typingUsers = useSelector((state: RootState) => 
  state.socket.typingUsers[conversationId] || []
);
```

## Common Patterns

### Auto-Join Conversation on Mount
```typescript
const socket = useSocket();
const { id } = useParams();

useEffect(() => {
  if (socket.isConnected && id) {
    socket.joinRoom(id);
  }
  return () => {
    if (id) socket.leaveRoom(id);
  };
}, [socket.isConnected, id]);
```

### Display Messages
```typescript
const socket = useSocket();
const messages = socket.messages[conversationId] || [];

return (
  <div>
    {messages.map(msg => (
      <div key={msg.id}>
        {msg.content}
        {msg.readAt && <span>✓</span>}
      </div>
    ))}
  </div>
);
```

### Send Message
```typescript
const socket = useSocket();

const handleSend = (content: string) => {
  socket.sendMessage(conversationId, content);
};
```

### Typing Indicator
```typescript
const socket = useSocket();
const typingTimeoutRef = useRef<NodeJS.Timeout>();

const handleTyping = () => {
  socket.startTyping(conversationId);
  
  // Auto-stop after 3 seconds
  clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    socket.stopTyping(conversationId);
  }, 3000);
};

// Display typing users
const typingUsers = socket.typingUsers[conversationId] || [];
{typingUsers.length > 0 && <div>Typing...</div>}
```

### Connection Status
```typescript
const socket = useSocket();

return (
  <div>
    {socket.isConnecting && 'Connecting...'}
    {socket.isConnected && 'Connected'}
    {!socket.isConnected && !socket.isConnecting && 'Disconnected'}
    {socket.error && `Error: ${socket.error}`}
  </div>
);
```

### Online Status
```typescript
const socket = useSocket();
const isUserOnline = socket.onlineUsers.includes(userId);

return (
  <div>
    <span className={isUserOnline ? 'online' : 'offline'}>
      {isUserOnline ? '🟢' : '🔴'}
    </span>
  </div>
);
```

### Mark Messages as Read
```typescript
const socket = useSocket();

useEffect(() => {
  // Mark all messages as read when conversation is viewed
  const messages = socket.messages[conversationId] || [];
  messages.forEach(msg => {
    if (!msg.readAt) {
      socket.markRead(conversationId, msg.id);
    }
  });
}, [conversationId, socket.messages]);
```

## Data Types

### Message
```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: any[];
  createdAt: string;
  readAt?: string;
}
```

### Conversation
```typescript
interface Conversation {
  id: string;
  participants: any[];
  lastMessage?: Message;
  unreadCount?: number;
  updatedAt: string;
}
```

## Socket Events (Auto-Handled by Middleware)

These events are automatically handled by the middleware and update Redux state:

| Event | Description | Redux Action |
|-------|-------------|--------------|
| `connect` | Socket connected | `socketConnected` |
| `disconnect` | Socket disconnected | `socketDisconnected` |
| `reconnect` | Socket reconnected | `socketConnected` |
| `new_message` | New message received | `messageReceived` |
| `message_sent` | Message sent confirmation | `messageSent` |
| `message_read` | Message read by recipient | `messageRead` |
| `conversation_updated` | Conversation data changed | `conversationUpdated` |
| `unread_count` | Unread count updated | `unreadCountUpdated` |
| `user_typing` | User started typing | `userTyping` |
| `user_stopped_typing` | User stopped typing | `userStoppedTyping` |
| `user_online` | User came online | `userOnline` |
| `user_offline` | User went offline | `userOffline` |
| `online_users` | List of online users | `onlineUsersUpdated` |
| `auth_error` | Authentication error | Logout triggered |
| `connect_error` | Connection error | `socketError` |

## Configuration

### Environment Variables
```bash
# .env file (both frontend and admin)
VITE_SOCKET_URL=http://localhost:3000
```

### Store Configuration
```typescript
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import socketReducer from './slices/socketSlice';
import socketMiddleware from './middleware/socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    socket: socketReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['socket/emit', 'socket/sendMessage'],
        ignoredPaths: ['socket.messages', 'socket.conversations'],
      },
    }).concat(socketMiddleware),
});
```

## Debugging

### Redux DevTools
View all socket actions in Redux DevTools:
- Filter by "socket/" to see only socket actions
- Check state.socket for current socket state
- Monitor action dispatch for debugging

### Console Logs
The middleware logs all socket events with emojis:
- 🔌 Connection events
- ✅ Successful operations
- ❌ Errors
- 📨 Messages
- 🚪 Room join/leave
- ✍️ Typing indicators
- 🟢 User online
- 🔴 User offline

### Check Connection Status
```typescript
// In component
const socket = useSocket();
console.log('Connected:', socket.isConnected);
console.log('Error:', socket.error);

// Outside component
import socketService from '../services/socketService';
console.log('Status:', socketService.getSocketStatus());
```

## Best Practices

1. ✅ Use `useSocket()` hook in React components
2. ✅ Use `socketService` for non-React code
3. ✅ Let the hook auto-connect (it connects when authenticated)
4. ✅ Access messages from Redux state
5. ✅ Use typed actions instead of raw socket.emit
6. ✅ Clean up rooms in useEffect return
7. ❌ Don't manually manage socket connection
8. ❌ Don't use raw socket instance unless necessary
9. ❌ Don't create multiple socket connections
10. ❌ Don't forget to leave rooms on unmount

## Differences: Frontend vs Admin

| Aspect | Frontend | Admin |
|--------|----------|-------|
| Token Key | `accessToken` | `adminAccessToken` |
| Socket URL | Same | Same |
| Implementation | Identical | Identical |
| Hook Name | `useSocket` | `useSocket` |
| Service Name | `socketService` | `socketService` |

Everything else is identical!

## Migration from Old Implementation

| Old | New |
|-----|-----|
| `getSocket()` | `useSocket()` |
| `socket.emit('join_conversation', {conversationId})` | `socket.joinRoom(conversationId)` |
| `socket.emit('send_message', data)` | `socket.sendMessage(conversationId, content)` |
| `socket.on('new_message', handler)` | Access `socket.messages[conversationId]` |
| `socket.off('event', handler)` | Not needed (auto-handled) |
| `disconnectSocket()` | `socket.disconnect()` or auto on logout |
| Local state for messages | Redux state via `socket.messages` |

## File Structure Reference

```
src/
├── store/
│   ├── actions/
│   │   └── socketActions.ts       # Action creators
│   ├── middleware/
│   │   └── socketMiddleware.ts    # Middleware (handles socket)
│   ├── slices/
│   │   └── socketSlice.ts         # State management
│   └── store.ts                   # Store configuration
├── services/
│   └── socketService.ts           # Service API (non-React)
└── hooks/
    └── useSocket.ts               # React hook
```

## Need Help?

1. Check Redux DevTools for action flow
2. Check console for socket event logs
3. Verify token in localStorage
4. Check `VITE_SOCKET_URL` environment variable
5. See `SOCKET_REDUX_IMPLEMENTATION.md` for details
6. See `SOCKET_MIGRATION_EXAMPLE.md` for examples

