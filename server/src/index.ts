import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import conflictsRouter from "./routes/conflicts";
import { startAISStream, stopAISStream, getAISStreamStatus } from "./services/maritime";
import cors from "cors";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || "development";
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "30000");

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*"
}));
app.use(express.json({ limit: '10mb' }));

const requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
};

app.use(requestLogger);

const cache: Map<string, { data: any; timestamp: number }> = new Map();

app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cacheSize: cache.size,
    activeConnections: activeConnections.size,
    env: NODE_ENV
  });
});

app.get("/api/cache/clear", (_req, res) => {
  cache.clear();
  res.json({ status: "cleared" });
});

app.use("/api/conflicts", conflictsRouter);

const clientBuildPath = path.join(__dirname, NODE_ENV === "production" ? "../../client-build" : "../../client-3d/dist");

app.use(express.static(clientBuildPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/assets/")) {
    console.log(`[404] Asset not found: ${req.path}`);
    return res.status(404).send("Not found");
  }
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message: NODE_ENV === "development" ? err.message : undefined });
});

const activeConnections = new Set<string>();
let broadcastInterval: NodeJS.Timeout | null = null;

async function fetchAndBroadcast() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/conflicts`, { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    io.emit('conflicts:update', data);
    console.log(`[Broadcast] Sent ${data.events?.length || 0} events to ${activeConnections.size} clients`);
  } catch (error) {
    console.error('Error fetching conflicts:', error);
  }
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} (Total: ${activeConnections.size + 1})`);
  activeConnections.add(socket.id);

  socket.emit('conflicts:welcome', {
    message: 'Connected to Conflict Globe',
    timestamp: new Date().toISOString(),
    clientId: socket.id
  });

  if (activeConnections.size === 1 && !broadcastInterval) {
    console.log('Starting broadcast interval...');
    broadcastInterval = setInterval(fetchAndBroadcast, CACHE_TTL);
    fetchAndBroadcast();
  }

  socket.on('conflicts:subscribe', () => {
    socket.emit('conflicts:data', { events: [], message: 'Subscribed' });
  });

  socket.on('conflicts:refresh', async () => {
    console.log(`Manual refresh requested by ${socket.id}`);
    await fetchAndBroadcast();
  });

  // ── Collaboration ──────────────────────────────────────────────────────────

  // Track which room each socket is in
  const socketRooms = new Map<string, string>(); // socketId → roomName
  const roomUsers = new Map<string, Map<string, { username: string; color: string }>>(); // room → users

  socket.on('collab:join', ({ room, username }: { room: string; username: string }) => {
    // Leave any existing room first
    const prevRoom = socketRooms.get(socket.id);
    if (prevRoom) {
      socket.leave(prevRoom);
      const users = roomUsers.get(prevRoom);
      if (users) users.delete(socket.id);
      io.to(prevRoom).emit('collab:update', {
        collaborators: Array.from(users?.entries() || []).map(([id, u]) => ({ id, ...u }))
      });
    }

    // Join new room
    socket.join(room);
    socketRooms.set(socket.id, room);
    if (!roomUsers.has(room)) roomUsers.set(room, new Map());
    
    const COLORS = ["#3b82f6","#22c55e","#f97316","#a855f7","#ec4899","#14b8a6","#eab308","#ef4444"];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    roomUsers.get(room)!.set(socket.id, { username, color });

    // Broadcast updated user list to room
    const users = roomUsers.get(room)!;
    io.to(room).emit('collab:update', {
      collaborators: Array.from(users.entries()).map(([id, u]) => ({ id, ...u }))
    });

    console.log(`[Collab] ${username} joined room "${room}" (${users.size} users)`);
  });

  socket.on('collab:leave', () => {
    const room = socketRooms.get(socket.id);
    if (!room) return;
    socket.leave(room);
    socketRooms.delete(socket.id);
    const users = roomUsers.get(room);
    if (users) {
      users.delete(socket.id);
      io.to(room).emit('collab:update', {
        collaborators: Array.from(users.entries()).map(([id, u]) => ({ id, ...u }))
      });
      if (users.size === 0) roomUsers.delete(room);
    }
  });

  socket.on('collab:cursor', ({ room, lat, lng }: { room: string; lat: number; lng: number }) => {
    // Broadcast cursor position to everyone else in the room
    socket.to(room).emit('collab:cursor', { id: socket.id, lat, lng });
  });

  socket.on('collab:draw', ({ room, shapes }: { room: string; shapes: any[] }) => {
    // Broadcast drawing updates to everyone else in the room
    socket.to(room).emit('collab:draw', { id: socket.id, shapes });
  });

  socket.on('collab:focus', ({ room, lat, lng, zoom }: { room: string; lat: number; lng: number; zoom: number }) => {
    // Broadcast "look at this location" to everyone else in the room
    socket.to(room).emit('collab:focus', { id: socket.id, lat, lng, zoom });
  });

  socket.on('collab:annotation', ({ room, annotation }: { room: string; annotation: any }) => {
    // Broadcast new annotation to everyone in room (including sender for confirmation)
    io.to(room).emit('collab:annotation', { id: socket.id, annotation });
  });

  socket.on('disconnect', () => {
    // Clean up collab rooms on disconnect
    const room = socketRooms.get(socket.id);
    if (room) {
      socketRooms.delete(socket.id);
      const users = roomUsers.get(room);
      if (users) {
        users.delete(socket.id);
        io.to(room).emit('collab:update', {
          collaborators: Array.from(users.entries()).map(([id, u]) => ({ id, ...u }))
        });
        if (users.size === 0) roomUsers.delete(room);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id} (Remaining: ${activeConnections.size - 1})`);
    activeConnections.delete(socket.id);
    
    if (activeConnections.size === 0 && broadcastInterval) {
      console.log('No clients connected, stopping broadcast interval');
      clearInterval(broadcastInterval);
      broadcastInterval = null;
    }
  });
});

process.on('SIGTERM', () => {
  stopAISStream();
  console.log('SIGTERM received, shutting down gracefully');
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
  }
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
  }
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

httpServer.listen(PORT, () => {
  startAISStream();
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CONFLICT GLOBE                          ║
║              Real-time OSINT Visualization                 ║
╠════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                      ║
║  WebSocket:  Enabled                                       ║
║  Environment: ${NODE_ENV.padEnd(43)}                       ║
║  Cache TTL:  ${(CACHE_TTL / 1000).toString().padEnd(43)}   ║
║  Health:     http://localhost:${PORT}/api/health           ║
╚════════════════════════════════════════════════════════════╝
  `);
});
