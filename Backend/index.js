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

app.use(cors());
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
    socket.to(sessionId).emit('userJoined', username);
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
      io.to(sessionId).emit('receiveMessage', finalMessageData);
    }
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