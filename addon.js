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

  res.send(`
    <h1>🎬 Dakids TV - FIXED VERSION</h1>
    <p>Status: ✅ Online | Videos: ${allVideos.length}</p>
    <h3>Test Links:</h3>
    <ul>
      <li><a href="${baseUrl}/manifest.json" target="_blank">📜 Manifest</a></li>
      <li><a href="${baseUrl}/catalog/movie/dakids-catalog.json" target="_blank">📦 Catalog</a></li>
      <li><a href="${baseUrl}/stream/movie/tt_84F0RO6o8M.json" target="_blank">🎬 Test Stream</a></li>
    </ul>
  `);
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    videos: allVideos.length,
    version: "FIXED_EXTERNAL_URL",
    timestamp: new Date().toISOString()
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

// ===================== STREAM - VERSIONE FORZATA EXTERNAL =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`\n🎬 ===== STREAM REQUEST =====`);
  console.log(`🔍 Requested: ${videoId}`);
  
  // Estrai YouTube ID
  const youtubeId = videoId.startsWith('tt_') 
    ? videoId.substring(3) 
    : videoId.startsWith('tt') 
      ? videoId.substring(2) 
      : videoId;
      
  console.log(`🔍 YouTube ID: ${youtubeId}`);
  
  // Trova video
  const video = allVideos.find(v => v.youtubeId === youtubeId || v.id === videoId);
  
  if (!video) {
    console.log(`❌ Video NOT FOUND`);
    return res.status(404).json({ 
      streams: [],
      error: "Video not found"
    });
  }

  console.log(`✅ Found: ${video.title}`);
  
  // RISPOSTA FORZATA CON EXTERNAL URL
  const response = {
    streams: [{
      title: `🌐 ${video.title} - YouTube`,
      externalUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
      behaviorHints: {
        notWebReady: true
      }
    }]
  };
  
  console.log(`📤 Sending stream response:`, JSON.stringify(response, null, 2));
  res.json(response);
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  console.log("📜 Manifest request received");
  
  const manifest = {
    id: "dakids.addon.fixed",
    version: "2.0.0",
    name: "Dakids TV (Fixed)",
    description: "Cartoni per bambini - apre YouTube nel browser",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [{
      type: "movie",
      id: "dakids-catalog",
      name: "Cartoni per Bambini"
    }],
    idPrefixes: ["tt"],
    background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
    logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
  };
  
  console.log("📜 Sending manifest");
  res.json(manifest);
});

// ===================== DEBUG ENDPOINT =====================
app.get("/debug", (req, res) => {
  res.json({
    version: "FIXED_EXTERNAL_URL",
    totalVideos: allVideos.length,
    sampleVideo: allVideos[0] || null,
    testStreamUrl: allVideos[0] ? `/stream/movie/${allVideos[0].id}.json` : null
  });
});

// ===================== AVVIO SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 Dakids FIXED Addon Started");
  console.log("====================================");
  console.log("📍 Port:", PORT);
  console.log("📺 Videos loaded:", allVideos.length);
  console.log("🔧 Version: EXTERNAL_URL_FIXED");
  console.log("====================================");
});
