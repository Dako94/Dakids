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
  console.log(`📦 Loaded ${allVideos.length} videos successfully`);
} catch (err) {
  console.error("❌ Error loading meta.json:", err);
  allVideos = [];
}

// ===================== HOME PAGE =====================
app.get("/", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dakids TV Addon</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .header { text-align: center; margin-bottom: 30px; }
        .status { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .links { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .links a { display: inline-block; margin: 5px 10px; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .links a:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎬 Dakids TV Addon</h1>
        <p>YouTube videos for kids - Stremio Addon</p>
      </div>
      
      <div class="status">
        <strong>✅ Status:</strong> Online<br>
        <strong>📺 Videos:</strong> ${allVideos.length} loaded<br>
        <strong>🔧 Version:</strong> Clean Final v4.0
      </div>

      <div class="links">
        <h3>🔗 Addon Links:</h3>
        <a href="${baseUrl}/manifest.json" target="_blank">📋 Manifest</a>
        <a href="${baseUrl}/catalog/movie/dakids.json" target="_blank">📦 Catalog</a>
        <a href="${baseUrl}/catalog/movie/test.json" target="_blank">🧪 Test Catalog</a>
        <a href="${baseUrl}/health" target="_blank">❤️ Health</a>
      </div>

      <div class="links">
        <h3>🧪 Test Streams:</h3>
        <a href="${baseUrl}/stream/movie/test1.json" target="_blank">Test Video 1</a>
        <a href="${baseUrl}/stream/movie/simple2.json" target="_blank">Test Video 2</a>
        ${allVideos.length > 0 ? `<a href="${baseUrl}/stream/movie/${allVideos[0].id}.json" target="_blank">First Real Video</a>` : ''}
      </div>
    </body>
    </html>
  `);
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    version: "4.0.0",
    videosLoaded: allVideos.length,
    timestamp: new Date().toISOString(),
    server: "Express + Node.js"
  });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  console.log("📋 Manifest requested");
  
  const manifest = {
    id: "org.dakids.addon",
    version: "4.0.0",
    name: "Dakids TV",
    description: "YouTube cartoons for kids - iframe embed compatible",
    logo: "https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
    background: "https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
    resources: ["catalog", "stream"],
    types: ["movie"],
    idPrefixes: ["dk"],
    catalogs: [
      {
        type: "movie",
        id: "dakids",
        name: "🎬 Dakids Cartoons",
        extra: [
          { name: "genre", options: ["Animation", "Kids"], isRequired: false },
          { name: "skip", isRequired: false }
        ]
      },
      {
        type: "movie", 
        id: "test",
        name: "🧪 Test Videos"
      }
    ]
  };
  
  res.json(manifest);
});

// ===================== CATALOGS =====================
app.get("/catalog/movie/dakids.json", (req, res) => {
  console.log("📦 Main catalog requested");
  
  const metas = allVideos.map((video, index) => {
    // Crea ID semplici senza caratteri speciali
    const simpleId = `dk${index + 1}`;
    
    return {
      id: simpleId,
      type: "movie",
      name: video.title || `Video ${index + 1}`,
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      background: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`,
      description: video.title || "Kids cartoon video",
      releaseInfo: video.date || "2024",
      runtime: "6 min",
      genres: ["Animation", "Kids", "Family"],
      imdbRating: 8.0,
      // Salva l'ID YouTube in metadati per il retrieve
      behaviorHints: {
        bingeGroup: `dakids-${video.youtubeId}`
      }
    };
  });
  
  console.log(`📦 Sending ${metas.length} video metas`);
  res.json({ metas });
});

app.get("/catalog/movie/test.json", (req, res) => {
  console.log("🧪 Test catalog requested");
  
  const testMetas = [
    {
      id: "test1",
      type: "movie",
      name: "🧪 Test Video 1 - Me at the zoo",
      poster: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
      description: "First YouTube video ever - testing embed",
      genres: ["Test"],
      runtime: "19 sec"
    },
    {
      id: "simple2", 
      type: "movie",
      name: "🧪 Test Video 2 - Simple",
      poster: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
      description: "PSY - Gangnam Style (for embed testing)",
      genres: ["Test"],
      runtime: "4 min"
    }
  ];
  
  res.json({ metas: testMetas });
});

