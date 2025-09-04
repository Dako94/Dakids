import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// LETTURA METADATA
let allVideos = [];
try {
  const data = fs.readFileSync("./meta.json", "utf-8");
  allVideos = JSON.parse(data);
  console.log(`📦 Caricati ${allVideos.length} video da meta.json`);
} catch (err) {
  console.error("❌ Errore nella lettura di meta.json:", err);
}

// FUNZIONE DI CONVERSIONE DURATA IN MINUTI
function durationToMinutes(duration) {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0]*60 + parts[1] + parts[2]/60;
  if (parts.length === 2) return parts[0] + parts[1]/60;
  return parseFloat(duration) || 0;
}

// CONVERSIONE DATA ISO
function formatDate(date) {
  // date = "20250901" -> "2025-09-01"
  return date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

// CATALOGO STREMIO
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

// STREAM
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

// MANIFEST
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "dakids.addon",
    version: "1.0.0",
    name: "Dakids TV",
    description: "Cartoni animati per bambini",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [
      { type: "movie", id: "dakids-catalog", name: "Cartoni e Video per Bambini" }
    ],
    idPrefixes: ["dakids-"]
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", videos: allVideos.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Dakids Addon running on port", PORT);
});
