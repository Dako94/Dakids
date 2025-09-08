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

// Per redirect HTTP→HTTPS su Render
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.get("x-forwarded-proto") === "http") {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// Carico manifest e meta direttamente da file
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "manifest.json"), "utf-8")
);
const seriesList = JSON.parse(
  fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8")
);

// Helper: mi ricavo “https://tuo-host” da ogni richiesta
function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Risolve il redirect 302 di GitHub Release → S3 e restituisce l’URL vero
async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
      return res.headers.get("location");
    }
  } catch (e) {
    console.warn("⚠️ HEAD redirect error:", e.message);
  }
  return url;
}

/**
 * HOMEPAGE “BAMBINESCA”
 */
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
    h1 { font-size: 3rem; color: #ff69b4; }
    p  { font-size: 1.25rem; margin-bottom: 2rem; }
    #copy-btn {
      background: linear-gradient(45deg,#ffb3c1,#ffc107);
      border:none; border-radius:50px;
      color:white; font-size:1.5rem;
      padding:.75rem 2rem; cursor:pointer;
      box-shadow:0 4px 6px rgba(0,0,0,0.1);
    }
    #notice {
      margin-top:1rem; font-size:1rem;
      color:#007700; opacity:0;
      transition:opacity .3s;
    }
    .balloon { font-size:5rem; animation:float 3s ease-in-out infinite; }
    @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-20px);} }
  </style>
</head>
<body>
  <div class="balloon">🎉🎈🎁</div>
  <h1>Benvenuto su Dakids!</h1>
  <p>Clicca qui sotto per copiare l’URL del manifest e incollalo in Stremio → Add-ons → Manifest URL</p>
  <button id="copy-btn">📋 Copia manifest</button>
  <div id="notice">Manifest copiato! Ora apri Stremio → Add-ons → Manifest URL</div>
  <script>
    const btn    = document.getElementById('copy-btn');
    const notice = document.getElementById('notice');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('${manifestUrl}');
        notice.style.opacity = '1';
        setTimeout(() => notice.style.opacity = '0', 2500);
      } catch {
        alert('Copia manuale:\n${manifestUrl}');
      }
    });
  </script>
</body>
</html>`);
});

/**
 * MANIFEST (lo rispondo esattamente come nel tuo file)
 */
app.get("/manifest.json", (_req, res) => {
  res.json(manifest);
});

/**
 * CATALOG: Stremio, per ogni catalog entry di tipo "series" 
 * (quelle che hai in manifest.json), chiamerà /catalog/series/:id.json
 */
app.get("/catalog/series/:id.json", (req, res) => {
  const catalog = manifest.catalogs.find(c => c.id === req.params.id);
  if (!catalog) {
    return res.json({ metas: [] });
  }

  // trovo la corrispondente serie in meta.json
  const serie = seriesList.find(s => s.id === catalog.id);
  if (!serie) {
    return res.json({ metas: [] });
  }

  // ogni video diventa un "meta" item
  const metas = serie.videos.map(ep => ({
    id:       ep.id,
    type:     "series",
    name:     ep.title,
    poster
