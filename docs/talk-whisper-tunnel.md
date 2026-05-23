# TALK-006 Whisper Tunnel

`/api/talk/recognize` can call a local Whisper service through Cloudflare Tunnel:

```env
WHISPER_TUNNEL_URL="https://thoroughly-ashley-pediatric-collaborative.trycloudflare.com"
```

The current `trycloudflare` URL is temporary. If `cloudflared` restarts, the public URL can change, so the Vercel environment variable must be updated and the app redeployed.

## Personal Startup

1. Start the local `whisper_service.py` FastAPI service on the PC.
2. Start `cloudflared` and confirm the tunnel points to the local Whisper service.
3. Check `GET /health` on the tunnel URL.
4. Set `WHISPER_TUNNEL_URL` locally and in Vercel.
5. Use `/talk/carlos`, record once, stop, and wait for the transcript to fill the input box.

If the tunnel is unavailable or `WHISPER_TUNNEL_URL` is empty, Esponal returns `provider: "unavailable"` from `/api/talk/recognize` and the browser falls back to Web Speech API instead of showing a 500.

## Production Note

This is acceptable for a personal trial, but not production infrastructure. A home PC plus temporary Cloudflare Tunnel URL is fragile: the PC can sleep, the URL can rotate, and the endpoint has no durable operations model. A production path should use a hosted ASR provider or a fixed authenticated tunnel.
