import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json());

  // --- API Routes ---
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Example API for server-side info (could be expanded for admin tasks)
  app.get("/api/stats", (req, res) => {
    res.json({ 
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development"
    });
  });

  // --- Vite / Static Files Middleware ---

  if (process.env.NODE_ENV !== "production") {
    // Development mode: Use Vite's middleware for HMR and TS support
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static files from the dist folder
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Professional Server running at http://localhost:${PORT}`);
  });
}

startServer();
