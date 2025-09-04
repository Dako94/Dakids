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

// Filtra video per canale usando l'ID del canale dall'URL
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

function processMetaDatabase(videos, channelIndex) {
    return videos.map((video, videoIndex) => ({
        id: `dakids-${channelIndex}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
        background: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        description: `${video.title || "Video"} - ${video.viewCount || 0} visualizzazioni`,
        runtime: video.duration || "0:00",
        released: video.date ? video.date.split('T')[0] : "2025-01-01"
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
        background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
        logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
    });
});

// Cataloghi
app.get("/catalog/movie/channel-:index.json", (req, res) => {
    const index = parseInt(req.params.index);
    
    if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
        return res.status(404).json({ error: "Channel not found" });
    }

    const channel = metaDatabase[index];
    const metas = processMetaDatabase(channel.metas, index);
    
    console.log(`📦 Returning ${metas.length} videos for channel ${index}`);
    res.json({ metas });
});

// Stream - CORRETTO: ora cerca per video ID reale
app.get("/stream/movie/:metaId.json", (req, res) => {
    const metaId = req.params.metaId;
    console.log(`🎬 Stream requested for: ${metaId}`);

    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    
    if (!match) {
        console.log("❌ Invalid meta ID format");
        return res.status(404).json({ error: "Invalid ID format" });
    }

    const channelIndex = parseInt(match[1]);
    const videoId = decodeURIComponent(match[2]);

    console.log(`🔍 Looking for channel ${channelIndex}, video ID: ${videoId}`);

    if (isNaN(channelIndex) || channelIndex < 0 || channelIndex >= metaDatabase.length) {
        console.log("❌ Channel not found");
        return res.status(404).json({ error: "Channel not found" });
    }

    const channel = metaDatabase[channelIndex];
    console.log(`📺 Channel: ${channel.name}, videos: ${channel.metas.length}`);

    // Cerca il video per ID reale (non encoded)
    const video = channel.metas.find(v => v.id === videoId);
    
    if (!video) {
        console.log("❌ Video not found in channel");
        // Debug: lista tutti gli ID video nel canale
        const videoIds = channel.metas.map(v => v.id);
        console.log(`📋 Available video IDs: ${videoIds.join(', ')}`);
        return res.status(404).json({ error: "Video not found" });
    }

    console.log(`✅ Found video: ${video.title}`);
    res.json({
        streams: [{
            title: "YouTube",
            url: `https://www.youtube.com/watch?v=${video.id}`
        }]
    });
});

// Health check con info dettagliate
app.get("/health", (req, res) => {
    const channelInfo = metaDatabase.map((channel, index) => ({
        index: index,
        name: channel.name,
        videoCount: channel.metas.length,
        sampleVideos: channel.metas.slice(0, 2).map(v => v.id)
    }));

    res.json({ 
        status: "OK", 
        totalVideos: allVideos.length,
        channels: channelInfo,
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint per vedere la struttura dei dati
app.get("/debug", (req, res) => {
    res.json({
        metaDatabase: metaDatabase.map((channel, index) => ({
            channelIndex: index,
            channelName: channel.name,
            videoCount: channel.metas.length,
            videos: channel.metas.slice(0, 3).map(v => ({
                id: v.id,
                title: v.title,
                generatedId: `dakids-${index}-${safeId(v.id)}`
            }))
        }))
    });
});

// Root
app.get("/", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    
    res.json({ 
        message: "Dakids Addon Server", 
        status: "running",
        version: "1.0.0",
        channels: metaDatabase.length,
        totalVideos: totalVideos,
        endpoints: {
            manifest: "/manifest.json",
            health: "/health",
            debug: "/debug",
            catalog: "/catalog/movie/channel-0.json"
        }
    });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📜 Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`🐛 Debug: http://localhost:${PORT}/debug`);
    
    // Log dettagliato
    metaDatabase.forEach((channel, index) => {
        console.log(`   Channel ${index}: ${channel.name} - ${channel.metas.length} videos`);
        if (channel.metas.length > 0) {
            console.log(`     Sample ID: dakids-${index}-${safeId(channel.metas[0].id)}`);
        }
    });
});
