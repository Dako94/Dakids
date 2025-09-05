#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

// import CommonJS come default e destruttura YtDlpWrap
import ytDlpWrapPkg from "yt-dlp-wrap";
const { YtDlpWrap } = ytDlpWrapPkg;

const app = express();
app.use(cors());
app.use(express.json());

const ytDlp = new YtDlpWrap("yt-dlp");

// Verifica che yt-dlp sia installato
ytDlp.execPromise(["--version"])
  .then(v => console.log(`✅ yt-dlp versione ${v.trim()}`))
  .catch(() => {
    console.error("❌ yt-dlp non trovato. Installa con `pip3 install yt-dlp`");
    process.exit(1);
  });

// Carica episodi
let episodes = [];
try {
  episodes = JSON.parse(fs.readFileSync("./meta.json", "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (e) {
  console.error("❌ Errore leggendo meta.json:", e.message);
}

// Risolvi URL diretto o fallback YouTube
async function getDirectUrl(youtubeId) {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    const out = await ytDlp.execPromise([videoUrl, "-f", "best[ext=mp4]", "-g"]);
    return out.trim();
  } catch {
    console.warn(`⚠️ Fallback a watch URL per ${youtubeId}`);
    return videoUrl;
  }
}

// Homepage banale
app.get("/", (req, res) => {
  const proto   = req.get("x-forwarded-proto") || req.protocol;
  const host    = req.get("host");
  const baseUrl = `${proto}://${host}`;
  res.send(`<html><body>Copia manifest: <code>${baseUrl}/manifest.json</code></body></html>`);
});

// Manifest Stremio
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids",
    description: "Pocoyo 🇮🇹 – Episodi per bambini da YouTube",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog","meta","stream"],
    catalogs: [{ type: "channel", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }]
  });
});

// Catalog
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  res.json({
    metas: [{
      id: "dk-pocoyo",
      type: "channel",
      name: "Pocoyo 🇮🇹",
      poster: episodes[0]?.poster || "",
      description: "Episodi divertenti per bambini",
      genres: ["Animation","Kids"]
    }]
  });
});

// Meta
app.get("/meta/channel/dk-pocoyo.json", (req, res) => {
  res.json({
    meta: {
      id: "dk-pocoyo",
      type: "channel",
      name: "Pocoyo 🇮🇹",
      poster: episodes[0]?.poster || "",
      description: "Episodi divertenti per bambini",
      background: episodes[0]?.poster || "",
      genres: ["Animation","Kids"]
    }
  });
});

// Stream
app.get("/stream/channel/dk-pocoyo.json", async (req, res) => {
  const streams = await Promise.all(
    episodes.map(async ep => ({
      title: ep.title,
      url: await getDirectUrl(ep.youtubeId),
      behaviorHints: { notWebReady: false }
    }))
  );
  res.json({ streams });
});

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`));
