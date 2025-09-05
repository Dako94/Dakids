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

// ===================== ROOT ENDPOINT =====================
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
      .video img { width: 100%; display: block; height: 120px; object-fit: cover; }
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

  allVideos.slice(0, 12).forEach(video => {
    const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
    htmlContent += `
      <div class="video">
        <img src="${thumb}" alt="${video.title}">
        <div class="video-title">${video.title.substring(0, 40)}${video.title.length > 40 ? '...' : ''}</div>
      </div>`;
  });

  htmlContent += `
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
    timestamp: new Date().toISOString()
  });
});

// ===================== CATALOGO =====================
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  console.log("📦 Catalog request received");
  
  const metas = allVideos.map(video => ({
    id: video.id, // Deve essere "tt" + YouTube ID
    type: "movie",
    name: video.title || "Untitled",
    poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
    background: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
    description: video.title || "Video for kids",
    runtime: video.duration ? parseInt(video.duration.split(':')[0]) * 60 + parseInt(video.duration.split(':')[1]) || 0 : 0,
    released: video.date ? video.date.substring(0, 4) : "2024",
    genres: ["Animation", "Kids"],
    imdbRating: "7.5"
  }));
  
  console.log(`📦 Sending ${metas.length} videos to Stremio`);
  res.json({ metas });
});

// ===================== STREAM - VERSIONE CORRETTA =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`🎬 Stream request for: ${videoId}`);
  
  // Estrai l'ID YouTube dall'ID Stremio (tt + YouTubeID)
  const youtubeId = videoId.startsWith('tt') ? videoId.substring(2) : videoId;
  const video = allVideos.find(v => v.youtubeId === youtubeId || v.id === videoId);
  
  if (!video) {
    console.log("❌ Video not found for:", youtubeId);
    return res.status(404).json({ error: "Video not found" });
  }

  console.log(`✅ Found video: ${video.title}`);
  
  // ✅ FORMATO CORRETTO - IL VIDEO SI APRIRÀ NEL BROWSER
  res.json({
    streams: [{
      title: `📺 ${video.title}`,
      // ✅ externalUrl farà aprire YouTube nel browser
      externalUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
      behaviorHints: {
        // ✅ Indica che il contenuto si apre esternamente
        notWebReady: true
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
    description: "Cartoni animati per bambini - apre YouTube nel browser",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [
      { 
        type: "movie", 
        id: "dakids-catalog", 
        name: "Cartoni per Bambini"
      }
    ],
    idPrefixes: ["tt"],
    // Aggiungi metadati per YouTube
    background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
    logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
  });
});

// ===================== DEBUG ENDPOINT =====================
app.get("/debug", (req, res) => {
  res.json({
    totalVideos: allVideos.length,
    sampleVideo: allVideos[0] || null,
    videoIds: allVideos.slice(0, 3).map(v => ({
      stremioId: v.id,
      youtubeId: v.youtubeId,
      title: v.title
    })),
    streamExample: allVideos[0] ? `/stream/movie/${allVideos[0].id}.json` : null
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
  
  if (allVideos.length > 0) {
    console.log("🔍 First video ID:", allVideos[0].id);
    console.log("🔍 YouTube ID:", allVideos[0].youtubeId);
    console.log("🔍 Stream test:", `http://localhost:${PORT}/stream/movie/${allVideos[0].id}.json`);
  }
  
  console.log("🌐 Server ready - Videos will open in browser");
  console.log("====================================");
});
