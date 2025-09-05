#!/usr/bin/env python3
import yt_dlp
import json
import time

# ===================== FUNZIONI =====================
def get_channel_videos(channel_url, max_videos=20):
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'dump_single_json': True,
        'playlistend': max_videos,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(channel_url, download=False)
            return result.get('entries', [])
    except Exception as e:
        print(f"❌ Error: {e}")
        return []

def get_video_details(video_urls):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }
    
    videos_data = []
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for i, video_url in enumerate(video_urls):
            try:
                print(f"📹 Processing video {i+1}/{len(video_urls)}")
                info = ydl.extract_info(video_url, download=False)
                
                youtube_id = info['id']
                
                video_data = {
                    'id': f"dk{youtube_id}",           # ✅ MODIFICATO: dk invece di tt
                    'youtubeId': youtube_id,           # ✅ ID YouTube originale
                    'title': info.get('title', 'No Title'),
                    'viewCount': info.get('view_count', 0),
                    'date': info.get('upload_date', '20240101'),
                    'duration': info.get('duration_string', '0:00'),
                    'channelName': info.get('channel', 'Unknown Channel'),
                    'thumbnail': f"https://i.ytimg.com/vi/{youtube_id}/maxresdefault.jpg"
                }
                
                videos_data.append(video_data)
                print(f"   ✅ Added video: {video_data['id']}")
                time.sleep(0.2)
            except Exception as e:
                print(f"❌ Error processing video: {e}")
    
    return videos_data

# ===================== MAIN =====================
def main():
    channels = [
        "https://www.youtube.com/@PocoyoItaliano/videos",
        "https://www.youtube.com/@peppapigofficial/videos",
        "https://www.youtube.com/@PJMasksOfficial/videos",
        "https://www.youtube.com/@HeyDuggeeOfficial/videos",
    ]
    
    all_videos = []

    for channel in channels:
        print(f"\n🔍 Scraping channel: {channel}")
        videos = get_channel_videos(channel)
        if not videos:
            continue
        video_urls = [f"https://www.youtube.com/watch?v={v['id']}" for v in videos if 'id' in v]
        print(f"📺 Found {len(video_urls)} videos")
        details = get_video_details(video_urls[:10])  # massimo 10 video per canale
        all_videos.extend(details)
        print(f"✅ Total videos collected: {len(all_videos)}")
        time.sleep(1)

    # Salva meta.json
    with open('meta.json', 'w', encoding='utf-8') as f:
        json.dump(all_videos, f, ensure_ascii=False, indent=2)
    
    print(f"\n🎉 SUCCESS! meta.json generato con {len(all_videos)} video")
    print("   Tutti gli ID seguono formato: dk<YouTubeID>")
    
    # Mostra esempi
    if all_videos:
        print("\n📋 Esempi di ID generati:")
        for i, video in enumerate(all_videos[:3]):
            print(f"   {i+1}. {video['id']} -> {video['title'][:30]}...")

if __name__ == "__main__":
    main()