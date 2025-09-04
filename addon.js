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

// ===================== CATALOGO =====================
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  const metas = allVideos.map(video => ({
    id: video.id, // ✅ Già inizia con tt
    type: "movie",
    name: video.title,
    poster: video.thumbnail,
    description: video.title,
    runtime: "90",
    released: "2024",
    genres: ["Animation", "Kids"]
  }));
  
  res.json({ metas });
});

// ===================== STREAM - FORMATO IFRAME =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  const video = allVideos.find(v => v.id === videoId);
  
  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  // ✅ FORMATO CORRETTO PER IFRAME YOUTUBE
  res.json({
    streams: [{
      title: video.title,
      ytId: video.youtubeId, // Stremio usa questo per creare l'iframe
      behaviorHints: {
        notWebReady: true,
        bingeGroup: `yt-${video.youtubeId}`
      }
    }]
  });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "dakids.addon",
    version: "1.0.0",
    name: "Dakids TV",
    description: "Cartoni per bambini",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [{
      type: "movie", 
      id: "dakids-catalog", 
      name: "Cartoni per Bambini"
    }],
    idPrefixes: ["tt"]
  });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server avviato sulla porta", PORT);
  console.log("📺 Video caricati:", allVideos.length);
  console.log("📜 Manifest: http://localhost:" + PORT + "/manifest.json");
});
