// ===================== MANIFEST =====================
app.get("/manifest.json", (req, res) => {
  console.log("📥 Manifest richiesto");
  res.json({
    id: "com.dakids.Stremio",
    version: "3.0.0",
    name: "Dakids",
    description: "Video per bambini - riproduzione diretta da YouTube",
    logo: "https://i.imgur.com/K1264cT.png",
    background: "https://i.imgur.com/gO6vKzB.png",
    resources: ["catalog", "stream"],
    types: ["movie"],
    idPrefixes: ["dk"], // ✅ prefisso corretto
    catalogs: [
      {
        type: "movie",
        id: "dakids",
        name: "Cartoni per Bambini"
      }
    ]
  });
});

// ===================== CATALOG =====================
app.get("/catalog/movie/dakids.json", (req, res) => {
  console.log("📥 Catalogo richiesto");
  console.log("Video disponibili:", allVideos.length);

  if (!allVideos.length) {
    console.warn("⚠️ Nessun video trovato, invio esempio");
    return res.json({
      metas: [
        {
          id: "dk_test1",
          type: "movie",
          name: "Esempio Video",
          poster: "https://i.imgur.com/K1264cT.png",
          description: "Questo è un video di esempio",
          runtime: "1 min",
          genres: ["Animation", "Kids"]
        }
      ]
    });
  }

  const metas = allVideos.map(video => ({
    id: video.id.startsWith("dk") ? video.id : `dk${video.id}`, // ✅ prefisso dk
    type: "movie",
    name: video.title,
    poster: video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
    description: video.title,
    runtime: `${Math.floor(durationToMinutes(video.duration))} min`,
    genres: ["Animation", "Kids"]
  }));

  res.json({ metas });
});

// ===================== STREAM =====================
app.get("/stream/movie/:videoId.json", async (req, res) => {
  const videoId = req.params.videoId;
  console.log(`📥 Stream richiesto per ID: ${videoId}`);

  const video = allVideos.find(v => v.id === videoId);
  if (!video) {
    console.error(`❌ Video non trovato con ID: ${videoId}`);
    return res.status(404).json({ streams: [] });
  }

  console.log(`🔍 Cerco URL diretto per: ${video.youtubeId} (${video.title})`);
  const directUrl = await getDirectUrl(video.youtubeId);

  if (!directUrl) {
    console.warn(`⚠️ Nessun URL diretto trovato, uso fallback YouTube`);
    return res.json({
      streams: [{
        title: `${video.title} (Apri su YouTube)`,
        externalUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
        behaviorHints: { notWebReady: true }
      }]
    });
  }

  console.log(`✅ URL diretto trovato per ${video.youtubeId}`);
  res.json({
    streams: [{
      title: video.title,
      url: directUrl,
      behaviorHints: { notWebReady: false }
    }]
  });
});
