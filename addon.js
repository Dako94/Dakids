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
function durationToMinutes(duration) {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parseFloat(duration) || 0;
}

function formatDate(date) {
  return date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

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
    <title>Dakids TV - Addon Stremio</title>
    <style>
      body { font-family: Arial, sans-serif; background: #fffae3; color: #333; text-align: center; padding: 2rem; }
      h1 { color: #ff6f61; }
      a, button { text-decoration: none; color: white; background: #4ecdc4; padding: 10px 20px; border-radius: 25px; margin: 5px; cursor: pointer; display: inline-block; }
      a:hover, button:hover { background: #45b3a3; }
      .video { display: inline-block; margin: 1rem; border: 2px solid #ffd700; border-radius: 12px; overflow: hidden; width: 220px; }
      .video img { width: 100%; display: block; }
      .video-title { font-size: 0.9rem; padding: 0.5rem; background: #fffacd; }
      .container { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🎬 Benvenuti su Dakids TV!</h1>
      <p>Cartoni animati e video divertenti per bambini.</p>
      <p>Status: ✅ Online | Videos disponibili: ${allVideos.length}</p>
      
      <div>
        <button onclick="copyManifest()">📜 Copia Manifest Stremio</button>
        <a href="${baseUrl}/health" target="_blank">❤️ Health Check</a>
        <a href="${baseUrl}/catalog/movie/dakids.json" target="_blank">📦 Catalogo</a>
      </div>
      
      <hr>
      <h2>I nostri video più recenti</h2>
      <div>`;
  
  allVideos.slice(0, 12).forEach(video => {
    htmlContent += `
      <div class="video">
        <img src="${video.thumbnail}" alt="${video.title}" onerror="this.src='https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg'">
        <div class="video-title">${video.title}</div>
      </div>`;
  });

  htmlContent += `
      </div>
    </div>

    <script>
      function copyManifest() {
        navigator.clipboard.writeText("${baseUrl}/manifest.json")
          .then(() => alert("✅ Manifest copiato negli appunti!"))
          .catch(() => alert("❌ Impossibile copiare manifest"));
      }
    </script>
  </body>
  </html>
  `;

  res.send(htmlContent);
});

// ===================== HEALTH CHECK =====================
app.get("/health", (req, res) => {
  res.json({ status: "OK", videos: allVideos.length, server: "Dakids TV Addon" });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "dakids.addon",
    version: "1.0.1",
    name: "Dakids TV",
    description: "Cartoni animati per bambini - iframe embed compatible",
    resources: ["catalog", "stream"],
    types: ["movie"],
    idPrefixes: ["dk"],
    catalogs: [
      {
        type: "movie",
        id: "dakids",
        name: "Cartoni per Bambini",
        logo: "https://i.imgur.com/K1264cT.png",
        poster: "https://i.imgur.com/gO6vKzB.png"
      }
    ]
  });
});

// ===================== CATALOG =====================
app.get("/catalog/movie/dakids.json", (req, res) => {
  const metas = allVideos.map(video => {
    const runtimeInMinutes = Math.floor(durationToMinutes(video.duration));
    return {
      id: video.id,
      type: "movie",
      name: video.title,
      poster: video.thumbnail,
      description: video.title,
      released: formatDate(video.date),
      runtime: `${runtimeInMinutes} min`, 
      posterShape: "regular",
      genres: ["Animation", "Kids"],
      behaviorHints: { bingeGroup: video.youtubeId }
    };
  });
  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  
  const video = allVideos.find(v => v.id === videoId);

  if (!video) {
    console.error(`❌ Video non trovato con ID: ${videoId}`);
    return res.status(404).json({ streams: [] });
  }

  res.json({
    streams: [{
      title: video.title,
      url: `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`,
      behaviorHints: { notWebReady: false, bingeGroup: video.youtubeId }
    }]
  });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Dakids Addon running on port ${PORT}`);
  console.log(`📺 Videos disponibili: ${allVideos.length}`);
  console.log(`🌐 Manifest: http://localhost:${PORT}/manifest.json`);
});
