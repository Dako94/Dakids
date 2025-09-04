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
  console.log(`📦 Caricati ${allVideos.length} video da meta.json`);
} catch (err) {
  console.error("❌ Errore nella lettura di meta.json:", err);
}

// ===================== FUNZIONI DI UTILITÀ =====================
function durationToMinutes(duration) {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0]*60 + parts[1] + parts[2]/60;
  if (parts.length === 2) return parts[0] + parts[1]/60;
  return parseFloat(duration) || 0;
}

function formatDate(date) {
  return date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

// ===================== CATALOGO =====================
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  const metas = allVideos.map(video => ({
    id: video.id,
    type: "movie",
    name: video.title,
    poster: video.thumbnail,
    background: video.thumbnail,
    description: `${video.title}\n\n👀 ${video.viewCount} visualizzazioni\n⏱️ ${video.duration}\nCanale: ${video.channelName}`,
    runtime: durationToMinutes(video.duration),
    released: formatDate(video.date),
    genres: ["Animation", "Kids"],
    imdbRating: "7.5"
  }));
  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  const video = allVideos.find(v => v.id === videoId);
  if (!video) return res.status(404).json({ error: "Video not found" });

  res.json({
    streams: [{
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.youtubeId}`
    }]
  });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "dakids.addon",
    version: "1.0.0",
    name: "Dakids TV",
    description: "Cartoni animati per bambini, divertenti e sicuri!",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [
      { type: "movie", id: "dakids-catalog", name: "Cartoni e Video per Bambini" }
    ],
    idPrefixes: ["dakids-"]
  });
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ status: "OK", videos: allVideos.length });
});

// ===================== HOMEPAGE =====================
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
      .video img { width: 100%; display: block; }
      .video-title { font-size: 0.9rem; padding: 0.5rem; background: #fffacd; }
    </style>
  </head>
  <body>
    <h1>🎬 Benvenuti su Dakids TV!</h1>
    <p>Cartoni animati e video divertenti per bambini di tutte le età.</p>
    <p>Status: ✅ Online | Videos disponibili: ${allVideos.length}</p>
    <p>Scarica il manifest Stremio: <a href="${baseUrl}/manifest.json">${baseUrl}/manifest.json</a></p>
    <p>Health Check: <a href="${baseUrl}/health">${baseUrl}/health</a></p>
    <hr>
    <h2>I nostri video più recenti</h2>
    <div>`;
  
  // Aggiungi i video dinamicamente
  allVideos.slice(0, 10).forEach(video => {
    htmlContent += `
      <div class="video">
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="video-title">${video.title}</div>
      </div>`;
  });

  htmlContent += `
    </div>
  </body>
  </html>`;
  
  res.send(htmlContent);
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Dakids Addon running on port", PORT);
  console.log(`📺 Video disponibili: ${allVideos.length}`);
  console.log(`📜 Manifest: http://localhost:${PORT}/manifest.json`);
  console.log(`📦 Catalog: http://localhost:${PORT}/catalog/movie/dakids-catalog.json`);
});
