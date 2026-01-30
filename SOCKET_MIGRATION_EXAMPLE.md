# Socket Migration Example

This document shows how to migrate from the old socket implementation to the new Redux middleware-based implementation.

## Example: Migrating the Chat Component

### Before (Old Implementation)

```typescript
import { useEffect, useState, useRef } from 'react';
import { getSocket, disconnectSocket } from '../services/socket';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const { id } = useParams();

  // Setup WebSocket connection
  useEffect(() => {
    if (!id) return;

    const socket = getSocket();
    if (!socket) {
      console.warn('Socket not available');
      return;
    }

    socketRef.current = socket;

    // Wait for connection
    const setupSocket = () => {
      if (socket.connected) {
        socket.emit('join_conversation', { conversationId: id });
        setIsConnected(true);
      } else {
        socket.once('connect', () => {
          socket.emit('join_conversation', { conversationId: id });
          setIsConnected(true);
        });
        socket.connect();
      }
    };

    setupSocket();

    // Handle reconnection
    const handleReconnect = () => {
      if (socket.connected) {
        socket.emit('join_conversation', { conversationId: id });
      }
    };
    socket.on('reconnect', handleReconnect);

    // Handle new messages
    const handleNewMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };
    socket.on('new_message', handleNewMessage);

    // Handle disconnect
    const handleDisconnect = () => {
      setIsConnected(false);
    };
    socket.on('disconnect', handleDisconnect);

    // Cleanup
    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('reconnect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      socket.emit('leave_conversation', { conversationId: id });
    };
  }, [id]);

  const sendMessage = (content) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit('send_message', {
        conversationId: id,
        content,
      });
    }
  };

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>
        {messages.map(msg => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

### After (New Implementation with useSocket Hook)

```typescript
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

function Chat() {
  const { id } = useParams();
  const socket = useSocket();

  // Join/leave room when conversation changes
  useEffect(() => {
    if (!id || !socket.isConnected) return;

    socket.joinRoom(id);

    return () => {
      socket.leaveRoom(id);
    };
  }, [id, socket.isConnected]);

  // Get messages from Redux state
  const messages = socket.messages[id] || [];
  const typingUsers = socket.typingUsers[id] || [];
  const unreadCount = socket.unreadCounts[id] || 0;

  const sendMessage = (content: string) => {
    socket.sendMessage(id, content);
  };

  const handleTyping = () => {
    socket.startTyping(id);
    // Auto-stop after 3 seconds (or when user stops typing)
    setTimeout(() => socket.stopTyping(id), 3000);
  };

  return (
    <div>
      <div>
        Status: {socket.isConnected ? 'Connected' : 'Disconnected'}
        {socket.isConnecting && ' (Connecting...)'}
        {socket.error && ` Error: ${socket.error}`}
      </div>
      
      <div>
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.content}
            {msg.readAt && <span>✓</span>}
          </div>
        ))}
      </div>
      
      {typingUsers.length > 0 && (
        <div>{typingUsers.length} user(s) typing...</div>
      )}
      
      <input 
        type="text"
        onChange={handleTyping}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />
      
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

## Key Changes

### 1. Import Changes
```typescript
// Old
import { getSocket, disconnectSocket } from '../services/socket';

// New
import { useSocket } from '../hooks/useSocket';
```

### 2. State Management
```typescript
// Old - Local state
const [messages, setMessages] = useState([]);
const [isConnected, setIsConnected] = useState(false);

// New - Redux state via hook
const socket = useSocket();
const messages = socket.messages[conversationId] || [];
const isConnected = socket.isConnected;
```

### 3. Socket Connection
```typescript
// Old - Manual connection and event listeners
const socket = getSocket();
socket.on('connect', () => {});
socket.on('new_message', handleNewMessage);

// New - Automatic via useSocket
const socket = useSocket(); // Auto-connects when authenticated
// Messages automatically updated in Redux state
```

### 4. Sending Messages
```typescript
// Old
socket.emit('send_message', { conversationId, content });

// New
socket.sendMessage(conversationId, content);
```

### 5. Joining Rooms
```typescript
// Old
socket.emit('join_conversation', { conversationId });

// New
socket.joinRoom(conversationId);
```

### 6. Cleanup
```typescript
// Old - Manual event cleanup
return () => {
  socket.off('new_message', handleNewMessage);
  socket.off('reconnect', handleReconnect);
  socket.emit('leave_conversation', { conversationId });
};

// New - Simple room leave
return () => {
  socket.leaveRoom(conversationId);
};
```

## Alternative: Using Redux Selectors Directly

For more control, you can use Redux selectors:

