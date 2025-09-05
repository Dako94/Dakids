#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// ===================== LETTURA META.JSON =====================
let allVideos = [];
try {
  const data = fs.readFileSync("./meta.json", "utf-8");
  allVideos = JSON.parse(data);
  console.log(`📦 Caricati ${allVideos.length} video`);
} catch (err) {
  console.error("❌ Errore meta.json:", err);
  allVideos = [];
}

// ===================== FUNZIONI =====================
function formatDate(date) {
  return date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

// ===================== HOMEPAGE =====================
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
        <strong>📺 Videos:</strong> ${allVideos.length} caricati<br>
        <strong>🔧 Version:</strong> 4.1 con Meta Fix
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

// ===================== HEALTH =====================
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    version: "4.1.0",
    videosLoaded: allVideos.length,
    timestamp: new Date().toISOString(),
    server: "Dakids TV Addon"
  });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.dakids.addon",
    version: "4.1.0",
    name: "Dakids TV",
    description: "YouTube cartoons for kids - iframe embed",
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
        extra: [
          { name: "genre", options: ["Animation", "Kids"], isRequired: false }
        ]
      }
    ]
  });
});

// ===================== CATALOG =====================
app.get("/catalog/movie/dakids.json", (req, res) => {
  const metas = allVideos.map((video, index) => {
    const simpleId = `tt${index + 1}`;
    return {
      id: simpleId,
      type: "movie",
      name: video.title,
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      background: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`,
      description: video.title,
      releaseInfo: video.date ? formatDate(video.date) : "2024",
      runtime: video.duration || "6 min",
      genres: ["Animation", "Kids"],
      imdbRating: 7.5,
      behaviorHints: { bingeGroup: `tt${video.youtubeId}` }
    };
  });
  res.json({ metas });
});

// ===================== META =====================
app.get("/meta/:type/:id.json", (req, res) => {
  const { id } = req.params;

  if (!id.startsWith("tt")) {
    return res.status(404).json({ meta: {} });
  }

  const videoIndex = parseInt(id.substring(2)) - 1;
  const video = allVideos[videoIndex];

  if (!video) {
    return res.status(404).json({ meta: {} });
  }

  res.json({
    meta: {
      id,
      type: "movie",
      name: video.title,
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      background: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`,
      description: video.title,
      releaseInfo: video.date ? formatDate(video.date) : "2024",
      runtime: video.duration || "6 min",
      genres: ["Animation", "Kids"],
      imdbRating: "7.5",
      behaviorHints: {
        bingeGroup: `tt${video.youtubeId}`
      }
    }
  });
});

// ===================== STREAM =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId.startsWith("tt")) {
    return res.json({ streams: [] });
  }

  const videoIndex = parseInt(videoId.substring(2)) - 1;
  const video = allVideos[videoIndex];

  if (!video) {
    return res.json({ streams: [] });
  }

  res.json({
    streams: [{
      title: `▶️ ${video.title}`,
      url: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1&origin=https://web.stremio.com`,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: `tt${video.youtubeId}`,
        countryWhitelist: ["IT", "US", "GB", "DE", "FR"]
      }
    }]
  });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Dakids Addon avviato");
  console.log(`📍 Porta: ${PORT}`);
  console.log(`📺 Video caricati: ${allVideos.length}`);
});
