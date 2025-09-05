#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import pkg from "yt-dlp-wrap";
const YTDlpWrap = pkg.default;

const app = express();
app.use(cors());
app.use(express.json());

// ===================== CONFIG YT-DLP + COOKIES =====================
const cookiesEnv = process.env.YTDLP_COOKIES || process.env.YOUTUBE_COOKIES;
if (cookiesEnv) {
  fs.writeFileSync("/tmp/cookies.txt", cookiesEnv);
  console.log("🍪 Cookies salvati in /tmp/cookies.txt");
}

const ytDlpWrap = new YTDlpWrap("yt-dlp");

ytDlpWrap.execPromise(["--version"])
  .then(v => console.log("✅ yt-dlp versione rilevata:", v.trim()))
  .catch(err => {
    console.error("❌ yt-dlp non trovato o non eseguibile:", err);
    console.error("Suggerimento: assicurati che 'pip install -U yt-dlp' sia nel Build Command di Render");
  });

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
  if (!duration || typeof duration !== "string") return 0;
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 1) return parts[0];
  return 0;
}

function formatDate(date) {
  if (!date || typeof date !== "string") return undefined;
  return date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

async function getDirectUrl(youtubeId) {
  try {
    const args = [
      `https://www.youtube.com/watch?v=${youtubeId}`,
      "-f", "best[ext=mp4]",
      "-g"
    ];
    if (cookiesEnv) {
      args.push("--cookies", "/tmp/cookies.txt");
    }
    const output = await ytDlpWrap.execPromise(args);
    return output.trim();
  } catch (err) {
    console.error("❌ Errore yt-dlp durante estrazione URL:", err);
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
    logo: "https://tuo-dominio.it/media/icon.png",
    background: "https://tuo-dominio.it/media/background.jpg",
    resources: ["catalog", "stream"],
    types: ["channel"],
    idPrefixes: ["dk"],
    catalogs: [
      {
        type: "channel",
        id: "dakids",
        name: "Cartoni per Bambini",
        extra: [{ name: "search", isRequired: false }]
      }
    ]
  });
});

// ===================== CATALOG =====================
app.get("/catalog/channel/dakids.json", (req, res) => {
  const metas = allVideos.map(video => {
    const runtimeInMinutes = durationToMinutes(video.duration);
    const releasedDate = formatDate(video.date);

    return {
      id: video.id.startsWith("dk") ? video.id : `dk${video.id}`,
      type: "channel",
      name: video.title || "Video senza titolo",
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      description: video.title || "Nessuna descrizione",
      released: releasedDate,
      runtime: `${Math.floor(runtimeInMinutes)} min`,
      genres: ["Animation", "Kids"],
      behaviorHints: { bingeGroup: video.youtubeId }
    };
  });

  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/channel/:videoId.json", async (req, res) => {
  const videoId = req.params.videoId;
  const video = allVideos.find(v =>
    v.id === videoId || `dk${v.id}` === videoId || videoId === `dk${v.id}`
  );

  if (!video || !video.youtubeId) {
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
      behaviorHints: {
        notWebReady: false,
        bingeGroup: video.youtubeId
      }
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
