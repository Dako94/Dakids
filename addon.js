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
    <h1>🎬 Dakids TV - COMPLETE FIXED VERSION</h1>
    <p>Status: ✅ Online | Videos: ${allVideos.length}</p>
    <h3>Test Links:</h3>
    <ul>
      <li><a href="${baseUrl}/manifest.json" target="_blank">📜 Manifest</a></li>
      <li><a href="${baseUrl}/catalog/movie/dakids-catalog.json" target="_blank">📦 Catalog</a></li>
      <li><a href="${baseUrl}/stream/movie/test123.json" target="_blank">🧪 Test Stream (3 formats)</a></li>
      <li><a href="${baseUrl}/stream/movie/tt_84F0RO6o8M.json" target="_blank">🎬 Real Video Stream</a></li>
    </ul>
  `);
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    videos: allVideos.length,
    version: "COMPLETE_FIXED_3_FORMATS",
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
  
  // Aggiungi un video di test
  metas.unshift({
    id: "test123",
    type: "movie", 
    name: "🧪 TEST VIDEO - Me at the zoo (3 formats)",
    poster: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    description: "Video di test - primo video mai caricato su YouTube",
    genres: ["Test"],
    released: "2005"
  });
  
  console.log(`📦 Sending ${metas.length} videos to Stremio`);
  res.json({ metas });
});

// ===================== STREAM - VERSIONE CON 3 FORMATI =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`🎬 Stream request for: ${videoId}`);
  
  // Test rapido per il video di test
  if (videoId === "test123") {
    console.log("🧪 Sending TEST video with 3 formats");
    return res.json({
      streams: [
        {
          title: "Test - YouTube Format (ytId)",
          ytId: "dQw4w9WgXcQ",
          behaviorHints: { notWebReady: true }
        },
        {
          title: "Test - Embed Format",
          url: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
          behaviorHints: { notWebReady: false }
        },
        {
          title: "Test - External Format",
          externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          behaviorHints: { notWebReady: true }
        }
      ]
    });
  }
  
  // Resto del codice per i video normali
  const youtubeId = videoId.startsWith('tt_') 
    ? videoId.substring(3) 
    : videoId.startsWith('tt') 
      ? videoId.substring(2) 
      : videoId;
      
  console.log(`🔍 YouTube ID: ${youtubeId}`);
  
  const video = allVideos.find(v => v.youtubeId === youtubeId || v.id === videoId);
  
  if (!video) {
    console.log(`❌ Video NOT FOUND`);
    return res.status(404).json({ 
      streams: [], 
      error: "Video not found" 
    });
  }

  console.log(`✅ Found: ${video.title}`);
  
  const response = {
    streams: [
      {
        title: `📺 ${video.title}`,
        ytId: video.youtubeId,
        behaviorHints: { notWebReady: true }
      },
      {
        title: `🔗 ${video.title} - Embed`,
        url: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`,
        behaviorHints: { notWebReady: false }
      },
      {
        title: `🌐 ${video.title} - External`,
        externalUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
        behaviorHints: { notWebReady: true }
      }
    ]
  };
  
  console.log(`📤 Sending ${response.streams.length} stream formats`);
  res.json(response);
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  console.log("📜 Manifest request received");
  
  const manifest = {
    id: "dakids.addon.complete",
    version: "3.0.0",
    name: "Dakids TV (Complete)",
    description: "Cartoni per bambini - 3 formati di compatibilità",
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
    version: "COMPLETE_FIXED_4_FORMATS",
    totalVideos: allVideos.length,
    sampleVideo: allVideos[0] || null,
    testStreamUrl: "/stream/movie/test123.json",
    realStreamUrl: allVideos[0] ? `/stream/movie/${allVideos[0].id}.json` : null
  });
});

// ===================== STREAM TEST FORZATO =====================
app.get("/stream/movie/test456.json", (req, res) => {
  console.log("🧪 FORCED TEST - NEW FORMAT");
  res.json({
    streams: [
      {
        title: "▶️ NUOVO TEST - Iframe Format",
        url: "https://www.youtube.com/embed/jNQXAC9IVRw?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1",
        behaviorHints: { 
          notWebReady: false
        }
      }
    ]
  });
});

// ===================== NUOVO STREAM FORMAT =====================
app.get("/stream/movie/new/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`🎬 NEW FORMAT Stream request for: ${videoId}`);
  
  const youtubeId = videoId.startsWith('tt_') ? videoId.substring(3) : videoId.startsWith('tt') ? videoId.substring(2) : videoId;
  const video = allVideos.find(v => v.youtubeId === youtubeId || v.id === videoId);
  
  if (!video) {
    return res.status(404).json({ streams: [], error: "Video not found" });
  }

  console.log(`✅ NEW FORMAT Found: ${video.title}`);
  
  res.json({
    streams: [{
      title: `▶️ ${video.title}`,
      url: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1`,
      behaviorHints: { 
        notWebReady: false
      }
    }]
  });
});

// ===================== AVVIO SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 Dakids IFRAME FIXED Addon Started - v3.1.0");
  console.log("====================================");
  console.log("📍 Port:", PORT);
  console.log("📺 Videos loaded:", allVideos.length);
  console.log("🔧 Version: 3_FORMATS_COMPATIBILITY");
  console.log("====================================");
});
