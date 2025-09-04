#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ LETTURA METADATA DA FILE
let allVideos = [];
try {
  const data = fs.readFileSync("./meta.json", "utf-8");
  allVideos = JSON.parse(data);
  console.log(`📦 Caricati ${allVideos.length} video da meta.json`);
} catch (err) {
  console.error("❌ Errore nella lettura di meta.json:", err);
}

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
        name: "Cartoni e Video per Bambini"
      }
    ],
    idPrefixes: ["dakids-"]
  });
});

// ✅ CATALOGO PER STREMIO
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  const metas = allVideos.map(video => ({
    id: video.id,
    type: "movie",
    name: video.title,
    poster: video.thumbnail,
    background: video.thumbnail,
    description: `${video.title}\n\n👀 ${video.viewCount} visualizzazioni\n⏱️ ${video.duration}\nCanale: ${video.channelName}`,
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
  const video = allVideos.find(v => v.id === videoId);

  if (!video) return res.status(404).json({ error: "Video not found" });

  res.json({
    streams: [{
      title: video.title,
      externalUrl: video.url
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
  console.log("📺 Videos disponibili:", allVideos.length);
});
