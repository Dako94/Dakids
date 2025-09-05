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
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");
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
        <strong>🔧 Version:</strong> Dakids v1.0
      </div>

      <div class="links">
        <h3>🔗 Addon Links:</h3>
        <a href="${baseUrl}/manifest.json" target="_blank">📋 Manifest</a>
        <a href="${baseUrl}/catalog/movie/dakids.json" target="_blank">📦 Catalog</a>
        <a href="${baseUrl}/health" target="_blank">❤️ Health</a>
      </div>
    </body>
    </html>
  `);
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    version: "1.0.0",
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
    version: "1.0.0",
    name: "Dakids TV",
    description: "YouTube cartoons for kids - iframe embed compatible",
    logo: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    background: "https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
    resources: ["catalog", "meta", "stream"],
    types: ["movie"],
    idPrefixes: ["tt"],
    catalogs: [
      {
        type: "movie",
        id: "dakids",
        name: "🎬 Dakids Cartoons",
        extra: [{ name: "skip", isRequired: false }]
      }
    ]
  };

  res.json(manifest);
});

// ===================== CATALOG =====================
app.get("/catalog/movie/dakids.json", (req, res) => {
  console.log("📦 Catalog requested");

  const metas = allVideos.map((video, index) => {
    return {
      id: `tt${index + 1}`,
      type: "movie",
      name: video.title || `Video ${index + 1}`,
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      background: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`,
      description: video.title || "Kids cartoon video",
      releaseInfo: video.date || "2024",
      runtime: video.duration || "6 min",
      genres: ["Animation", "Kids", "Family"],
      imdbRating: 8.0,
      behaviorHints: {
        bingeGroup: `tt${video.youtubeId}`
      }
    };
  });

  console.log(`📦 Sending ${metas.length} video metas`);
  res.json({ metas });
});

// ===================== STREAMS =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`\n🎬 ===== STREAM REQUEST =====`);
  console.log(`📍 Video ID: ${videoId}`);

  if (videoId.startsWith("tt")) {
    const videoIndex = parseInt(videoId.substring(2)) - 1;
    const video = allVideos[videoIndex];

    if (!video) {
      console.log(`❌ Video not found at index ${videoIndex}`);
      return res.status(404).json({ streams: [], error: "Video not found" });
    }

    console.log(`✅ Found video: ${video.title}`);
    console.log(`🔗 YouTube ID: ${video.youtubeId}`);

    const stream = {
      streams: [
        {
          title: `▶️ ${video.title}`,
          url: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1&origin=https://web.stremio.com`,
          behaviorHints: {
            notWebReady: false,
            bingeGroup: `tt${video.youtubeId}`,
            countryWhitelist: ["IT", "US", "GB", "DE", "FR"]
          }
        }
      ]
    };

    console.log(`📤 Sending stream for: ${video.title}`);
    return res.json(stream);
  }

  console.log(`❌ Unknown video ID format: ${videoId}`);
  res.status(404).json({ streams: [], error: `Unknown video ID: ${videoId}` });
});

// ===================== SERVER START =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 DAKIDS ADDON SERVER STARTED");
  console.log("=".repeat(50));
  console.log(`📍 Port: ${PORT}`);
  console.log(`📺 Videos loaded: ${allVideos.length}`);
  console.log(`🔧 Version: 1.0.0 (Dakids)`);
  console.log(`🌐 Status: Ready for Stremio`);
  console.log("=".repeat(50));

  if (allVideos.length > 0) {
    console.log("\n📋 Quick Tests:");
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`   Real Stream: http://localhost:${PORT}/stream/movie/tt1.json`);
  }

  console.log("\n✅ Ready for Stremio!");
});
