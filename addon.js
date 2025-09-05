#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// — Carica episodi da meta.json —
// meta.json deve contenere un array di oggetti:
// { "youtubeId": "MCYRCGxNyZk", "title": "Titolo episodio", "poster": "https://..." }
let episodes;
try {
  episodes = JSON.parse(fs.readFileSync("./meta.json", "utf-8"));
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (err) {
  console.error("❌ Errore leggendo meta.json:", err.message);
  episodes = [];
}

// — Homepage di cortesia —
app.get("/", (req, res) => {
  const proto   = req.get("x-forwarded-proto") || req.protocol;
  const host    = req.get("host");
  const baseUrl = `${proto}://${host}`;
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:2rem">
      <h1>🎉 Dakids – Pocoyo 🇮🇹</h1>
      <p>Copia questo URL in Stremio:</p>
      <code>${baseUrl}/manifest.json</code>
    </body></html>
  `);
});

// — Manifest.json —
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Dakids",
    description: "Pocoyo 🇮🇹 – Episodi per bambini",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      { type: "channel", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }
    ]
  });
});

// — Catalog/channel/pocoyo.json —
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  res.json({
    metas: [
      {
        id: "dk-pocoyo",
        type: "channel",
        name: "Pocoyo 🇮🇹",
        poster: episodes[0]?.poster || "",
        description: "Episodi divertenti per bambini",
        genres: ["Animation", "Kids"]
      }
    ]
  });
});

// — Meta/channel/dk-pocoyo.json —
app.get("/meta/channel/dk-pocoyo.json", (req, res) => {
  res.json({
    meta: {
      id: "dk-pocoyo",
      type: "channel",
      name: "Pocoyo 🇮🇹",
      poster: episodes[0]?.poster || "",
      description: "Episodi divertenti per bambini",
      background: episodes[0]?.poster || "",
      genres: ["Animation", "Kids"]
    }
  });
});

// — Stream/channel/dk-pocoyo.json —
// Restituisce per ogni episodio sia l'iframe (per Web) che l'url (per tutti gli altri client)
app.get("/stream/channel/dk-pocoyo.json", (req, res) => {
  const streams = episodes.map(ep => {
    const watchUrl  = `https://www.youtube.com/watch?v=${ep.youtubeId}`;
    const embedUrl  = `https://www.youtube.com/embed/${ep.youtubeId}?autoplay=1&rel=0`;

    return {
      title: ep.title,
      // usato da clienti nativi (Desktop, Android, TV)
      url: watchUrl,
      // usato da Stremio Web per montare l'iframe
      iframe: `
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;">
          <iframe
            width="100%"
            height="100%"
            src="${embedUrl}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>`.trim(),
      behaviorHints: { notWebReady: false }
    };
  });

  console.log("🔍 /stream returned", streams.length, "streams");
  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
