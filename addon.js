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

// ==========================
// Helper: Safe ID
// ==========================
function safeId(id) {
    if (!id) return "unknown";
    return encodeURIComponent(id.toString().trim());
}

// ==========================
// Configurazione Utente
// ==========================
const userConfig = {
    channels: [
        {
            name: "Pocoyo 🇮🇹 Italiano - Canale Ufficiale",
            id: "UCwQ-5RSINDVfzfxyTtQPSww",
            filter: "Pocoyo"
        },
        {
            name: "Peppa Pig - Official Channel", 
            id: "UCAOtE1V7Ots4DjM8JLlrYgg",
            filter: "Peppa"
        },
    ]
};

// ==========================
// Cache e Metadati
// ==========================
let metaDatabase = [];
let allVideos = [];

function loadMetaDatabase() {
    try {
        const metaFilePath = path.join(__dirname, "meta.json");
        console.log(`Loading meta file: ${metaFilePath}`);
        
        if (fs.existsSync(metaFilePath)) {
            const data = fs.readFileSync(metaFilePath, "utf-8");
            allVideos = JSON.parse(data);
            console.log(`Loaded ${allVideos.length} total videos from meta.json`);
            
            // Filtra i video per canale
            userConfig.channels.forEach(channel => {
                const channelVideos = allVideos.filter(video => 
                    video.channelName && video.channelName.includes(channel.filter)
                );
                
                console.log(`Found ${channelVideos.length} videos for ${channel.name}`);
                
                metaDatabase.push({
                    id: channel.id,
                    name: channel.name,
                    filter: channel.filter,
                    metas: channelVideos
                });
            });
            
            console.log(`Total channels processed: ${metaDatabase.length}`);
        } else {
            console.warn(`Meta file not found: ${metaFilePath}`);
            // Inizializza con array vuoti
            userConfig.channels.forEach(channel => {
                metaDatabase.push({
                    id: channel.id,
                    name: channel.name,
                    filter: channel.filter,
                    metas: []
                });
            });
        }
    } catch (error) {
        console.error("Error loading meta database:", error);
        // Inizializza comunque con array vuoti
        userConfig.channels.forEach(channel => {
            metaDatabase.push({
                id: channel.id,
                name: channel.name,
                filter: channel.filter,
                metas: []
            });
        });
    }
}

// ==========================
// Caricamento iniziale
// ==========================
loadMetaDatabase();

function processMetaDatabase(videos, channelName) {
    return videos.map((video, index) => ({
        id: `dakids-${index}-${safeId(video.id)}`,
        type: "movie",
        name: video.title || "Titolo Sconosciuto",
        poster: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
        background: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        description: `${video.title || "Video"} - ${video.viewCount || 0} visualizzazioni`,
        runtime: video.duration || "0:00",
        released: video.date ? video.date.split('T')[0] : "2025-01-01"
    }));
}

// ==========================
// Manifest
// ==========================
app.get("/manifest.json", (req, res) => {
    console.log("Manifest requested");
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
            extra: []
        })),
        idPrefixes: ["tt"],
        background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
        logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
    });
});

// ==========================
// Cataloghi
// ==========================
app.get("/catalog/movie/channel-:index.json", (req, res) => {
    const index = parseInt(req.params.index);
    console.log(`Catalog requested for channel ${index}`);
    
    if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
        return res.status(404).json({ error: "Canale non trovato" });
    }

    const channelMeta = metaDatabase[index];
    if (!channelMeta) {
        return res.status(404).json({ error: "Nessun meta disponibile" });
    }

    const metas = processMetaDatabase(channelMeta.metas, channelMeta.name);
    console.log(`Returning ${metas.length} videos for channel ${index} (${channelMeta.name})`);
    res.json({ metas });
});

app.get("/catalog/movie.json", (req, res) => {
    console.log("Default catalog requested");
    if (!metaDatabase[0]) {
        return res.status(404).json({ error: "Nessun meta disponibile" });
    }

    const metas = processMetaDatabase(metaDatabase[0].metas, metaDatabase[0].name);
    res.json({ metas });
});

