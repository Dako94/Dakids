#!/usr/bin/env python3
import yt_dlp
import json
from datetime import datetime

def get_channel_videos(channel_url, max_videos=30):
    ydl_opts = {
        'extract_flat': 'in_playlist',
        'dump_single_json': True,
        'quiet': True,
        'playlistend': max_videos
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(channel_url, download=False)
            return result.get('entries', [])
    except Exception as e:
        print(f"Error getting channel videos: {e}")
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
                
                video_data = {
                    'title': info.get('title', 'No Title'),
                    'id': info.get('id', ''),
                    'url': info.get('webpage_url', ''),
                    'viewCount': info.get('view_count', 0),
                    'date': info.get('upload_date', '20250101'),
                    'likes': info.get('like_count', 0),
                    'channelName': info.get('channel', 'Unknown Channel'),
                    'channelUrl': info.get('channel_url', ''),
                    'duration': info.get('duration_string', '0:00'),
                    'thumbnail': f"https://i.ytimg.com/vi/{info.get('id', '')}/maxresdefault.jpg"
                }
                
                videos_data.append(video_data)
                
            except Exception as e:
                print(f"❌ Error with {video_url}: {e}")
                continue
    
    return videos_data

def main():
    print("🎬 YouTube Scraper Started")
    
    # LISTA COMPLETA DI CANALI PER BAMBINI 🇮🇹
    channels = [
        # Pocoyo e amici
        "https://www.youtube.com/@PocoyoItaliano/videos",
        "https://www.youtube.com/@PocoyoEnglish/videos",
        
        # Peppa Pig
        "https://www.youtube.com/@peppapigofficial/videos",
        "https://www.youtube.com/@PeppaPigItaliano/videos",
        
        # PJ Masks
        "https://www.youtube.com/@PJMasksOfficial/videos",
        "https://www.youtube.com/@PJMasksItalia/videos",
        
        # Masha e Orso
        "https://www.youtube.com/@MashaeOrsoItaliano/videos",
        "https://www.youtube.com/@MashaBear/videos",
        
        # Bing
        "https://www.youtube.com/@BingOfficial/videos",
        "https://www.youtube.com/@BingItaliano/videos",
        
        # Hey Duggee
        "https://www.youtube.com/@HeyDuggeeOfficial/videos",
        
        # Bluey
        "https://www.youtube.com/@OfficialBluey/videos",
        "https://www.youtube.com/@BlueyItaliano/videos",
        
        # Paw Patrol
        "https://www.youtube.com/@PAWPatrol/videos",
        "https://www.youtube.com/@PawPatrolItaliano/videos",
        
        # Thomas & Friends
        "https://www.youtube.com/@ThomasFriends/videos",
        "https://www.youtube.com/@ThomaseAmiciItalia/videos",
        
        # Dora l'esploratrice
        "https://www.youtube.com/@DoraTheExplorer/videos",
        "https://www.youtube.com/@DoraEsploratriceItaliano/videos",
        
        # Diego
        "https://www.youtube.com/@GoDiegoGoOfficial/videos",
        
        # Blaze
        "https://www.youtube.com/@BlazeAndTheMonsterMachines/videos",
        "https://www.youtube.com/@BlazeItaliano/videos",
        
        # Super Wings
        "https://www.youtube.com/@SuperWingsOfficial/videos",
        "https://www.youtube.com/@SuperWingsItaliano/videos",
        
        # Treno Thomas
        "https://www.youtube.com/@ThomasTheTankEngine/videos",
        
        # Canali educativi
        "https://www.youtube.com/@BebeBossItaliano/videos",
        "https://www.youtube.com/@MeContiUnaStoria/videos",
        "https://www.youtube.com/@CoccoleSonore/videos",
        
        # Cartoni classici
        "https://www.youtube.com/@LooneyTunesOfficial/videos",
        "https://www.youtube.com/@TomAndJerry/videos",
        "https://www.youtube.com/@ScoobyDooOfficial/videos",
        
        # Disney Junior
        "https://www.youtube.com/@disneyjunior/videos",
        "https://www.youtube.com/@DisneyJuniorIT/videos",
        
        # Nickelodeon
        "https://www.youtube.com/@Nickelodeon/videos",
        "https://www.youtube.com/@NickelodeonItaliano/videos",
    ]
    
    all_videos = []
    
    for channel_url in channels:
        print(f"\n🔍 Scraping channel: {channel_url}")
        
        # Prima ottieni la lista dei video
        videos = get_channel_videos(channel_url, max_videos=20)  # Ridotto a 20 per canale
        
        if not videos:
            print(f"❌ No videos found for {channel_url}")
            continue
            
        video_urls = [f"https://www.youtube.com/watch?v={v['id']}" for v in videos if 'id' in v]
        print(f"📺 Found {len(video_urls)} videos")
        
        # Poi ottieni i dettagli completi
        video_details = get_video_details(video_urls)
        all_videos.extend(video_details)
        
        print(f"✅ Added {len(video_details)} videos from {channel_url}")

    # Salva in meta.json
    if all_videos:
        with open('meta.json', 'w', encoding='utf-8') as f:
            json.dump(all_videos, f, ensure_ascii=False, indent=2)
        
        print(f"\n🎉 Success! Saved {len(all_videos)} videos to meta.json")
        
        # Mostra statistiche per canale
        from collections import Counter
        channel_counts = Counter(video['channelName'] for video in all_videos)
        
        print("\n📊 Videos per channel:")
        for channel, count in channel_counts.most_common():
            print(f"   {channel}: {count} videos")
            
    else:
        print("❌ No videos were scraped")

if __name__ == "__main__":
    main()
