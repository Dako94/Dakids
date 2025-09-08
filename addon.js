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

// Espone media e immagini locali
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/images", express.static(path.join(__dirname, "images")));

// Forza redirect HTTP→HTTPS (Render)
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// Carica manifest e meta.json
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "manifest.json"), "utf-8")
);
const seriesList = JSON.parse(
  fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8")
);

// Helper per base URL dinamico
function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Segue redirect GitHub Release → S3 per i video
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (err) {
    console.warn("⚠️ HEAD redirect error:", err.message);
  }
  return url;
}

/**
 * HOMEPAGE “BAMBINESCA”
 */
app.get("/", (req, res) => {
  const base       = getBaseUrl(req);
  const manifestUrl = `${base}/manifest.json`;
  res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>🎈 Installa Dakids su Stremio! 🎈</title>
  <style>
    body { background: #ffe4e1; font-family: 'Comic Sans MS', cursive; text-align: center; padding:2rem; }
    h1   { font-size: 3rem; color:#ff69b4; }
    p    { font-size:1.2rem; margin-bottom:2rem; }
    #copy-btn {
      background: linear-gradient(45deg,#ffb3c1,#ffc107);
      border:none; border-radius:50px; color:white;
      font-size:1.3rem; padding:.75rem 2rem; cursor:pointer;
      box-shadow:0 4px 6px rgba(0,0,0,0.1);
    }
    #notice {
      margin-top:1rem; font-size:1rem; color:#007700;
      opacity:0; transition:opacity .3s;
    }
    .balloon { font-size:5rem; animation:float 3s ease-in-out infinite; }
    @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-20px);} }
  </style>
</head>
<body>
  <div class="balloon">🎉🎈🎁</div>
  <h1>Benvenuto su Dakids!</h1>
  <p>Clicca per copiare l’URL del manifest e incollalo in Stremio → Add-ons → Manifest URL</p>
  <button id="copy-btn">📋 Copia manifest</button>
  <div id="notice">Manifest copiato! Apri Stremio e incolla l’URL</div>
  <script>
    const btn    = document.getElementById('copy-btn');
    const notice = document.getElementById('notice');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('${manifestUrl}');
        notice.style.opacity = '1';
        setTimeout(() => notice.style.opacity = '0', 2500);
      } catch {
        alert('Copia manuale:\\n${manifestUrl}');
      }
    });
  </script>
</body>
</html>`);
});

/**
 * MANIFEST
 */
app.get("/manifest.json", (_req, res) => {
  res.json(manifest);
});

/**
 * CATALOG: lista canali
 */
app.get("/catalog/channel/dakids.json", (req, res) => {
  const base     = getBaseUrl(req);
  const channels = seriesList.map(s => s.name || s.id);
  const metas = channels.map(channel => {
    const id      = `dk-${channel.toLowerCase().replace(/\s+/g, "-")}`;
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

/**
 * META: episodi per un canale
 */
app.get("/meta/channel/:id.json", (req, res) => {
  const base   = getBaseUrl(req);
  const rawId  = req.params.id.replace("dk-", "").replace(/-/g, " ").toLowerCase();
  const allEps = seriesList.flatMap(s =>
    (Array.isArray(s.videos) ? s.videos : []).map(ep => ({
      ...ep,
      channel: s.name || s.id
    }))
  );
  const filtered = allEps.filter(e => e.channel.toLowerCase() === rawId);
  const videos = filtered.map(ep => ({
    id: ep.id,
    title: ep.title,
    overview: ep.title,
    thumbnail: ep.poster
  }));

  res.json({
    meta: {
      id: req.params.id,
      type: "channel",
      name: filtered[0]?.channel || rawId,
      poster: `${base}/images/${req.params.id.replace("dk-", "")}.jpg`,
      description: `Episodi di ${filtered[0]?.channel || rawId}`,
      videos
    }
  });
});

/**
 * STREAM: link diretto al video
 */
app.get("/stream/channel/:id.json", async (req, res) => {
  const allEps = seriesList.flatMap(s => s.videos || []);
  const ep     = allEps.find(e => e.id === req.params.id);
  if (!ep) return res.json({ streams: [] });

  const directUrl = await resolveFinalUrl(ep.video);
  res.json({
    streams: [{
      title: ep.title,
      url: directUrl,
      subtitles: [],
      behaviorHints: { notWebReady: false }
    }]
  });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon in ascolto sulla porta ${PORT}`);
});
