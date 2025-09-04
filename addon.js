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
        },
        {
            name: "Peppa Pig - Official Channel", 
            id: "UCAOtE1V7Ots4DjM8JLlrYgg",
        },
    ]
};

// Caricamento metadati
let allVideos = [];
try {
    const metaData = fs.readFileSync(path.join(__dirname, "meta.json"), "utf-8");
    allVideos = JSON.parse(metaData);
    console.log(`✅ Loaded ${allVideos.length} videos from meta.json`);
} catch (error) {
    console.log("❌ No meta.json found, using empty array");
    allVideos = [];
}

// Filtra video per canale (usa l'ID canale invece del nome)
const metaDatabase = userConfig.channels.map(channel => {
    const channelVideos = allVideos.filter(video => 
        video.channelUrl && video.channelUrl.includes(channel.id)
    );
    return {
        ...channel,
        metas: channelVideos
    };
});

console.log("📊 Channels summary:");
metaDatabase.forEach((channel, index) => {
    console.log(`   ${index}. ${channel.name}: ${channel.metas.length} videos`);
});

// Helper functions
function safeId(id) {
    return id ? encodeURIComponent(id.toString().trim()) : "unknown";
}

function processMetaDatabase(videos) {
    return videos.map((video, index) => ({
        id: `dakids-${index}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
        description: video.title || "Video",
        runtime: video.duration || "0:00",
    }));
}

// Manifest
app.get("/manifest.json", (req, res) => {
    res.json({
        id: "dakids-addon",
        version: "1.0.0",
        name: "📺 Dakids Addon",
        description: "Cartoni Pocoyo & Peppa Pig",
        resources: ["catalog", "stream"],
        types: ["movie"],
        catalogs: userConfig.channels.map((channel, index) => ({
            type: "movie",
            id: `channel-${index}`,
            name: channel.name,
        })),
        idPrefixes: ["tt"],
    });
});

// Cataloghi
app.get("/catalog/movie/channel-:index.json", (req, res) => {
    const index = parseInt(req.params.index);
    
    if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
        return res.status(404).json({ error: "Channel not found" });
    }

    const channel = metaDatabase[index];
    const metas = processMetaDatabase(channel.metas);
    
    res.json({ metas });
});

// Stream
app.get("/stream/movie/:metaId.json", (req, res) => {
    const metaId = req.params.metaId;
    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    
    if (!match) return res.status(404).json({ error: "Invalid ID" });

    const index = parseInt(match[1]);
    const videoId = decodeURIComponent(match[2]);

    if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
        return res.status(404).json({ error: "Channel not found" });
    }

    const channel = metaDatabase[index];
    const video = channel.metas.find(v => v.id === videoId);
    
    if (!video) return res.status(404).json({ error: "Video not found" });

    res.json({
        streams: [{
            title: "YouTube",
            url: `https://www.youtube.com/watch?v=${video.id}`
        }]
    });
});

// Health check
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        videos: allVideos.length,
        channels: metaDatabase.length 
    });
});

// Root
app.get("/", (req, res) => {
    res.json({ 
        message: "Dakids Addon", 
        status: "running" 
    });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
