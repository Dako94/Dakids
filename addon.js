#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// Carica episodi da meta.json
let episodes = [];
try {
  const raw = fs.readFileSync(path.resolve("./meta.json"), "utf-8");
  episodes = JSON.parse(raw);
  console.log(`✅ Caricati ${episodes.length} episodi`);
} catch (e) {
  console.error("❌ Errore leggendo meta.json:", e.message);
}

// Estrai il miglior flusso HLS o MP4 progressivo
async function getStreamUrl(id) {
  const url = `https://www.youtube.com/watch?v=${id}`;
  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: { headers: { Cookie: process.env.YOUTUBE_COOKIES || "" } }
    });
    // 1) HLS (m3u8)
    const hls = ytdl.chooseFormat(info.formats, f =>
      f.mimeType && f.mimeType.includes("mpegurl")
    );
    if (hls && hls.url) return hls.url;
    // 2) MP4 audio+video
    const prog = ytdl.chooseFormat(info.formats, f =>
      f.container === "mp4" && f.hasVideo && f.hasAudio
    );
    if (prog && prog.url) return prog.url;
  } catch (err) {
    console.warn(`⚠️ Impossibile risolvere stream ${id}: ${err.message}`);
  }
  // Fallback: link YouTube
  return url;
}

// 1) Manifest (type "channel")
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.dakids",
    version: "1.0.0",
    name: "Pocoyo 🇮🇹 – Dakids",
    description: "Canale YouTube Pocoyo in italiano",
    types: ["channel"],
    idPrefixes: ["dk"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
      { type: "channel", id: "pocoyo", name: "Pocoyo 🇮🇹", extra: [] }
    ]
  });
});

// 2) Catalog: lista canali (uno solo)
app.get("/catalog/channel/pocoyo.json", (_req, res) => {
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

// 3) Meta del canale
app.get("/meta/channel/dk-pocoyo.json", (_req, res) => {
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

// 4) Stream: estrae url in-app per ogni episodio
app.get("/stream/channel/dk-pocoyo.json", async (_req, res) => {
  const streams = await Promise.all(
    episodes.map(async ep => {
      const sUrl = await getStreamUrl(ep.youtubeId);
      return {
        title: ep.title,
        url: sUrl,
        behaviorHints: { notWebReady: false }
      };
    })
  );
  console.log(`🔍 Restituiti ${streams.length} stream`);
  res.json({ streams });
});

// Avvia server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Dakids Addon attivo su port ${PORT}`)
);
