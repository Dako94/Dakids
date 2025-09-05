#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import YTDlpWrap from "yt-dlp-wrap";

const app = express();
app.use(cors());
app.use(express.json());

const ytDlpWrap = new YTDlpWrap(); // usa yt-dlp installato nel sistema

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

async function getDirectUrl(youtubeId) {
  try {
    const output = await ytDlpWrap.execPromise([
      `https://www.youtube.com/watch?v=${youtubeId}`,
      "-f", "best[ext=mp4]",
      "-g"
    ]);
    return output.trim();
  } catch (err) {
    console.error("❌ Errore yt-dlp:", err);
    return null;
  }
}

// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.dakids.Stremio",
    version: "3.0.0",
    name: "Dakids",
    description: "Video per bambini - riproduzione diretta da YouTube",
    logo: "https://i.imgur.com/K1264cT.png",
    background: "https://i.imgur.com/gO6vKzB.png",
    resources: ["catalog", "stream"],
    types: ["movie"],
    idPrefixes: ["dk_"],
    catalogs: [
      {
        type: "movie",
        id: "dakids",
        name: "Cartoni per Bambini",
        extra: [{ name: "search", isRequired: false }]
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
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
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
app.get("/stream/movie/:videoId.json", async (req, res) => {
  const videoId = req.params.videoId;
  const video = allVideos.find(v => v.id === videoId);

  if (!video) {
    console.error(`❌ Video non trovato con ID: ${videoId}`);
    return res.status(404).json({ streams: [] });
  }

  const directUrl = await getDirectUrl(video.youtubeId);

  if (!directUrl) {
    return res.json({
      streams: [{
        title: `${video.title} (Apri su YouTube)`,
        externalUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
        behaviorHints: { notWebReady: true }
      }]
    });
  }

  res.json({
    streams: [{
      title: video.title,
      url: directUrl,
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
