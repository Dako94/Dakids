#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pkg from "yt-dlp-wrap";

const { YtDlpWrap } = pkg;
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

// Inizializza yt-dlp-wrap
let ytDlpWrap;
try {
    ytDlpWrap = new YtDlpWrap();
    console.log("✅ yt-dlp-wrap initialized");
} catch (error) {
    console.log("❌ yt-dlp-wrap initialization failed:", error.message);
    ytDlpWrap = null;
}

// Verifica presenza cookies.txt
const cookiesPath = path.join(__dirname, "cookies.txt");
if (fs.existsSync(cookiesPath)) {
    console.log("✅ Cookies.txt found");
} else {
    console.log("❌ Cookies.txt not found - some videos may not work");
}

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

// Funzione per ottenere stream URL con yt-dlp-wrap e cookies
function getStreamUrl(videoId, callback) {
    if (!ytDlpWrap) {
        console.log("yt-dlp-wrap not available, using fallback");
        return callback(null, `https://www.youtube.com/watch?v=${videoId}`);
    }

    const args = [
        '-f', 'best[height<=720]',
        '--get-url',
        `https://www.youtube.com/watch?v=${videoId}`
    ];

    // Aggiungi cookies se esistono
    if (fs.existsSync(cookiesPath)) {
        args.push('--cookies', cookiesPath);
    }

    ytDlpWrap.exec(args)
        .then((output) => {
            const streamUrl = output.join('').trim();
            if (streamUrl) {
                callback(null, streamUrl);
            } else {
                console.error("yt-dlp-wrap returned empty output");
                callback(null, `https://www.youtube.com/watch?v=${videoId}`);
            }
        })
        .catch((error) => {
            console.error("yt-dlp-wrap error:", error);
            callback(null, `https://www.youtube.com/watch?v=${videoId}`);
        });
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

// Stream con supporto cookies
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

    const video = channel.metas.find(v => v.id === videoId);
    
    if (!video) {
        console.log("❌ Video not found in channel");
        return res.status(404).json({ error: "Video not found" });
    }

    console.log(`✅ Found video: ${video.title}`);

    // Usa yt-dlp-wrap per ottenere l'URL dello stream con cookies
    getStreamUrl(videoId, (error, streamUrl) => {
        if (error) {
            console.error("Error getting stream URL:", error);
            // Fallback al link YouTube diretto
            res.json({
                streams: [{
                    title: "YouTube",
                    url: `https://www.youtube.com/watch?v=${videoId}`
                }]
            });
        } else {
            console.log(`📺 Stream URL obtained`);
            res.json({
                streams: [{
                    title: streamUrl.includes('youtube.com') ? "YouTube" : "Direct Stream",
                    url: streamUrl
                }]
            });
        }
    });
});

// Health check
app.get("/health", (req, res) => {
    const hasCookies = fs.existsSync(cookiesPath);
    
    res.json({ 
        status: "OK", 
        totalVideos: allVideos.length,
        hasCookies: hasCookies,
        ytDlpAvailable: !!ytDlpWrap,
        channels: metaDatabase.length,
        timestamp: new Date().toISOString()
    });
});

// Root
app.get("/", (req, res) => {
    const hasCookies = fs.existsSync(cookiesPath);
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    
    res.json({ 
        message: "Dakids Addon Server", 
        status: "running",
        hasCookies: hasCookies,
        ytDlpAvailable: !!ytDlpWrap,
        version: "1.0.0",
        channels: metaDatabase.length,
        totalVideos: totalVideos,
        endpoints: {
            manifest: "/manifest.json",
            health: "/health",
            catalog: "/catalog/movie/channel-0.json"
        }
    });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    const hasCookies = fs.existsSync(cookiesPath);
    console.log(`🍪 Cookies: ${hasCookies ? '✅ Found' : '❌ Not found'}`);
    console.log(`📦 yt-dlp-wrap: ${ytDlpWrap ? '✅ Available' : '❌ Not available'}`);
    
    // Log dettagliato
    metaDatabase.forEach((channel, index) => {
        console.log(`   Channel ${index}: ${channel.name} - ${channel.metas.length} videos`);
    });
});