```typescript
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import {
  socketConnect,
  socketJoinRoom,
  socketLeaveRoom,
  socketSendMessage,
} from '../store/actions/socketActions';

function Chat() {
  const { id } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  
  // Select specific state
  const isConnected = useSelector((state: RootState) => state.socket.isConnected);
  const messages = useSelector((state: RootState) => state.socket.messages[id] || []);
  const error = useSelector((state: RootState) => state.socket.error);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      dispatch(socketConnect());
    }
  }, [isAuthenticated, isConnected, dispatch]);

  // Join room
  useEffect(() => {
    if (!id || !isConnected) return;

    dispatch(socketJoinRoom(id));

    return () => {
      dispatch(socketLeaveRoom(id));
    };
  }, [id, isConnected, dispatch]);

  const sendMessage = (content: string) => {
    dispatch(socketSendMessage(id, content));
  };

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {error && <div>Error: {error}</div>}
      <div>
        {messages.map(msg => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

## Using the Socket Service (Non-React)

For use outside React components:

```typescript
import socketService from '../services/socketService';

// In a utility function, API call, etc.
export const sendNotification = (conversationId: string, message: string) => {
  if (socketService.isSocketConnected()) {
    socketService.sendMessage(conversationId, message);
  }
};

// Connect manually
socketService.connectSocket();

// Disconnect
socketService.disconnectSocket();

// Emit custom event
socketService.emitSocketEvent('custom_event', { data: 'value' });
```

## Advanced: Listening to Specific Socket Events

If you need to listen to custom socket events not covered by the middleware:

```typescript
import { useEffect } from 'react';
import { getSocket } from '../services/socketService';

function CustomComponent() {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCustomEvent = (data) => {
      console.log('Custom event:', data);
      // Handle custom event
    };

    socket.on('custom_event', handleCustomEvent);

    return () => {
      socket.off('custom_event', handleCustomEvent);
    };
  }, []);

  return <div>Custom Component</div>;
}
```

## Benefits of the New Implementation

1. **Less Boilerplate**: No need for manual event listeners and cleanup
2. **Automatic State Management**: Messages, typing indicators, etc. automatically updated
3. **Better Type Safety**: TypeScript support for all actions
4. **Easier Testing**: Redux actions are easier to test
5. **DevTools Support**: See all socket actions in Redux DevTools
6. **Consistent API**: Same across frontend and admin
7. **Automatic Reconnection**: Handled by middleware
8. **Token Management**: Automatic token refresh on reconnect

## Migration Checklist

- [ ] Replace `getSocket()` calls with `useSocket()` hook
- [ ] Remove manual event listeners (`socket.on`)
- [ ] Remove manual event cleanup (`socket.off`)
- [ ] Replace `socket.emit()` with typed actions
- [ ] Access messages from Redux state instead of local state
- [ ] Remove connection management code
- [ ] Remove reconnection logic
- [ ] Test all socket functionality
- [ ] Check Redux DevTools for socket actions
- [ ] Verify automatic reconnection works

## Common Patterns

### Pattern 1: Auto-Join on Mount
```typescript
const socket = useSocket();

useEffect(() => {
  if (socket.isConnected) {
    socket.joinRoom(conversationId);
  }
  return () => socket.leaveRoom(conversationId);
}, [socket.isConnected, conversationId]);
```

### Pattern 2: Send Message with Optimistic Update
```typescript
const sendMessage = (content: string) => {
  // Redux middleware handles the actual sending
  socket.sendMessage(conversationId, content);
  
  // Message will appear in Redux state when server confirms
};
```

### Pattern 3: Display Connection Status
```typescript
const socket = useSocket();

const statusText = socket.isConnecting 
  ? 'Connecting...' 
  : socket.isConnected 
    ? 'Connected' 
    : 'Disconnected';
```

### Pattern 4: Handle Typing Indicators
```typescript
const socket = useSocket();
const typingUsers = socket.typingUsers[conversationId] || [];

const handleTyping = () => {
  socket.startTyping(conversationId);
  
  // Clear after 3 seconds
  clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    socket.stopTyping(conversationId);
  }, 3000);
};
```

## Troubleshooting

### Issue: Socket not connecting
**Solution**: Ensure user is authenticated. The hook auto-connects when `isAuthenticated` is true.

### Issue: Messages not showing
**Solution**: Check that you've joined the room and are accessing the correct conversation ID from Redux state.

### Issue: Multiple connections
**Solution**: The middleware ensures only one socket connection. Remove manual `getSocket()` calls.

### Issue: Events not firing
**Solution**: Make sure the middleware is properly configured in store.ts and you're using the correct action types.

