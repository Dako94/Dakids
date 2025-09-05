#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// — Carica la lista di episodi da meta.json —
let episodes = [];
try {
  const raw = fs.readFileSync(path.resolve("./meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi da meta.json`);
} catch (err) {
  console.error("❌ Impossibile leggere meta.json:", err.message);
  episodes = [];
}

// — Root → redirect a manifest.json —
app.get("/", (req, res) => {
  res.redirect("/manifest.json");
});

// — 1) Manifest.json —
app.get("/manifest.json", (req, res) => {
  console.log("📄 /manifest.json richiesto");
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

// — 2) Catalog: un solo canale —
app.get("/catalog/channel/pocoyo.json", (req, res) => {
  console.log("📚 /catalog/channel/pocoyo.json richiesto");
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

// — 3) Meta del canale —
app.get("/meta/channel/dk-pocoyo.json", (req, res) => {
  console.log("📋 /meta/channel/dk-pocoyo.json richiesto");
  const ep = episodes[0] || {};
  res.json({
    meta: {
      id: "dk-pocoyo",
      type: "channel",
      name: ep.title || "Pocoyo 🇮🇹",
      poster: ep.poster || "",
      description: ep.title || "Episodi divertenti per bambini",
      background: ep.poster || "",
      genres: ["Animation", "Kids"]
    }
  });
});

// — 4) Stream: iframe universale YouTube —
app.get("/stream/channel/dk-pocoyo.json", (req, res) => {
  console.log("🎬 /stream/channel/dk-pocoyo.json richiesto");
  const streams = episodes.map(ep => {
    const embedUrl = `https://www.youtube.com/embed/${ep.youtubeId}?autoplay=1&rel=0`;
    return {
      title: ep.title,
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

  console.log(`🔍 /stream restituisce ${streams.length} stream`);
  res.json({ streams });
});

// — Avvia il server —
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dakids Addon attivo su http://localhost:${PORT}`);
});
