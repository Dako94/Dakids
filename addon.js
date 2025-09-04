#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());

// Configurazione
const userConfig = {
    channels: [
        {
            name: "Pocoyo 🇮🇹 Italiano - Canale Ufficiale",
            id: "UCwQ-5RSINDVfzfxyTtQPSww",
        }
    ]
};

// Caricamento metadati
let allVideos = [];
try {
    const metaData = fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8");
    allVideos = JSON.parse(metaData);
    console.log(`✅ Loaded ${allVideos.length} videos from meta.json`);
} catch (error) {
    console.log("❌ No meta.json found");
    allVideos = [];
}

// Processa TUTTI i video in un unico canale
const metaDatabase = userConfig.channels.map(channel => ({
    ...channel,
    metas: allVideos.filter(video => video && video.id) // Filtra video validi
}));

console.log("📊 Channels summary:");
metaDatabase.forEach((channel, index) => {
    console.log(`   ${index}. ${channel.name}: ${channel.metas.length} videos`);
});

// Helper functions
function safeId(id) {
    return id ? encodeURIComponent(id.toString().trim()) : "unknown";
}

function processMetaDatabase(videos, channelIndex) {
    if (!videos || !Array.isArray(videos)) return [];
    
    return videos.map((video, videoIndex) => ({
        id: `dakids-${channelIndex}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: video.id ? `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg` : "",
        background: video.id ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : "",
        description: video.title || "Video",
        runtime: video.duration || "0:00",
        released: video.date ? video.date.split('T')[0] : "2025-01-01"
    })).filter(meta => meta.id && meta.name); // Filtra metadati validi
}

// Manifest SEMPLIFICATO
app.get("/manifest.json", (req, res) => {
    res.json({
        id: "dakids-addon",
        version: "1.0.0",
        name: "Dakids TV",
        description: "Cartoni animati per bambini",
        resources: ["catalog", "stream"],
        types: ["movie"],
        catalogs: [
            {
                type: "movie",
                id: "channel-0",
                name: "Pocoyo Cartoons",
            }
        ]
    });
});

// Cataloghi - SEMPLIFICATO
app.get("/catalog/movie/channel-0.json", (req, res) => {
    try {
        const channel = metaDatabase[0];
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        const metas = processMetaDatabase(channel.metas, 0);
        console.log(`📦 Sending ${metas.length} videos`);
        
        res.json({ metas });
    } catch (error) {
        console.error("Catalog error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// Stream - SEMPLIFICATO
app.get("/stream/movie/:metaId.json", (req, res) => {
    try {
        const metaId = req.params.metaId;
        const match = metaId.match(/^dakids-0-(.+)$/);
        
        if (!match) {
            return res.status(404).json({ error: "Invalid ID" });
        }

        const videoId = decodeURIComponent(match[1]);
        const video = allVideos.find(v => v && v.id === videoId);
        
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        res.json({
            streams: [{
                title: "YouTube",
                url: `https://www.youtube.com/watch?v=${videoId}`
            }]
        });
    } catch (error) {
        console.error("Stream error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// Health check
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        videos: allVideos.length,
        timestamp: new Date().toISOString()
    });
});

// Root
app.get("/", (req, res) => {
    res.json({ 
        message: "Dakids Addon", 
        status: "running",
        videos: allVideos.length
    });
});

// Avvio server
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📺 Total videos: ${allVideos.length}`);
});
