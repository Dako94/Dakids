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

// Serve media e immagini locali
app.use("/media", express.static(path.join(__dirname, "media")));
app.use("/images", express.static(path.join(__dirname, "images")));

// Forza redirect HTTP → HTTPS (su Render)
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// Carica meta.json
let seriesList = [];
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "meta.json"), "utf-8");
  seriesList = JSON.parse(raw);
  console.log(`✅ Caricate ${seriesList.length} serie`);
} catch (err) {
  console.error("❌ Errore meta.json:", err.message);
}

// Estrai tutti gli episodi
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

// Risolvi redirect GitHub → S3
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (e) {
    console.warn("⚠️ Errore HEAD redirect:", e.message);
  }
  return url;
}

/**
 * HOMEPAGE “BAMBINESCA”
 */
app.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
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
 * MANIFEST esterno
 */
app.get("/manifest.json", (_req, res) => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "manifest.json"), "utf-8")
  );
  res.json(manifest);
});

/**
 * CATALOG: per ogni canale (es. bluey, pocoyo)
 */
app.get("/catalog/channel/:id.json", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const id = req.params.id;
  const serie = seriesList.find(s => s.id === `dk-${id}`);
  if (!serie) return res.json({ metas: [] });

  const metas = serie.videos.map(ep => ({
    id: ep.id,
    type: "channel",
    name: ep.title,
    poster: ep.poster
  }));

  res.json({ metas });
});

/**
 * META: dettagli del canale
 */
app.get("/meta/channel/:id.json", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const id = req.params.id;
  const serie = seriesList.find(s => s.id === `dk-${id}`);
  if (!serie) return res.json({ meta: null });

  const videos = serie.videos.map(ep => ({
    id: ep.id,
    title: ep.title,
    overview: ep.title,
    thumbnail: ep.poster
  }));

  res.json({
    meta: {
      id: `dk-${id}`,
      type: "channel",
      name: serie.name,
      poster: `${base}/images/${id}.jpg`,
      description: `Episodi di ${serie.name}`,
      videos
    }
  });
});

/**
 * STREAM: restituisce il link diretto al video
 */
app.get("/stream/channel/:id.json", async (req, res) => {
  const allEpisodes = getAllEpisodes();
  const ep = allEpisodes.find(e => e.id === req.params.id);
  if (!ep) return res.json({ streams: [] });

  const fileUrl = await resolveFinalUrl(ep.video);

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

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon attivo su porta ${PORT}`);
});
