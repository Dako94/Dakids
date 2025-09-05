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
  if (parts.length === 3) return parts[0]*60 + parts[1] + parts[2]/60;
  if (parts.length === 2) return parts[0] + parts[1]/60;
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
      a { text-decoration: none; color: #0077cc; }
      a:hover { text-decoration: underline; }
      .video { display: inline-block; margin: 1rem; border: 2px solid #ffd700; border-radius: 12px; overflow: hidden; width: 220px; }
      .video img { width: 100%; display: block; }
      .video-title { font-size: 0.9rem; padding: 0.5rem; background: #fffacd; }
      .container { max-width: 1200px; margin: 0 auto; }
      .btn { display: inline-block; padding: 10px 20px; background: #4ecdc4; color: white; border-radius: 25px; margin: 10px; text-decoration: none; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🎬 Benvenuti su Dakids TV!</h1>
      <p>Cartoni animati e video divertenti per bambini.</p>
      <p>Status: ✅ Online | Videos disponibili: ${allVideos.length}</p>
      
      <div style="margin: 20px 0;">
        <button class="btn" onclick="copyManifest()">📜 Copia Manifest Stremio</button>
        <a href="${baseUrl}/health" class="btn" target="_blank">❤️ Health Check</a>
        <a href="${baseUrl}/catalog/movie/dakids-catalog.json" class="btn" target="_blank">📦 Catalogo</a>
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
      
      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <h3>📋 Come installare su Stremio</h3>
        <p>1. Apri Stremio</p>
        <p>2. Vai su Addons → Installa da URL</p>
        <p>3. Incolla il link copiato cliccando il pulsante sopra</p>
      </div>
    </div>

    <script>
      function copyManifest() {
        const manifestURL = "${baseUrl}/manifest.json";
        navigator.clipboard.writeText(manifestURL)
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

// ===================== CATALOG =====================
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  const metas = allVideos.map(video => ({
    id: video.id,
    type: "movie",
    name: video.title,
    poster: video.thumbnail,
    description: video.title,
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
      url: `https://www.youtube.com/watch?v=${video.youtubeId}`,
      behaviorHints: { notWebReady: false }
    }]
  });
});

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "dakids.addon",
    version: "1.0.0",
    name: "Dakids TV",
    description: "Cartoni animati per bambini",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [{ type: "movie", id: "dakids-catalog", name: "Cartoni per Bambini" }],
    idPrefixes: ["tt"]
  });
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Dakids Addon running on port ${PORT}`);
  console.log(`📺 Videos disponibili: ${allVideos.length}`);
  console.log(`🌐 Manifest: http://localhost:${PORT}/manifest.json`);
});
