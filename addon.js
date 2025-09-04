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
    "id": "tt-mqNURU6twI", // ✅ DEVE iniziare con "tt"  
    "title": "💖 Il nuovo profumo di Elly!",
    "ytId": "-mqNURU6twI",
    "duration": "01:02:41",
    "viewCount": 11279,
    "date": "2024-07-18"
  },
  {
    "id": "ttucjkAEQWKpg", // ✅ DEVE iniziare con "tt"
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
    idPrefixes: ["tt"] // ✅ IMPORTANTE: dice a Stremio che i nostri ID iniziano con tt
  });
});

// ✅ CATALOGO PER STREMIO  
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  console.log("📦 Serving catalog with", allVideos.length, "videos");
  
  const metas = allVideos.map(video => ({
    id: video.id, // ✅ USA l'ID che inizia con tt
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

// ✅ STREAM PER STREMIO
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log("🎬 Stream request for:", videoId);
  
  // Trova il video per ID Stremio (che inizia con tt)
  const video = allVideos.find(v => v.id === videoId);
  
  if (!video) {
    console.log("❌ Video not found:", videoId);
    return res.status(404).json({ error: "Video not found" });
  }
  
  console.log("✅ Serving stream for:", video.title);
  res.json({
    streams: [{
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.ytId}`
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

// ✅ HOMEPAGE
app.get("/", (req, res) => {
  res.json({
    message: "Dakids Addon Server",
    version: "1.0.0",
    videos: allVideos.length,
    endpoints: {
      manifest: "/manifest.json",
      catalog: "/catalog/movie/dakids-catalog.json",
      health: "/health"
    }
  });
});

// ✅ AVVIO SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Dakids Addon running on port", PORT);
  console.log("📺 Videos:", allVideos.length);
  console.log("📜 Manifest: http://localhost:" + PORT + "/manifest.json");
  console.log("📦 Catalog: http://localhost:" + PORT + "/catalog/movie/dakids-catalog.json");
});
