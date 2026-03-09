import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import conflictsRouter from "./routes/conflicts";
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

const clientBuildPath = path.join(__dirname, "../../client-build");
app.use(express.static(clientBuildPath));
app.get("*", (_req, res) => {
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
    const response = await fetch(`http://localhost:${PORT}/api/conflicts`);
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
  console.log('SIGTERM received, shutting down gracefully...');
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
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CONFLICT GLOBE                           ║
║              Real-time OSINT Visualization                  ║
╠════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                        ║
║  WebSocket:  Enabled                                        ║
║  Environment: ${NODE_ENV.padEnd(43)}║
║  Cache TTL:  ${(CACHE_TTL / 1000).toString().padEnd(43)}║
║  Health:     http://localhost:${PORT}/api/health            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
