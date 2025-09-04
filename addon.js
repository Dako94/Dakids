#!/usr/bin/env node
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ VIDEO COMPATIBILI CON STREMIO (formato corretto)
const allVideos = [
  {
    "id": "tt6V0TR2BMN64", // ✅ DEVE iniziare con "tt"
    "title": "🎨 Dipingi e disegna con Pocoyo!",
    "ytId": "6V0TR2BMN64", // ID YouTube originale
    "duration": "07:32",
    "viewCount": 24476,
    "date": "2024-06-03"
  },
  {
    "id": "tt-mqNURU6twI",
    "title": "💖 Il nuovo profumo di Elly!",
    "ytId": "-mqNURU6twI",
    "duration": "01:02:41",
    "viewCount": 11279,
    "date": "2024-07-18"
  },
  {
    "id": "ttucjkAEQWKpg",
    "title": "🚌 Corri fino al traguardo con Pocoyo!",
    "ytId": "ucjkAEQWKpg", 
    "duration": "01:11:12",
    "viewCount": 16882,
    "date": "2024-06-14"
  }
];

// ✅ MANIFEST PER STREMIO
app.get("/manifest.json", (req, res) => {
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
        name: "Pocoyo Cartoons"
      }
    ],
    idPrefixes: ["tt"]
  });
});

// ✅ CATALOGO PER STREMIO
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  console.log("📦 Serving catalog with", allVideos.length, "videos");
  
  const metas = allVideos.map(video => ({
    id: video.id,
    type: "movie",
    name: video.title,
    poster: `https://i.ytimg.com/vi/${video.ytId}/maxresdefault.jpg`,
    background: `https://i.ytimg.com/vi/${video.ytId}/hqdefault.jpg`,
    description: `${video.title}\n\n👀 ${video.viewCount} visualizzazioni\n⏱️ ${video.duration}`,
    runtime: video.duration,
    released: video.date,
    genres: ["Animation", "Kids"],
    imdbRating: "7.5"
  }));
  
  res.json({ metas });
});

// ✅ STREAM PER STREMIO (usa externalUrl -> embed YouTube)
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log("🎬 Stream request for:", videoId);
  
  const video = allVideos.find(v => v.id === videoId);
  
  if (!video) {
    console.log("❌ Video not found:", videoId);
    return res.status(404).json({ error: "Video not found" });
  }
  
  console.log("✅ Serving stream for:", video.title);
  res.json({
    streams: [{
      title: video.title,
      externalUrl: `https://www.youtube.com/embed/${video.ytId}`
    }]
  });
});

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    videos: allVideos.length,
    message: "Dakids Addon is running"
  });
});

// ✅ HOMEPAGE con URL dinamici
app.get("/", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  const html = `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dakids TV Addon</title>
  </head>
  <body>
    <h1>📺 Dakids TV Addon</h1>
    <p>Status: ✅ Online</p>
    <p>Videos: ${allVideos.length}</p>
    <p>Manifest: <a href="${baseUrl}/manifest.json">${baseUrl}/manifest.json</a></p>
    <p>Catalog: <a href="${baseUrl}/catalog/movie/dakids-catalog.json">${baseUrl}/catalog/movie/dakids-catalog.json</a></p>
    <p>Health: <a href="${baseUrl}/health">${baseUrl}/health</a></p>
  </body>
  </html>`;
  
  res.send(html);
});

// ✅ AVVIO SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Dakids Addon running on port", PORT);
  console.log("📺 Videos:", allVideos.length);
});