// ===================== STREAMS =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`\n🎬 ===== STREAM REQUEST =====`);
  console.log(`📍 Video ID: ${videoId}`);
  
  // Handle test videos
  if (videoId === "test1") {
    console.log("🧪 Serving test video 1");
    return res.json({
      streams: [{
        title: "▶️ Test Video - Me at the zoo",
        url: "https://www.youtube.com/embed/jNQXAC9IVRw?autoplay=1&rel=0&modestbranding=1",
        behaviorHints: {
          notWebReady: false
        }
      }]
    });
  }
  
  if (videoId === "simple2") {
    console.log("🧪 Serving test video 2");
    return res.json({
      streams: [{
        title: "▶️ Test Video - Gangnam Style",
        url: "https://www.youtube.com/embed/9bZkp7q19f0?autoplay=1&rel=0&modestbranding=1",
        behaviorHints: {
          notWebReady: false
        }
      }]
    });
  }
  
  // Handle real videos with simple ID system
  if (videoId.startsWith("dk")) {
    const videoIndex = parseInt(videoId.substring(2)) - 1; // dk1 -> index 0
    const video = allVideos[videoIndex];
    
    if (!video) {
      console.log(`❌ Video not found at index ${videoIndex}`);
      return res.status(404).json({
        streams: [],
        error: "Video not found"
      });
    }
    
    console.log(`✅ Found video: ${video.title}`);
    console.log(`🔗 YouTube ID: ${video.youtubeId}`);
    
    const stream = {
      streams: [{
        title: `▶️ ${video.title}`,
        url: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1&origin=https://web.stremio.com`,
        behaviorHints: {
          notWebReady: false,
          bingeGroup: `dakids-${video.youtubeId}`,
          countryWhitelist: ["IT", "US", "GB", "DE", "FR"]
        }
      }]
    };
    
    console.log(`📤 Sending stream for: ${video.title}`);
    return res.json(stream);
  }
  
  // Fallback for unknown IDs
  console.log(`❌ Unknown video ID format: ${videoId}`);
  res.status(404).json({
    streams: [],
    error: `Unknown video ID: ${videoId}`
  });
});

// ===================== DEBUG ROUTES =====================
app.get("/debug", (req, res) => {
  res.json({
    version: "4.0.0",
    totalVideos: allVideos.length,
    firstVideo: allVideos[0] || null,
    sampleIds: allVideos.slice(0, 3).map((v, i) => `dk${i + 1}`),
    testUrls: [
      "/stream/movie/test1.json",
      "/stream/movie/simple2.json",
      "/stream/movie/dk1.json"
    ]
  });
});

// ===================== ERROR HANDLING =====================
app.use((req, res) => {
  console.log(`❓ Unknown route: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: "Route not found",
    availableRoutes: ["/", "/manifest.json", "/catalog/movie/dakids.json", "/stream/movie/:id.json"]
  });
});

app.use((err, req, res, next) => {
  console.error("💥 Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ===================== SERVER START =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 DAKIDS ADDON SERVER STARTED");
  console.log("=".repeat(50));
  console.log(`📍 Port: ${PORT}`);
  console.log(`📺 Videos loaded: ${allVideos.length}`);
  console.log(`🔧 Version: 4.0.0 (Clean Final)`);
  console.log(`🌐 Status: Ready for Stremio`);
  console.log("=".repeat(50));
  
  if (allVideos.length > 0) {
    console.log("\n📋 Quick Tests:");
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`   Test Stream: http://localhost:${PORT}/stream/movie/test1.json`);
    console.log(`   Real Stream: http://localhost:${PORT}/stream/movie/dk1.json`);
  }
  
  console.log("\n✅ Ready for Stremio!");
});
