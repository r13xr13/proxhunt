import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import cors from "cors";
import rfidRouter from "./routes/rfid";
import { getDiscoveries, getReaders, getUniqueTagCount, getLeaderboard } from "./services/rfid";

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
    service: "ProxHunt",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeConnections: activeConnections.size
  });
});

app.use("/api/rfid", rfidRouter);

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
    const discoveries = getDiscoveries({ limit: 500 });
    const readers = getReaders();
    const stats = { uniqueTags: getUniqueTagCount(), totalReaders: readers.length };
    const leaderboard = getLeaderboard(5);
    
    io.emit('rfid:update', { discoveries, readers, stats, leaderboard });
    console.log(`[Broadcast] Sent ${discoveries.length} discoveries to ${activeConnections.size} clients`);
  } catch (error) {
    console.error('Error broadcasting RFID data:', error);
  }
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} (Total: ${activeConnections.size + 1})`);
  activeConnections.add(socket.id);

  socket.emit('rfid:welcome', {
    message: 'Connected to ProxHunt',
    timestamp: new Date().toISOString(),
    clientId: socket.id
  });

  if (activeConnections.size === 1 && !broadcastInterval) {
    console.log('Starting broadcast interval...');
    broadcastInterval = setInterval(fetchAndBroadcast, CACHE_TTL);
    fetchAndBroadcast();
  }

  socket.on('rfid:subscribe', () => {
    socket.emit('rfid:data', { discoveries: [], message: 'Subscribed' });
  });

  socket.on('rfid:refresh', async () => {
    console.log(`Manual refresh requested by ${socket.id}`);
    await fetchAndBroadcast();
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
