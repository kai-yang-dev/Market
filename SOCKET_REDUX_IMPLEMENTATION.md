# Socket Implementation with Redux Middleware

## Overview

This document describes the new socket implementation using Redux middleware for both frontend and admin applications. The implementation provides a clean, centralized way to manage WebSocket connections through Redux state management.

## Architecture

### Key Components

1. **Socket Slice** (`store/slices/socketSlice.ts`)
   - Manages socket-related state in Redux
   - Tracks connection status, messages, conversations, typing indicators, online users
   - Provides actions for updating socket state

2. **Socket Middleware** (`store/middleware/socketMiddleware.ts`)
   - Intercepts socket-related actions
   - Manages WebSocket connection lifecycle
   - Handles socket events and dispatches appropriate Redux actions
   - Automatically reconnects on disconnection

3. **Socket Actions** (`store/actions/socketActions.ts`)
   - Defines action types and creators for socket operations
   - Provides type-safe way to dispatch socket actions

4. **Socket Service** (`services/socketService.ts`)
   - High-level API for socket operations
   - Wraps Redux actions for easier usage
   - Backward compatible with old socket.ts API

5. **useSocket Hook** (`hooks/useSocket.ts`)
   - React hook for components to access socket functionality
   - Auto-connects when user is authenticated
   - Auto-disconnects on logout
   - Provides access to socket state and actions

## File Structure

```
src/
├── store/
│   ├── actions/
│   │   └── socketActions.ts       # Socket action creators
│   ├── middleware/
│   │   └── socketMiddleware.ts    # Socket middleware implementation
│   ├── slices/
│   │   ├── authSlice.ts
│   │   └── socketSlice.ts         # Socket state management
│   └── store.ts                   # Redux store configuration
├── services/
│   ├── socket.ts                  # DEPRECATED - kept for backward compatibility
│   └── socketService.ts           # New socket service API
└── hooks/
    └── useSocket.ts               # Socket React hook
```

## Usage Examples

### 1. Using the useSocket Hook (Recommended)

```typescript
import { useSocket } from '../hooks/useSocket';

function ChatComponent() {
  const socket = useSocket();

  useEffect(() => {
    if (socket.isConnected) {
      socket.joinRoom('conversation-123');
    }

    return () => {
      socket.leaveRoom('conversation-123');
    };
  }, [socket.isConnected]);

  const handleSendMessage = () => {
    socket.sendMessage('conversation-123', 'Hello!');
  };

  return (
    <div>
      <p>Socket Status: {socket.isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={handleSendMessage}>Send Message</button>
    </div>
  );
}
```

### 2. Using the Socket Service

```typescript
import socketService from '../services/socketService';

// Connect to socket
socketService.connectSocket();

// Join a conversation
socketService.joinConversation('conversation-123');

// Send a message
socketService.sendMessage('conversation-123', 'Hello!', []);

// Start typing indicator
socketService.startTyping('conversation-123');

// Disconnect
socketService.disconnectSocket();
```

### 3. Using Redux Actions Directly

```typescript
import { useDispatch } from 'react-redux';
import { socketConnect, socketSendMessage } from '../store/actions/socketActions';

function Component() {
  const dispatch = useDispatch();

  const connect = () => {
    dispatch(socketConnect());
  };

  const sendMsg = () => {
    dispatch(socketSendMessage('conversation-123', 'Hello!'));
  };

  return (
    <div>
      <button onClick={connect}>Connect</button>
      <button onClick={sendMsg}>Send</button>
    </div>
  );
}
```

### 4. Accessing Socket State

```typescript
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

function Component() {
  const { isConnected, messages, onlineUsers } = useSelector(
    (state: RootState) => state.socket
  );

  return (
    <div>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Online Users: {onlineUsers.length}</p>
      <p>Messages: {Object.keys(messages).length}</p>
    </div>
  );
}
```

## Socket State Structure

```typescript
interface SocketState {
  isConnected: boolean;              // Connection status
  isConnecting: boolean;             // Connection in progress
  error: string | null;              // Last error message
  joinedRooms: string[];             // Currently joined conversation IDs
  messages: Record<string, Message[]>; // Messages by conversation ID
  conversations: Record<string, Conversation>; // Conversations data
  unreadCounts: Record<string, number>; // Unread counts per conversation
  typingUsers: Record<string, string[]>; // Typing users per conversation
  onlineUsers: string[];             // List of online user IDs
}
```

## Available Actions

