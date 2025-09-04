#!/usr/bin/env node
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import pkg from "yt-dlp-wrap";
import { fileURLToPath } from "url";
import { dirname } from "path";

const { YtDlpWrap } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(cors());

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
            metasFile: "pocoyo_metas.json",
        },
        {
            name: "Peppa Pig - Official Channel",
            id: "UCAOtE1V7Ots4DjM8JLlrYgg",
            metasFile: "peppapig_metas.json",
        },
    ]
};

// ==========================
// Cache e Metadati
// ==========================
let metaDatabase = [];

function loadMetaDatabase() {
    metaDatabase = [];
    userConfig.channels.forEach(channel => {
        const filePath = path.join(__dirname, channel.metasFile);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf-8");
            const metas = JSON.parse(data);
            metaDatabase.push({
                id: channel.id,
                name: channel.name,
                metas
            });
        }
    });
}

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
        released: video.date || "2025-01-01"
    }));
}

// ==========================
// Manifest (ESSENZIALE per Stremio)
// ==========================
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
            extra: []
        })),
        // Aggiungi questi campi richiesti da Stremio
        idPrefixes: ["tt"],
        background: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg",
        logo: "https://i.ytimg.com/vi/6V0TR2BMN64/maxresdefault.jpg"
    });
});

// ==========================
// ENDPOINT CATALOGO (richiesto da Stremio)
// ==========================
app.get("/catalog/movie/channel-:index.json", (req, res) => {
    const index = parseInt(req.params.index);
    const channel = userConfig.channels[index];
    
    if (!channel) {
        return res.status(404).json({ error: "Canale non trovato" });
    }

    const channelMeta = metaDatabase.find(m => m.id === channel.id);
    if (!channelMeta) {
        return res.status(404).json({ error: "Nessun meta disponibile" });
    }

    const metas = processMetaDatabase(channelMeta.metas, channel.name);
    res.json({ metas });
});

// ENDPOINT ALTERNATIVO (alcune versioni di Stremio usano questo formato)
app.get("/catalog/movie.json", (req, res) => {
    // Restituisce il primo canale come default
    const channelMeta = metaDatabase[0];
    if (!channelMeta) {
        return res.status(404).json({ error: "Nessun meta disponibile" });
    }

    const metas = processMetaDatabase(channelMeta.metas, userConfig.channels[0].name);
    res.json({ metas });
});

// ==========================
// ENDPOINT STREAM (richiesto da Stremio)
// ==========================
app.get("/stream/movie/:metaId.json", (req, res) => {
    const metaId = req.params.metaId;

    const match = metaId.match(/^dakids-(\d+)-(.+)$/);
    if (!match) return res.status(404).json({ error: "ID non valido" });

    const index = parseInt(match[1]);
    const encodedVideoId = match[2];

    const channel = userConfig.channels[index];
    if (!channel) return res.status(404).json({ error: "Canale non trovato" });

    const channelMeta = metaDatabase.find(m => m.id === channel.id);
    if (!channelMeta) return res.status(404).json({ error: "Metadati non trovati" });

    const video = channelMeta.metas.find(v => safeId(v.id) === encodedVideoId);
    if (!video) return res.status(404).json({ error: "Video non trovato" });

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
// ENDPOINT DI SUPPORTO PER STREMIO
// ==========================
app.get("/:resource/:type/:id.json", (req, res) => {
    const { resource, type, id } = req.params;
    
    if (resource === "catalog" && type === "movie") {
        if (id.startsWith("channel-")) {
            const index = parseInt(id.replace("channel-", ""));
            const channel = userConfig.channels[index];
            
            if (!channel) return res.status(404).json({ error: "Canale non trovato" });

            const channelMeta = metaDatabase.find(m => m.id === channel.id);
            if (!channelMeta) return res.status(404).json({ error: "Nessun meta disponibile" });

            const metas = processMetaDatabase(channelMeta.metas, channel.name);
            return res.json({ metas });
        }
    }
    
    if (resource === "stream" && type === "movie") {
        const match = id.match(/^dakids-(\d+)-(.+)$/);
        if (!match) return res.status(404).json({ error: "ID non valido" });

        const index = parseInt(match[1]);
        const encodedVideoId = match[2];

        const channel = userConfig.channels[index];
        if (!channel) return res.status(404).json({ error: "Canale non trovato" });

        const channelMeta = metaDatabase.find(m => m.id === channel.id);
        if (!channelMeta) return res.status(404).json({ error: "Metadati non trovati" });

        const video = channelMeta.metas.find(v => safeId(v.id) === encodedVideoId);
        if (!video) return res.status(404).json({ error: "Video non trovato" });

        return res.json({
            streams: [
                {
                    title: "YouTube",
                    url: `https://www.youtube.com/watch?v=${video.id}`
                }
            ]
        });
    }

    res.status(404).json({ error: "Endpoint non trovato" });
});

// ==========================
// Health Check (importante per Stremio)
// ==========================
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        videos: metaDatabase.reduce((sum, c) => sum + c.metas.length, 0)
    });
});

// ==========================
// Root endpoint
// ==========================
app.get("/", (req, res) => {
    res.redirect("/manifest.json");
});

// ==========================
// Debug endpoint
// ==========================
app.get("/debug", (req, res) => {
    res.json({
        channels: userConfig.channels,
        metaDatabase: metaDatabase.map(m => ({
            id: m.id,
            videoCount: m.metas.length,
            firstVideo: m.metas[0] ? {
                originalId: m.metas[0].id,
                safeId: safeId(m.metas[0].id),
                generatedId: `dakids-0-${safeId(m.metas[0].id)}`
            } : null
        }))
    });
});

// ==========================
// Error Handling
// ==========================
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint non trovato" });
});

app.use((err, req, res, next) => {
    console.error("Errore del server:", err);
    res.status(500).json({ error: "Errore interno del server", message: err.message });
});

// ==========================
// Start Server
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dakids Addon in ascolto su http://localhost:${PORT}`);
    console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Debug: http://localhost:${PORT}/debug`);
});
