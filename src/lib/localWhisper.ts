import { spawn } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

export type LocalWhisperCue = {
  start: number;
  dur: number;
  text: string;
};

const DEFAULT_CACHE_DIR = path.join(process.cwd(), ".cache", "whisper");
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

function isLocalWhisperEnabled() {
  return process.env.LOCAL_WHISPER_ENABLED === "1";
}

function getLocalWhisperApiConfig() {
  const apiUrl = process.env.LOCAL_WHISPER_API_URL?.trim();
  const apiToken = process.env.LOCAL_WHISPER_API_TOKEN?.trim();
  const timeoutMs = Number(process.env.LOCAL_WHISPER_API_TIMEOUT_MS ?? 900000);

  if (!apiUrl) {
    return null;
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    apiToken,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 900000
  };
}

function getLocalWhisperConfig() {
  const pythonPath = process.env.LOCAL_WHISPER_PYTHON?.trim();
  const modelPath =
    process.env.LOCAL_WHISPER_MODEL_PATH?.trim() ||
    process.env.LOCAL_WHISPER_MODEL?.trim();
  const ytdlpPath = process.env.YTDLP_PATH?.trim() || "yt-dlp";
  const cacheDir = process.env.LOCAL_WHISPER_CACHE_DIR?.trim() || DEFAULT_CACHE_DIR;

  if (!pythonPath || !modelPath) {
    return null;
  }

  return { pythonPath, modelPath, ytdlpPath, cacheDir };
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${path.basename(command)} timed out`));
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr || `${path.basename(command)} exited ${code}`));
    });
  });
}

async function findDownloadedAudio(cacheDir: string, videoId: string) {
  const files = await readdir(cacheDir);
  const candidates = files.filter((file) => file.startsWith(`${videoId}.`));

  for (const file of candidates) {
    const fullPath = path.join(cacheDir, file);
    const info = await stat(fullPath);
    if (info.size > 0 && info.size <= MAX_AUDIO_BYTES) {
      return fullPath;
    }
  }

  return null;
}

async function downloadYoutubeAudio(
  videoId: string,
  config: NonNullable<ReturnType<typeof getLocalWhisperConfig>>
) {
  await mkdir(config.cacheDir, { recursive: true });

  const cachedAudio = await findDownloadedAudio(config.cacheDir, videoId);
  if (cachedAudio) {
    return cachedAudio;
  }

  await runCommand(
    config.ytdlpPath,
    [
      "--no-playlist",
      "--max-filesize",
      "200m",
      "-f",
      "bestaudio/best",
      "-o",
      `${videoId}.%(ext)s`,
      `https://www.youtube.com/watch?v=${videoId}`
    ],
    { cwd: config.cacheDir, timeoutMs: 180000 }
  );

  const downloadedAudio = await findDownloadedAudio(config.cacheDir, videoId);
  if (!downloadedAudio) {
    throw new Error("yt-dlp did not produce an audio file");
  }

  return downloadedAudio;
}

function parseWhisperOutput(stdout: string): LocalWhisperCue[] {
  const parsed = JSON.parse(stdout) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const cue = item as Partial<LocalWhisperCue>;
      const start = Number(cue.start);
      const dur = Number(cue.dur);
      const text = String(cue.text ?? "").trim();

      if (!Number.isFinite(start) || !Number.isFinite(dur) || !text) {
        return null;
      }

      return { start, dur: Math.max(0.01, dur), text };
    })
    .filter((cue): cue is LocalWhisperCue => cue !== null)
    .sort((a, b) => a.start - b.start);
}

function normalizeCueArray(input: unknown): LocalWhisperCue[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const cue = item as Partial<LocalWhisperCue>;
      const start = Number(cue.start);
      const dur = Number(cue.dur);
      const text = String(cue.text ?? "").trim();

      if (!Number.isFinite(start) || !Number.isFinite(dur) || !text) {
        return null;
      }

      return { start, dur: Math.max(0.01, dur), text };
    })
    .filter((cue): cue is LocalWhisperCue => cue !== null)
    .sort((a, b) => a.start - b.start);
}

async function fetchRemoteWhisperSubtitles(
  videoId: string,
  lang: string
): Promise<LocalWhisperCue[]> {
  const config = getLocalWhisperApiConfig();
  if (!config) {
    return [];
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  const response = await fetch(`${config.apiUrl}/transcribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({ videoId, lang }),
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`remote Whisper API returned ${response.status}`);
  }

  const payload = (await response.json()) as { cues?: unknown };
  return normalizeCueArray(payload.cues);
}

export async function getLocalWhisperSubtitles(
  videoId: string,
  lang = "es"
): Promise<LocalWhisperCue[]> {
  if (!isLocalWhisperEnabled()) {
    return [];
  }

  const remoteCues = await fetchRemoteWhisperSubtitles(videoId, lang);
  if (remoteCues.length > 0) {
    return remoteCues;
  }

  const config = getLocalWhisperConfig();
  if (!config) {
    console.warn("[subtitle] local Whisper enabled but config is incomplete");
    return [];
  }

  const audioPath = await downloadYoutubeAudio(videoId, config);
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe-whisper.py");
  const { stdout } = await runCommand(
    config.pythonPath,
    [
      scriptPath,
      "--audio",
      audioPath,
      "--model",
      config.modelPath,
      "--language",
      lang
    ],
    { timeoutMs: 900000 }
  );

  return parseWhisperOutput(stdout);
}
