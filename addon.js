#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Costruisce dinamicamente il baseURL (http/https + host)
function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Espone statico media e immagini
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/images", express.static(path.join(__dirname, "images")));

// Forza redirect HTTP → HTTPS (su Render e simili)
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// Carica il file meta.json
let seriesList = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8");
  seriesList = JSON.parse(raw);
  console.log(`✅ Caricate ${seriesList.length} serie da meta.json`);
} catch (err) {
  console.error("❌ Errore durante il parsing di meta.json:", err.message);
}

// Ritorna tutti gli episodi in un array flat
function getAllEpisodes() {
  return seriesList.flatMap(series =>
    Array.isArray(series.videos)
      ? series.videos.map(ep => ({
          ...ep,
          channel: series.name || series.id,
          seriesId: series.id
        }))
      : []
  );
}

// Risolve eventuali redirect GitHub Release → S3 restituendo l'URL finale
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (err) {
    console.warn("⚠️ Impossibile seguire redirect per", url, err.message);
  }
  return url;
}

// Homepage divertente per installare il manifest
app.get("/", (req, res) => {
  const base = getBaseUrl(req);
  const manifestUrl = `${base}/manifest.json`;
  res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>🎈 Installa Dakids su Stremio! 🎈</title>
  <style>
    body {
      background: #ffe4e1;
      font-family: 'Comic Sans MS', cursive, sans-serif;
      text-align: center;
      padding: 2rem;
      color: #333;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: .5rem;
      color: #ff69b4;
      text-shadow: 1px 1px #fff;
    }
    p {
      font-size: 1.25rem;
      margin: 1rem 0 2rem;
    }
    #copy-btn {
      background: linear-gradient(45deg, #ffb3c1, #ffc107);
      border: none;
      border-radius: 50px;
      color: white;
      font-size: 1.5rem;
      padding: .75rem 2rem;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform .1s ease-in-out, box-shadow .1s;
    }
    #copy-btn:active {
      transform: scale(.95);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    #notice {
      margin-top: 1rem;
      font-size: 1rem;
      color: #007700;
      opacity: 0;
      transition: opacity .3s;
    }
    .balloon {
      font-size: 5rem;
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }
  </style>
</head>
<body>
  <div class="balloon">🎉🎈🎁</div>
  <h1>Benvenuto su Dakids!</h1>
  <p>Per aggiungerci a Stremio, copia il nostro manifest cliccando il pulsante qui sotto.</p>
  <button id="copy-btn">Copia manifest</button>
  <div id="notice">Manifest copiato! Apri Stremio → Add-ons → Manifest URL</div>

  <script>
    const btn = document.getElementById('copy-btn');
    const notice = document.getElementById('notice');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('${manifestUrl}');
        notice.style.opacity = '1';
        setTimeout(() => notice.style.opacity = '0', 2500);
      } catch {
        alert('Impossibile copiare. Copia manualmente:\\n${manifestUrl}');
      }
    });
  </script>
</body>
</html>`);
});

// Manifest Stremio
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids 🇮🇹",
    description: "Cartoni per bambini in italiano",
    logo: "https://dakids.onrender.com/media/icon.png",
    background: "https://dakids.onrender.com/media/background.jpg",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      { type: "channel", id: "dakids", name: "Dakids 🇮🇹", extra: [] }
    ]
  });
});

// Catalog: lista di canali
app.get("/catalog/channel/dakids.json", (req, res) => {
  const base = getBaseUrl(req);
  const channels = seriesList.map(s => s.name || s.id);
  const metas = channels.map(channel => {
    const id = `dk-${channel.toLowerCase().replace(/\s+/g, "-")}`;
    const imgName = id.replace("dk-", "");
    return {
      id,
      type: "channel",
      name: channel,
      poster: `${base}/images/${imgName}.jpg`,
      description: `Episodi di ${channel}`,
      genres: ["Kids"]
    };
  });
  res.json({ metas });
});

// Meta per un singolo canale
app.get("/meta/channel/:id.json", (req, res) => {
  const base = getBaseUrl(req);
  const rawId = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const all = getAllEpisodes();
  const filtered = all.filter(e => e.channel.toLowerCase() === rawId);
  const channelName = filtered[0]?.channel || rawId;
  const posterName = req.params.id.replace("dk-", "");

  const videos = filtered.map(ep => ({
    id: ep.id,
    title: ep.title,
    overview: ep.title,
    thumbnail: `${base}/images/${ep.id.replace("dk--", "")}.jpg`
  }));

  res.json({
    meta: {
      id: req.params.id,
      type: "channel",
      name: channelName,
      poster: `${base}/images/${posterName}.jpg`,
      description: `Episodi di ${channelName}`,
      videos
    }
  });
});

// Stream: restituisce il flusso con link diretto
app.get("/stream/channel/:id.json", async (req, res) => {
  const all = getAllEpisodes();
  const ep = all.find(e => e.id === req.params.id);
  if (!ep) {
    return res.json({ streams: [] });
  }

  let fileUrl = ep.video;
  fileUrl = await resolveFinalUrl(fileUrl);

  res.json({
    streams: [
      {
        title: ep.title,
        url: fileUrl,
        subtitles: [],
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon in ascolto sulla porta ${PORT}`);
});
