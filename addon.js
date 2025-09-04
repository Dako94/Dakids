// ===================== CATALOGO =====================
app.get("/catalog/movie/dakids-catalog.json", (req, res) => {
  console.log("📦 Catalog request received");
  
  const metas = allVideos.map(video => {
    // ✅ CORRETTO: "tt" senza trattino + ID YouTube
    const stremioId = video.id.startsWith('tt') ? video.id : `tt${video.youtubeId}`;
    
    return {
      id: stremioId, // Es: "tt6V0TR2BMN64"
      type: "movie",
      name: video.title || "Untitled",
      poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      background: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      description: video.title || "Video for kids",
      runtime: "90",
      released: "2024",
      genres: ["Animation", "Kids"],
      imdbRating: "7.5"
    };
  });
  
  console.log(`📦 Sending ${metas.length} videos to Stremio`);
  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/movie/:videoId.json", (req, res) => {
  const videoId = req.params.videoId;
  console.log(`🎬 Stream request for: ${videoId}`);
  
  // ✅ Cerca per ID YouTube (dopo "tt")
  const youtubeId = videoId.startsWith('tt') ? videoId.substring(2) : videoId;
  const video = allVideos.find(v => v.youtubeId === youtubeId);
  
  if (!video) {
    console.log("❌ Video not found for YouTube ID:", youtubeId);
    return res.status(404).json({ error: "Video not found" });
  }

  console.log(`✅ Found video: ${video.title}`);
  
  res.json({
    streams: [{
      title: video.title,
      ytId: video.youtubeId, // ✅ Usa l'ID YouTube originale
      behaviorHints: {
        notWebReady: true,
        bingeGroup: `yt-${video.youtubeId}`
      }
    }]
  });
});
