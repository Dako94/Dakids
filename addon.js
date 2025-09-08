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

// Forza HTTP → HTTPS (su Render e simili)
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

// Restituisce il base URL dinamico (http/https + host)
function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Segue il redirect 302 di GitHub Release → AWS S3
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (err) {
    console.warn("⚠️ Errore HEAD redirect per", url, err.message);
  }
  return url;
}

/**
 * 1) HOMEPAGE “BAMBINESCA”
 */
app.get("/", (req, res) => {
  const base       = getBaseUrl(req);
  const manifestUrl = `${base}/manifest.json`;

  res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>🎈 Installa Dakids su Stremio! 🎈</title>
  <style>
    body { background: #ffe4e1; font-family: 'Comic Sans MS', cursive; text-align: center; padding: 2rem; }
    h1   { font-size: 3rem; margin: .5rem 0; color: #ff69b4; }
    p    { font-size: 1.2rem; margin-bottom: 2rem; }
    #copy-btn {
      background: linear-gradient(45deg,#ffb3c1,#ffc107);
      border: none; border-radius: 50px;
      color: white; font-size: 1.3rem;
      padding: .75rem 2rem; cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    #notice {
      margin-top: 1rem; font-size: 1rem;
      color: #007700; opacity: 0;
      transition: opacity .3s;
    }
    .balloon { font-size: 5rem; animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-20px); } }
  </style>
</head>
<body>
  <div class="balloon">🎉🎈🎁</div>
  <h1>Benvenuto su Dakids!</h1>
  <p>Clicca per copiare l’URL del manifest e incollalo in Stremio → Add-ons → Manifest URL</p>
  <button id="copy-btn">📋 Copia manifest</button>
  <div id="notice">Manifest copiato! Ora apri Stremio e incolla l’URL</div>
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
 * 2) MANIFEST
 */
app.get("/manifest.json", (_req, res) => {
  res.json(manifest);
});

/**
 * 3) CATALOG: lista di episodi per ogni serie
 *    Stremio chiama /catalog/series/:id.json
 */
app.get("/catalog/series/:id.json", (req, res) => {
  const catalogEntry = manifest.catalogs.find(c => c.id === req.params.id);
  if (!catalogEntry) {
    return res.json({ metas: [] });
  }

  // Mappa “bluey” → “dk-bluey” o “dk-bluey-*”
  const prefix = `dk-${req.params.id}`;
  const serie  = seriesList.find(s => s.id === prefix || s.id.startsWith(`${prefix}-`));
  if (!serie) {
    return res.json({ metas: [] });
  }

  // Ogni video diventa un meta con poster e titolo
  const metas = serie.videos.map(ep => ({
    id:     ep.id,
    type:   "series",
    name:   ep.title,
    poster: ep.poster
  }));

  res.json({ metas });
});

/**
 * 4) META: dettagli di una singola serie (opzionale, ma incluso)
 *    Stremio chiama /meta/series/:id.json
 */
app.get("/meta/series/:id.json", (req, res) => {
  const prefix = `dk-${req.params.id}`;
  const serie  = seriesList.find(s => s.id === prefix || s.id.startsWith(`${prefix}-`));
  if (!serie) {
    return res.json({ meta: null });
  }

  res.json({
    meta: {
      id:          serie.id,
      type:        "series",
      name:        serie.name,
      poster:      serie.poster,
      description: serie.name
    }
  });
});

/**
 * 5) STREAM: restituisce il vero URL del file MP4
 *    Stremio chiama /stream/series/:id.json
 */
app.get("/stream/series/:id.json", async (req, res) => {
  // Trova l'episodio
  const allEps = seriesList.flatMap(s => s.videos);
  const ep     = allEps.find(e => e.id === req.params.id);
  if (!ep) {
    return res.json({ streams: [] });
  }

  // Segui redirect GitHub Release → S3
  const directUrl = await resolveFinalUrl(ep.video);

  res.json({
    streams: [
      {
        title:         ep.title,
        url:           directUrl,
        subtitles:     [],                   // array vuoto, niente “:null”
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids 🇮🇹 Addon in ascolto sulla porta ${PORT}`);
});