### Connection Actions
- `socketConnect()` - Connect to socket server
- `socketDisconnect()` - Disconnect from socket server

### Room Actions
- `socketJoinRoom(conversationId)` - Join a conversation room
- `socketLeaveRoom(conversationId)` - Leave a conversation room

### Message Actions
- `socketSendMessage(conversationId, content, attachments)` - Send a message
- `socketMarkRead(conversationId, messageId)` - Mark message as read

### Typing Indicator Actions
- `socketTypingStart(conversationId)` - Start typing indicator
- `socketTypingStop(conversationId)` - Stop typing indicator

### Generic Action
- `socketEmit(event, data)` - Emit custom socket event

## Socket Events Handled

The middleware automatically handles these socket events:

- `connect` - Socket connected successfully
- `disconnect` - Socket disconnected
- `reconnect` - Socket reconnected after disconnection
- `connect_error` - Connection error occurred
- `auth_error` - Authentication error
- `error` - General socket error
- `new_message` - New message received
- `message_sent` - Message sent confirmation
- `message_read` - Message read notification
- `conversation_updated` - Conversation data updated
- `unread_count` - Unread count updated
- `user_typing` - User started typing
- `user_stopped_typing` - User stopped typing
- `user_online` - User came online
- `user_offline` - User went offline
- `online_users` - List of online users

## Auto-Connection

The `useSocket` hook automatically:
- Connects when user is authenticated
- Disconnects when user logs out
- Manages connection lifecycle

## Token Management

The middleware automatically:
- Uses `accessToken` (frontend) or `adminAccessToken` (admin) from localStorage
- Refreshes token on reconnection
- Handles token expiration and auth errors
- Triggers logout on authentication failures

## Error Handling

- Connection errors are stored in Redux state
- Auth errors trigger automatic logout
- Reconnection is handled automatically
- All errors are logged to console

## Migration Guide

### From Old Implementation

**Old Way (socket.ts):**
```typescript
import { getSocket, disconnectSocket } from '../services/socket';

const socket = getSocket();
if (socket) {
  socket.emit('join_conversation', { conversationId });
  socket.on('new_message', handleMessage);
}
```

**New Way (useSocket hook):**
```typescript
import { useSocket } from '../hooks/useSocket';

const socket = useSocket();
socket.joinRoom(conversationId);

// Messages are automatically handled in Redux state
const messages = socket.messages[conversationId];
```

**New Way (socketService):**
```typescript
import { joinConversation } from '../services/socketService';

joinConversation(conversationId);

// Access state via Redux
const messages = useSelector((state: RootState) => 
  state.socket.messages[conversationId]
);
```

## Benefits

1. **Centralized State**: All socket state is managed in Redux
2. **Type Safety**: Full TypeScript support with typed actions
3. **Automatic Reconnection**: Middleware handles reconnection logic
4. **Better Testing**: Redux actions are easier to test
5. **Debugging**: Redux DevTools shows all socket actions
6. **Cleaner Components**: No direct socket management in components
7. **Consistent API**: Same interface across frontend and admin

## Differences Between Frontend and Admin

The only differences are:
- Token key: `accessToken` (frontend) vs `adminAccessToken` (admin)
- Socket URL fallback logic

Everything else is identical.

## Backward Compatibility

The old `socket.ts` files are marked as deprecated but still work. They will be removed in a future update. Please migrate to the new implementation.

## Best Practices

1. **Use the useSocket hook** in React components
2. **Use socketService** for imperative operations
3. **Access state via Redux selectors** instead of socket events
4. **Let the middleware handle connection management**
5. **Dispatch actions instead of calling socket.emit directly**

## Troubleshooting

### Socket not connecting
- Check if user is authenticated
- Verify token in localStorage
- Check console for error messages
- Verify `VITE_SOCKET_URL` environment variable

### Messages not appearing
- Ensure you've joined the conversation room
- Check Redux state in DevTools
- Verify socket events in Network tab

### Reconnection issues
- The middleware automatically handles reconnection
- Check token validity
- Review error logs in Redux state

## Environment Variables

```bash
# Frontend and Admin
VITE_SOCKET_URL=http://localhost:3000  # Socket.IO server URL
```

## Future Improvements

- [ ] Add offline message queue
- [ ] Implement message persistence
- [ ] Add file upload progress tracking
- [ ] Implement optimistic updates
- [ ] Add message encryption
- [ ] Implement voice/video call signaling

