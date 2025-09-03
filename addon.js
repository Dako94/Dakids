#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import pkg from "yt-dlp-wrap";
const { YtDlpWrap } = pkg;
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`; // URL pubblico di Render

// Cartella per eventuali video salvati
const VIDEO_DIR = path.join(__dirname, "videos");
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR);

// Servi file statici (media, logo, background)
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/videos", express.static(VIDEO_DIR));

// Leggi metadata
const metaData = JSON.parse(fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8"));

// Raggruppa video per canale
function groupVideosByChannel(videos) {
  const channels = {};
  videos.forEach((video) => {
    if (!channels[video.channelName]) channels[video.channelName] = [];
    channels[video.channelName].push(video);
  });
  return { channels };
}

const metaDatabase = groupVideosByChannel(metaData);

function processMetaDatabase() {
  const channels = [];
  for (const [channelName, videos] of Object.entries(metaDatabase.channels)) {
    if (videos && videos.length > 0) {
      channels.push({
        name: channelName,
        videos: videos.map((video) => ({
          id: video.id.replace(/^_/, ""),
          url: video.url,
          title: video.title,
          thumbnail: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
          description: `${video.title} - ${video.viewCount || 0} visualizzazioni`,
          duration: video.duration,
          viewCount: video.viewCount || 0,
          likes: video.likes || 0,
          date: video.date,
        })),
      });
    }
  }
  return channels;
}

let userConfig = { channels: processMetaDatabase() };
const youtubedl = new YtDlpWrap(); // yt-dlp-wrap

// Funzione per ottenere stream da YouTube con cookie opzionali
async function getYouTubeStreamUrl(videoId) {
  try {
    const cookies = process.env.YOUTUBE_COOKIES || (fs.existsSync("./cookies.txt") ? fs.readFileSync("./cookies.txt", "utf-8") : "");
    const cookieHeader = cookies ? cookies.split(";").map((c) => c.trim()).join("; ") : null;

    const info = await youtubedl.execPromise(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ["referer:youtube.com", "user-agent:googlebot", ...(cookieHeader ? [`cookie:${cookieHeader}`] : [])],
    });

    const format = info.formats.find((f) => f.ext === "mp4" && f.acodec !== "none" && f.vcodec !== "none");
    return format?.url || `https://www.youtube.com/watch?v=${videoId}`;
  } catch (err) {
    console.error(`Errore yt-dlp per ${videoId}: ${err.message}`);
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
}

// Manifest Stremio
const manifest = {
  id: "com.dakids.Stremio",
  version: "2.0.0",
  name: "Dakids",
  description: "Video per bambini - Addon pronto all'uso con metadata completi",
  logo: `${BASE_URL}/media/icon.png`,
  background: `${BASE_URL}/media/background.jpg`,
  resources: ["catalog", "stream"],
  types: ["movie"],
  idPrefixes: ["dakids-"],
  catalogs: [],
};

function updateManifest() {
  manifest.catalogs = userConfig.channels.map((channel, index) => ({
    type: "movie",
    id: `channel-${index}`,
    name: channel.name,
    poster: channel.videos[0]?.thumbnail,
    background: channel.videos[0]?.thumbnail,
    genres: ["Bambini", "Animazione", "Educativo"],
  }));
}

updateManifest();

// ROUTE: manifest
app.get("/manifest.json", (req, res) => res.json(manifest));

// ROUTE: catalog
app.get("/catalog/movie/channel_:index.json", (req, res) => {
  const index = parseInt(req.params.index);
  const channel = userConfig.channels[index];
  if (!channel) return res.json({ metas: [] });

  const metas = channel.videos.map((video, videoIndex) => ({
    id: `dakids-${index}-${video.id}`,
    type: "movie",
    name: video.title,
    poster: video.thumbnail,
    posterShape: "landscape",
    background: video.thumbnail,
    description: video.description,
    genres: ["Bambini", channel.name],
    releaseInfo: video.date ? new Date(video.date).getFullYear().toString() : "2025",
    runtime: parseInt(video.duration.split(":")[1]) || 7,
    popularity: video.viewCount || (videoIndex + 1),
    isMovie: true,
  }));

  res.json({ metas });
});

// ROUTE: stream
app.get("/stream/movie/:metaId.json", async (req, res) => {
  const metaId = req.params.metaId;
  const match = metaId.match(/^dakids-(\d+)-(.+)$/);
  if (!match) return res.json({ streams: [] });

  const channelIndex = parseInt(match[1]);
  const videoId = match[2];
  const channel = userConfig.channels[channelIndex];
  if (!channel) return res.json({ streams: [] });

  const video = channel.videos.find((v) => v.id === videoId);
  if (!video) return res.json({ streams: [] });

  console.log("[STREAM REQUEST]", metaId);
  const streamUrl = await getYouTubeStreamUrl(videoId);

  res.json({
    streams: [
      {
        url: streamUrl,
        title: `YouTube - ${channel.name}`,
        name: "HD",
      },
    ],
  });
});

// ROUTE: reload database
app.post("/reload", (req, res) => {
  userConfig.channels = processMetaDatabase();
  updateManifest();
  res.json({ success: true, message: "Database ricaricato" });
});

// ROUTE: health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    channels: userConfig.channels.length,
    totalVideos: userConfig.channels.reduce((total, ch) => total + ch.videos.length, 0),
    version: "1.0.0",
  });
});

// ROUTE: semplice dashboard
app.get("/", (req, res) => {
  res.send(`<html><body>
    <h1>Dakids Addon</h1>
    <p>Stremio Manifest: <a href="/manifest.json">/manifest.json</a></p>
    <p>Ricarica database: <a href="/reload">/reload</a></p>
  </body></html>`);
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🎬 Dakids Addon avviato su port ${PORT}`);
});
