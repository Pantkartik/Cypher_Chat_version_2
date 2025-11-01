const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/** Enable CORS for all routes */
// In backend/index.js, update CORS:
app.use(cors({
  origin: ['https://your-frontend-domain.com'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session persistence setup
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
let sessions = {};
let userSessions = {};

// Load sessions from file on startup
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      sessions = parsed.sessions || {};
      userSessions = parsed.userSessions || {};
      console.log('[DEBUG] Loaded sessions from file:', Object.keys(sessions));
    }
  } catch (error) {
    console.error('[DEBUG] Error loading sessions:', error);
    sessions = {};
    userSessions = {};
  }
}

// Save sessions to file
function saveSessions() {
  try {
    const data = JSON.stringify({ sessions, userSessions }, null, 2);
    fs.writeFileSync(SESSIONS_FILE, data, 'utf8');
    console.log('[DEBUG] Saved sessions to file');
  } catch (error) {
    console.error('[DEBUG] Error saving sessions:', error);
  }
}

// Load sessions on startup
loadSessions();

// Save sessions periodically (every 30 seconds)
setInterval(saveSessions, 30000);

console.log('[DEBUG] Sessions initialized:', sessions);

// Create a new chat session
app.post('/api/session', (req, res) => {
  const sessionId = uuidv4().substring(0, 8).toUpperCase();
  console.log(`[DEBUG] Created new session: ${sessionId}`);
  sessions[sessionId] = { 
    id: sessionId, 
    createdAt: new Date().toISOString(),
    messages: [],
    users: []
  };
  saveSessions(); // Save immediately after creating
  res.json({ sessionId });
});

// Health check endpoint for Railway
app.post('/api/create-session', (req, res) => {
  console.log('[DEBUG] Health check - create-session endpoint hit');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Join a session by token
app.post("/api/session/join", (req, res) => {
  const { sessionId, username } = req.body;
  console.log(`[DEBUG] Join request received for session ID: ${sessionId}`);
  console.log(`[DEBUG] Available sessions:`, Object.keys(sessions));
  
  if (!sessions[sessionId]) {
    console.log(`[DEBUG] Session ${sessionId} not found`);
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  
  // Store user session info
  if (!userSessions[sessionId]) {
    userSessions[sessionId] = [];
  }
  userSessions[sessionId].push(username);
  saveSessions(); // Save after successful join
  
  console.log(`[DEBUG] User ${username} successfully joined session ${sessionId}`);
  res.json({ success: true });
});

// Get session users
app.get('/api/session/:sessionId/users', (req, res) => {
  const { sessionId } = req.params;
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ users: sessions[sessionId].users });
});

// Socket.IO for realtime chat
io.on('connection', (socket) => {
  console.log('[DEBUG] Socket connected:', socket.id);
  
  socket.on('joinSession', ({ sessionId, username }) => {
    console.log('[DEBUG] Socket joinSession:', { sessionId, username });
    socket.join(sessionId);
    
    // Initialize session if it doesn't exist
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        messages: [],
        users: []
      };
    }
    
    // Initialize session users array if not exists
    if (!sessions[sessionId].users) {
      sessions[sessionId].users = [];
    }
    
    // Add user to session if not already present
    const userExists = sessions[sessionId].users.some(user => user.id === socket.id);
    if (!userExists) {
      const userData = { 
        id: socket.id, 
        name: username, 
        status: 'online',
        isTyping: false
      };
      sessions[sessionId].users.push(userData);
      
      // Emit userJoined event with full user data
      socket.to(sessionId).emit('userJoined', userData);
      
      // Emit updated user count to all users in the session
      io.to(sessionId).emit('userCountUpdate', sessions[sessionId].users.length);
      
      // Send current users list to the new user
      socket.emit('usersList', sessions[sessionId].users);
      
      console.log(`[DEBUG] User ${username} (${socket.id}) joined session ${sessionId}. Total users: ${sessions[sessionId].users.length}`);
    }
  });

  socket.on('sendMessage', ({ sessionId, username, message, messageData }) => {
    console.log('[DEBUG] Socket sendMessage:', { sessionId, username, message, messageData });
    if (sessions[sessionId]) {
      if (!sessions[sessionId].messages) {
        sessions[sessionId].messages = [];
      }
      // Use the messageData from frontend if provided, otherwise create new
      const finalMessageData = messageData || { 
        id: Date.now().toString(),
        userId: username,
        userName: username,
        content: Buffer.from(message).toString('base64'),
        timestamp: new Date().toISOString(),
        encrypted: true,
        status: 'sent'
      };
      sessions[sessionId].messages.push(finalMessageData);
      
      // Handle private messages
      if (finalMessageData.isPrivate && finalMessageData.targetUserId) {
        // Send private message only to sender and target user
        const targetUser = sessions[sessionId].users.find(u => u.name === finalMessageData.targetUserId);
        if (targetUser) {
          // Send to target user
          socket.to(targetUser.id).emit('receiveMessage', finalMessageData);
          // Send back to sender
          socket.emit('receiveMessage', finalMessageData);
          console.log(`[DEBUG] Private message sent from ${username} to ${finalMessageData.targetUserId}`);
        } else {
          // Target user not found, send error to sender
          socket.emit('privateMessageError', { 
            message: `User ${finalMessageData.targetUserId} not found`, 
            originalMessage: finalMessageData 
          });
        }
      } else {
        // Regular message - broadcast to all users in session
        io.to(sessionId).emit('receiveMessage', finalMessageData);
      }
    }
  });

  socket.on('typingStart', ({ sessionId, username }) => {
    console.log('[DEBUG] Socket typingStart:', { sessionId, username });
    if (sessions[sessionId] && sessions[sessionId].users) {
      const user = sessions[sessionId].users.find(u => u.name === username);
      if (user) {
        user.isTyping = true;
        socket.to(sessionId).emit('userTyping', { username, isTyping: true });
      }
    }
  });

  socket.on('typingStop', ({ sessionId, username }) => {
    console.log('[DEBUG] Socket typingStop:', { sessionId, username });
    if (sessions[sessionId] && sessions[sessionId].users) {
      const user = sessions[sessionId].users.find(u => u.name === username);
      if (user) {
        user.isTyping = false;
        socket.to(sessionId).emit('userTyping', { username, isTyping: false });
      }
    }
  });

  // Video calling events
  socket.on('videoCallOffer', ({ sessionId, targetUserId, offer, callerName }) => {
    console.log('[DEBUG] Video call offer from', callerName, 'to', targetUserId);
    socket.to(targetUserId).emit('videoCallOffer', {
      offer,
      callerId: socket.id,
      callerName,
      sessionId
    });
  });

  socket.on('videoCallAnswer', ({ targetUserId, answer }) => {
    console.log('[DEBUG] Video call answer to', targetUserId);
    socket.to(targetUserId).emit('videoCallAnswer', {
      answer,
      answererId: socket.id
    });
  });

  socket.on('iceCandidate', ({ targetUserId, candidate }) => {
    console.log('[DEBUG] ICE candidate to', targetUserId);
    socket.to(targetUserId).emit('iceCandidate', {
      candidate,
      senderId: socket.id
    });
  });

  socket.on('videoCallEnd', ({ targetUserId, sessionId }) => {
    console.log('[DEBUG] Video call ended');
    if (targetUserId) {
      socket.to(targetUserId).emit('videoCallEnd', { callerId: socket.id });
    } else if (sessionId) {
      socket.to(sessionId).emit('videoCallEnd', { callerId: socket.id });
    }
  });

  socket.on('videoCallRequest', ({ sessionId, targetUserId, callerName }) => {
    console.log('[DEBUG] Video call request from', callerName, 'to', targetUserId || 'all users');
    if (targetUserId) {
      socket.to(targetUserId).emit('videoCallRequest', {
        callerId: socket.id,
        callerName,
        sessionId
      });
    } else {
      socket.to(sessionId).emit('videoCallRequest', {
        callerId: socket.id,
        callerName,
        sessionId
      });
    }
  });

  // Audio calling events
  socket.on('audioCallOffer', ({ sessionId, targetUserId, offer, callerName }) => {
    console.log('[DEBUG] Audio call offer from', callerName, 'to', targetUserId);
    socket.to(targetUserId).emit('audioCallOffer', {
      offer,
      callerId: socket.id,
      callerName,
      sessionId
    });
  });

  socket.on('audioCallAnswer', ({ targetUserId, answer }) => {
    console.log('[DEBUG] Audio call answer to', targetUserId);
    socket.to(targetUserId).emit('audioCallAnswer', {
      answer,
      answererId: socket.id
    });
  });

  socket.on('audioCallEnd', ({ targetUserId, sessionId }) => {
    console.log('[DEBUG] Audio call ended');
    if (targetUserId) {
      socket.to(targetUserId).emit('audioCallEnd', { callerId: socket.id });
    } else if (sessionId) {
      socket.to(sessionId).emit('audioCallEnd', { callerId: socket.id });
    }
  });

  socket.on('audioCallRequest', ({ sessionId, targetUserId, callerName }) => {
    console.log('[DEBUG] Audio call request from', callerName, 'to', targetUserId || 'all users');
    if (targetUserId) {
      socket.to(targetUserId).emit('audioCallRequest', {
        callerId: socket.id,
        callerName,
        sessionId
      });
    } else {
      socket.to(sessionId).emit('audioCallRequest', {
        callerId: socket.id,
        callerName,
        sessionId
      });
    }
  });

  // Private chat events
  socket.on('joinPrivateChat', ({ userId, targetUserId }) => {
    console.log('[DEBUG] Private chat join:', { userId, targetUserId });
    // Create a private room for these two users
    const roomName = [userId, targetUserId].sort().join('-');
    socket.join(roomName);
    console.log(`[DEBUG] User ${userId} joined private room ${roomName}`);
  });

  socket.on('sendPrivateMessage', ({ senderId, receiverId, message }) => {
    console.log('[DEBUG] Private message from', senderId, 'to', receiverId);
    const roomName = [senderId, receiverId].sort().join('-');
    // Store private message in session (for persistence)
    // Note: In a production app, you'd want separate storage for private messages
    socket.to(roomName).emit('privateMessage', message);
    socket.emit('privateMessage', message); // Send back to sender
  });

  socket.on('typingStartPrivate', ({ userId, targetUserId }) => {
    console.log('[DEBUG] Private typing start from', userId, 'to', targetUserId);
    const roomName = [userId, targetUserId].sort().join('-');
    socket.to(roomName).emit('userTyping', { username: userId, isTyping: true });
  });

  socket.on('typingStopPrivate', ({ userId, targetUserId }) => {
    console.log('[DEBUG] Private typing stop from', userId, 'to', targetUserId);
    const roomName = [userId, targetUserId].sort().join('-');
    socket.to(roomName).emit('userTyping', { username: userId, isTyping: false });
  });
  
  socket.on('disconnect', () => {
    console.log('[DEBUG] Socket disconnected:', socket.id);
    
    // Remove user from all sessions they were in
    Object.keys(sessions).forEach(sessionId => {
      if (sessions[sessionId].users) {
        const userIndex = sessions[sessionId].users.findIndex(user => user.id === socket.id);
        if (userIndex !== -1) {
          const removedUser = sessions[sessionId].users[userIndex];
          sessions[sessionId].users.splice(userIndex, 1);
          
          // Emit user left event and updated count
          socket.to(sessionId).emit('userLeft', removedUser);
          io.to(sessionId).emit('userCountUpdate', sessions[sessionId].users.length);
          
          console.log(`[DEBUG] User ${removedUser.name} (${socket.id}) left session ${sessionId}. Total users: ${sessions[sessionId].users.length}`);
        }
      }
    });
  });
});

// Start the server
const port = 3001;
server.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[DEBUG] Saving sessions before shutdown...');
  saveSessions();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[DEBUG] Saving sessions before shutdown...');
  saveSessions();
  process.exit(0);
});

// Export for Railway deployment
module.exports = { app, server, io };