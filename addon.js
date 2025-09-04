#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// ===================== LETTURA METADATA =====================
let allVideos = [];
try {
  const data = fs.readFileSync("./meta.json", "utf-8");
  allVideos = JSON.parse(data);
  console.log(`📦 Caricati ${allVideos.length} video`);
} catch (err) {
  console.error("❌ Errore meta.json:", err);
  allVideos = [];
}

// ===================== ROOT ENDPOINT CON INTERFACCIA BELLA =====================
app.get("/", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  let htmlContent = `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dakids TV - Addon Stremio per Bambini</title>
    <style>
      body { font-family: Arial, sans-serif; background: #fffae3; color: #333; text-align: center; padding: 2rem; }
      h1 { color: #ff6f61; }
      a { text-decoration: none; color: #0077cc; }
      a:hover { text-decoration: underline; }
      .video { display: inline-block; margin: 1rem; border: 2px solid #ffd700; border-radius: 12px; overflow: hidden; width: 220px; }
      .video img { width: 100%; display: block; }
      .video-title { font-size: 0.9rem; padding: 0.5rem; background: #fffacd; }
      .container { max-width: 1200px; margin: 0 auto; }
      .btn { display: inline-block; padding: 10px 20px; background: #4ecdc4; color: white; border-radius: 25px; margin: 10px; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🎬 Benvenuti su Dakids TV!</h1>
      <p>Cartoni animati e video divertenti per bambini di tutte le età.</p>
      <p>Status: ✅ Online | Videos disponibili: ${allVideos.length}</p>
      
      <div style="margin: 20px 0;">
        <a href="${baseUrl}/manifest.json" class="btn" target="_blank">📜 Manifest Stremio</a>
        <a href="${baseUrl}/health" class="btn" target="_blank">❤️ Health Check</a>
        <a href="${baseUrl}/catalog/movie/dakids-catalog.json" class="btn" target="_blank">📦 Catalogo</a>
      </div>
      
      <hr>
      <h2>I nostri video più recenti</h2>
      <div>`;

  // Aggiungi i video
  allVideos.slice(0, 12).forEach(video => {
    htmlContent += `
      <div class="video">
        <img src="${video.thumbnail}" alt="${video.title}" onerror="this.src='https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg'">
        <div class="video-title">${video.title}</div>
      </div>`;
  });

  htmlContent += `
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <h3>📋 Come installare su Stremio</h3>
        <p>1. Apri Stremio</p>
        <p>2. Vai su Addons → Installa da URL</p>
        <p>3. Incolla questo link: <code>${baseUrl}/manifest.json</code></p>
      </div>
    </div>
  </body>
  </html>`;

  res.send(htmlContent);
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    videos: allVideos.length,
    timestamp: new Date().toISOString(),
    server: "Dakids TV Addon"
  });
});

// ===================== CATALOGO =====================
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  console.log("📦 Catalog request received");
  
  const metas = allVideos.map(video => ({
    id: video.id,
    type: "movie",
    name: video.title || "Untitled",
    poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
    description: video.title || "Video for kids",
    runtime: "90",
    released: "2024",
    genres: ["Animation", "Kids"],
    imdbRating: "7.5"
  }));
  
  console.log(`📦 Sending ${metas.length} videos to Stremio`);
  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`🎬 Stream request for: ${videoId}`);
  
  const video = allVideos.find(v => v.id === videoId);
  
  if (!video) {
    console.log("❌ Video not found");
    return res.status(404).json({ error: "Video not found" });
  }

  console.log(`✅ Found video: ${video.title}`);
  
  res.json({
    streams: [{
      title: video.title,
      ytId: video.youtubeId,
      behaviorHints: {
        notWebReady: true,
        bingeGroup: `yt-${video.youtubeId}`
      }
    }]
  });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  console.log("📜 Manifest request received");
  res.json({
    id: "dakids.addon",
    version: "1.0.0",
    name: "Dakids TV",
    description: "Cartoni animati per bambini",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [
      { 
        type: "movie", 
        id: "dakids-catalog", 
        name: "Cartoni per Bambini"
      }
    ],
    idPrefixes: ["tt"]
  });
});

// ===================== AVVIO SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 Dakids Addon Server Started");
  console.log("====================================");
  console.log("📍 Port:", PORT);
  console.log("📺 Videos loaded:", allVideos.length);
  console.log("🌐 Server ready for Render deployment");
  console.log("====================================");
});