// ==========================
// Stream
// ==========================
app.get("/stream/movie/:metaId.json", (req, res) => {
    const metaId = req.params.metaId;
    console.log(`Stream requested for: ${metaId}`);

    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    if (!match) return res.status(404).json({ error: "ID non valido" });

    const index = parseInt(match[1]);
    const encodedVideoId = match[2];

    if (isNaN(index) || index < 0 || index >= metaDatabase.length) {
        return res.status(404).json({ error: "Canale non trovato" });
    }

    const channelMeta = metaDatabase[index];
    if (!channelMeta) return res.status(404).json({ error: "Metadati non trovati" });

    const video = channelMeta.metas.find(v => safeId(v.id) === encodedVideoId);
    if (!video) return res.status(404).json({ error: "Video non trovato" });

    console.log(`Stream found: ${video.title}`);
    res.json({
        streams: [
            {
                title: "YouTube",
                url: `https://www.youtube.com/watch?v=${video.id}`
            }
        ]
    });
});

// ==========================
// Health Check
// ==========================
app.get("/health", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        channels: metaDatabase.length,
        totalVideos: totalVideos,
        environment: process.env.NODE_ENV || 'development'
    });
});

// ==========================
// Root endpoint
// ==========================
app.get("/", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    
    res.json({
        message: "Dakids Addon Server",
        status: "running",
        version: "1.0.0",
        stats: {
            channels: metaDatabase.length,
            totalVideos: totalVideos,
            allVideos: allVideos.length
        },
        endpoints: {
            manifest: "/manifest.json",
            health: "/health",
            catalog: "/catalog/movie/channel-0.json",
            debug: "/debug"
        }
    });
});

// ==========================
// Debug endpoint
// ==========================
app.get("/debug", (req, res) => {
    const totalVideos = metaDatabase.reduce((sum, channel) => sum + channel.metas.length, 0);
    
    res.json({
        server: {
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 3000,
            uptime: process.uptime()
        },
        metaFile: {
            name: "meta.json",
            exists: fs.existsSync(path.join(__dirname, "meta.json")),
            totalVideos: allVideos.length
        },
        channels: metaDatabase.map((channel, index) => ({
            id: channel.id,
            name: channel.name,
            filter: channel.filter,
            videoCount: channel.metas.length,
            sampleVideos: channel.metas.slice(0, 3).map(v => ({
                id: v.id,
                title: v.title,
                channel: v.channelName
            }))
        }))
    });
});

// ==========================
// Error Handling
// ==========================
app.use((req, res) => {
    res.status(404).json({ 
        error: "Endpoint non trovato",
        requestedUrl: req.url,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error("Errore del server:", err);
    res.status(500).json({ 
        error: "Errore interno del server",
        message: err.message
    });
});

// ==========================
// Start Server
// ==========================
const PORT = process.env.PORT || 3000;

// Verifica che il file meta.json esista
const metaFilePath = path.join(__dirname, "meta.json");
console.log("Verifica file meta:");
console.log(`meta.json: ${fs.existsSync(metaFilePath) ? '✅' : '❌'}`);

if (fs.existsSync(metaFilePath)) {
    try {
        const metaData = JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
        console.log(`Trovati ${metaData.length} video totali`);
        if (metaData.length > 0) {
            console.log("Primi 3 video:");
            metaData.slice(0, 3).forEach((video, i) => {
                console.log(`  ${i + 1}. ${video.title} (${video.channelName})`);
            });
        }
    } catch (error) {
        console.error("Errore nella lettura di meta.json:", error);
    }
}

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Dakids Addon server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`📜 Manifest: http://localhost:${PORT}/manifest.json`);
    
    // Log dei canali e video caricati
    console.log("\n📊 Canali caricati:");
    metaDatabase.forEach((channel, index) => {
        console.log(`  ${index}. ${channel.name}: ${channel.metas.length} video`);
    });
    
    if (process.env.NODE_ENV === 'production') {
        console.log('\n🌐 Environment: Production');
    } else {
        console.log('\n🔧 Environment: Development');
    }
});

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
