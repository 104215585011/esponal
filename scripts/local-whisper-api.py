import argparse
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

import whisper


MAX_BODY_BYTES = 32 * 1024
MAX_AUDIO_BYTES = 200 * 1024 * 1024


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local Whisper HTTP API for Esponal")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8017)
    parser.add_argument("--model", required=True)
    parser.add_argument("--cache-dir", default=".cache/whisper-api")
    parser.add_argument("--ytdlp", default="yt-dlp")
    parser.add_argument("--token", default=os.environ.get("LOCAL_WHISPER_API_TOKEN", ""))
    return parser


def find_downloaded_audio(cache_dir: Path, video_id: str) -> Path | None:
    for file_path in cache_dir.glob(f"{video_id}.*"):
        if file_path.is_file() and 0 < file_path.stat().st_size <= MAX_AUDIO_BYTES:
            return file_path
    return None


def download_youtube_audio(ytdlp_path: str, cache_dir: Path, video_id: str) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)

    cached = find_downloaded_audio(cache_dir, video_id)
    if cached:
        return cached

    subprocess.run(
        [
            ytdlp_path,
            "--no-playlist",
            "--max-filesize",
            "200m",
            "-f",
            "bestaudio/best",
            "-o",
            f"{video_id}.%(ext)s",
            f"https://www.youtube.com/watch?v={video_id}",
        ],
        cwd=cache_dir,
        check=True,
        text=True,
    )

    downloaded = find_downloaded_audio(cache_dir, video_id)
    if not downloaded:
        raise RuntimeError("yt-dlp did not produce an audio file")
    return downloaded


def normalize_cues(result: dict) -> list[dict]:
    cues = []
    for segment in result.get("segments", []):
        text = str(segment.get("text", "")).strip()
        start = float(segment.get("start", 0))
        end = float(segment.get("end", start))
        dur = max(0.01, end - start)

        if text:
            cues.append({"start": start, "dur": dur, "text": text})

    return cues


def make_handler(model, cache_dir: Path, ytdlp_path: str, token: str):
    class WhisperHandler(BaseHTTPRequestHandler):
        server_version = "EsponalLocalWhisper/1.0"

        def log_message(self, fmt: str, *args):
            sys.stderr.write("[whisper-api] " + fmt % args + "\n")

        def send_json(self, status: int, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def is_authorized(self) -> bool:
            if not token:
                return True
            return self.headers.get("Authorization") == f"Bearer {token}"

        def do_GET(self):
            if urlparse(self.path).path == "/health":
                self.send_json(200, {"ok": True})
                return
            self.send_json(404, {"error": "not found"})

        def do_POST(self):
            if urlparse(self.path).path != "/transcribe":
                self.send_json(404, {"error": "not found"})
                return

            if not self.is_authorized():
                self.send_json(401, {"error": "unauthorized"})
                return

            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                self.send_json(400, {"error": "invalid request body"})
                return

            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                video_id = str(payload.get("videoId", "")).strip()
                language = str(payload.get("lang", "es")).strip() or "es"

                if not video_id:
                    self.send_json(400, {"error": "videoId is required"})
                    return

                audio_path = download_youtube_audio(ytdlp_path, cache_dir, video_id)
                result = model.transcribe(
                    str(audio_path),
                    language=language,
                    task="transcribe",
                    fp16=False,
                    verbose=False,
                )
                self.send_json(200, {"cues": normalize_cues(result)})
            except Exception as error:
                self.log_message("transcribe failed: %s", error)
                self.send_json(500, {"error": "transcribe failed"})

    return WhisperHandler


def main() -> int:
    args = build_parser().parse_args()
    cache_dir = Path(args.cache_dir).resolve()

    print(f"[whisper-api] loading model: {args.model}", flush=True)
    model = whisper.load_model(args.model)
    handler = make_handler(model, cache_dir, args.ytdlp, args.token)
    server = HTTPServer((args.host, args.port), handler)

    print(f"[whisper-api] listening on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
