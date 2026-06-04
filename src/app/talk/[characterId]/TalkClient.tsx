// Timestamp: 2026-06-04 12:31
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SpanishText } from "@/app/components/vocab/SpanishText";
import { usePlaybackRate } from "@/lib/playback-rate";
import { parseSseChunk } from "@/lib/talk/sse";

type Message = {
  role: "user" | "assistant";
  content: string;
  corrections?: string[];
  newWords?: string[];
};

type TalkClientProps = {
  characterId: string;
  characterName: string;
  locale: string;
  initialSessionId?: string | null;
};

type HistoryResponse = {
  items?: Array<{
    id: string;
    characterId: string;
    messages?: Array<{
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
      corrections?: string[];
      newWords?: string[];
    }>;
  }>;
};

type RecognizeResponse = {
  language?: string;
  provider?: "whisper" | "unavailable";
  segments?: Array<{ start?: number; end?: number; text?: string; avg_logprob?: number }>;
  transcript?: string;
  unavailableReason?: string;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const currentWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return currentWindow.SpeechRecognition ?? currentWindow.webkitSpeechRecognition ?? null;
}

function isSpanishLookupCharacter(characterId: string, locale: string) {
  const normalizedLocale = locale.trim().toLowerCase();
  return (
    characterId === "carlos" ||
    characterId.startsWith("es-") ||
    normalizedLocale.startsWith("spanish")
  );
}

function formatDuration(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function TypingDots() {
  return (
    <span aria-label="对方正在输入" className="inline-flex gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s] dark:bg-zinc-600" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s] dark:bg-zinc-600" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 dark:bg-zinc-600" />
    </span>
  );
}

export function TalkClient({
  characterId,
  characterName,
  locale,
  initialSessionId = null
}: TalkClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [recording, setRecording] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [playbackRate] = usePlaybackRate();

  const listRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const baseInputRef = useRef<string>("");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const selectedSessionId = searchParams.get("session");

    if (!selectedSessionId) {
      setSessionId(null);
      setMessages([]);
      return;
    }

    const sessionIdToLoad = selectedSessionId;
    let cancelled = false;

    async function loadSelectedSession() {
      setStatusMessage(null);
      const response = await fetch(
        `/api/talk/history?sessionId=${encodeURIComponent(sessionIdToLoad)}&characterId=${encodeURIComponent(characterId)}`
      );
      if (!response.ok) {
        if (!cancelled) setStatusMessage("无法加载这段对话");
        return;
      }

      const payload = (await response.json()) as HistoryResponse;
      const item = payload.items?.[0];
      if (!item || cancelled) return;
      if (item.characterId !== characterId) {
        setSessionId(null);
        setMessages([]);
        setStatusMessage("无法访问该会话（角色不匹配）");
        router.replace(`/talk/${characterId}`, { scroll: false });
        return;
      }

      setSessionId(item.id);
      setMessages(
        (item.messages ?? [])
          .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
          .map((message) => ({
            role: message.role === "USER" ? "user" : "assistant",
            content: message.content,
            corrections: message.corrections ?? [],
            newWords: message.newWords ?? []
          }))
      );
    }

    void loadSelectedSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams, characterId, router]);

  function appendDeltaToLastAssistant(text: string) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        next[next.length - 1] = { ...last, content: last.content + text };
      }
      return next;
    });
  }

  function finalizeAssistant(payload: {
    assistantText: string;
    corrections: string[];
    newWords: string[];
  }) {
    setMessages((prev) => {
      const next = [...prev];
      const lastIdx = next.length - 1;
      if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
        next[lastIdx] = {
          role: "assistant",
          content: payload.assistantText,
          corrections: payload.corrections,
          newWords: payload.newWords
        };
      }
      return next;
    });
  }

  async function playTTS(text: string) {
    try {
      const response = await fetch("/api/talk/synthesize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, text })
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
      audio.play().catch(() => URL.revokeObjectURL(url));
    } catch {
      // TTS fail-open
    }
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setStatusMessage(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" }
    ]);
    setStreaming(true);

    let finalAssistantText = "";
    let completedSessionId: string | null = null;
    const messageCountAfterDone = messagesRef.current.length + 2;

    try {
      const response = await fetch("/api/talk/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, message: text, sessionId })
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          if (event.event === "delta") {
            const data = event.data as { text?: string };
            if (typeof data.text === "string") appendDeltaToLastAssistant(data.text);
          } else if (event.event === "done") {
            const data = event.data as {
              sessionId: string;
              assistantText: string;
              corrections: string[];
              newWords: string[];
            };
            setSessionId(data.sessionId);
            completedSessionId = data.sessionId;
            finalAssistantText = data.assistantText;
            finalizeAssistant({
              assistantText: data.assistantText,
              corrections: data.corrections ?? [],
              newWords: data.newWords ?? []
            });
          } else if (event.event === "error") {
            const data = event.data as { message?: string };
            throw new Error(data.message ?? "stream error");
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "对话失败";
      setStatusMessage(message);
      setMessages((prev) => {
        if (prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
    }

    if (finalAssistantText) {
      void playTTS(finalAssistantText);
    }

    if (completedSessionId) {
      router.replace(`/talk/${characterId}?session=${completedSessionId}`, { scroll: false });
      window.dispatchEvent(new CustomEvent("talk:sessions:changed"));

      if (messageCountAfterDone >= 8) {
        void fetch(`/api/talk/sessions/${completedSessionId}/retitle`, { method: "POST" })
          .then(() => {
            window.dispatchEvent(new CustomEvent("talk:sessions:changed"));
          })
          .catch(() => undefined);
      }
    }
  }

  function appendTranscript(text: string) {
    const transcript = text.trim();
    if (!transcript) return;
    const base = baseInputRef.current.trim();
    const next = base ? `${base} ${transcript}` : transcript;
    baseInputRef.current = next;
    setInput(next);
  }

  function startRecordingTimer() {
    setRecordingSeconds(0);
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((value) => value + 1);
    }, 1000);
  }

  function stopRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function cleanupMediaRecorder() {
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
    stopRecordingTimer();
  }

  function getPreferredRecordingMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    return "";
  }

  function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error ?? new Error("read audio failed"));
      reader.readAsDataURL(blob);
    });
  }

  async function transcribeRecordedAudio(blob: Blob) {
    setRecognizing(true);
    setStatusMessage("识别中...");
    try {
      const audioBase64 = await blobToBase64(blob);
      if (!audioBase64) {
        setStatusMessage("没有录到声音，再试一次");
        return;
      }

      const response = await fetch("/api/talk/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          language: locale,
          mimeType: blob.type || "audio/webm"
        })
      });
      const payload = (await response.json().catch(() => ({}))) as RecognizeResponse;

      if (!response.ok || payload.provider === "unavailable") {
        console.warn("[talk] local recognition unavailable; falling back to browser recognition", {
          status: response.status,
          unavailableReason: payload.unavailableReason ?? null
        });
        setStatusMessage("本机识别不可用，已切换到浏览器识别");
        startSpeechRecognitionFallback();
        return;
      }

      appendTranscript(payload.transcript ?? "");
      setStatusMessage(null);
    } catch (error) {
      console.warn("[talk] local recognition request failed; falling back to browser recognition", error);
      setStatusMessage("本机识别不可用，已切换到浏览器识别");
      startSpeechRecognitionFallback();
    } finally {
      setRecognizing(false);
    }
  }

  function startSpeechRecognitionFallback() {
    if (recording) return;

    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      setStatusMessage("当前浏览器不支持语音识别，请用 Chrome 或 Edge");
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = locale;
      recognition.continuous = true;
      recognition.interimResults = true;
      baseInputRef.current = input;

      recognition.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          const text = result[0].transcript;
          if (result.isFinal) {
            finalChunk += text;
          } else {
            interimChunk += text;
          }
        }
        if (finalChunk) {
          appendTranscript(finalChunk);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interimChunk);
        }
      };

      recognition.onerror = (event) => {
        const code = event.error ?? "unknown";
        if (code === "no-speech") {
          setStatusMessage("没听到声音，再试一次");
        } else if (code === "not-allowed" || code === "service-not-allowed") {
          setStatusMessage("浏览器拒绝了麦克风权限");
        } else if (code === "audio-capture") {
          setStatusMessage("找不到麦克风设备");
        } else {
          setStatusMessage(`识别错误：${code}`);
        }
        setRecording(false);
        setInterimTranscript("");
      };

      recognition.onend = () => {
        setRecording(false);
        stopRecordingTimer();
        setInterimTranscript("");
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
      startRecordingTimer();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "无法启动识别");
    }
  }

  async function startRecording() {
    if (recording || recognizing) return;
    setStatusMessage(null);
    setInterimTranscript("");
    baseInputRef.current = input;

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      startSpeechRecognitionFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        cleanupMediaRecorder();
        setRecording(false);
        setStatusMessage("录音失败，已切换到浏览器语音识别");
        startSpeechRecognitionFallback();
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm"
        });
        cleanupMediaRecorder();
        setRecording(false);
        void transcribeRecordedAudio(audioBlob);
      };

      recorder.start();
      setRecording(true);
      startRecordingTimer();
    } catch (error) {
      cleanupMediaRecorder();
      const message = error instanceof Error ? error.message : "无法启动录音";
      setStatusMessage(message);
      startSpeechRecognitionFallback();
    }
  }

  function stopRecording() {
    if (!recording) return;
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      return;
    }
    recognitionRef.current?.stop();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (input.trim()) void send(input.trim());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 md:space-y-4 md:px-0 md:py-0 md:pb-3"
        data-testid="talk-message-list"
        ref={listRef}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span
              aria-hidden
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl ring-1 ring-brand-100 dark:bg-brand-950/40 dark:ring-brand-900/40"
            >
              馃挰
            </span>
            <p className="font-display text-[15px] font-medium text-zinc-700 dark:text-zinc-200">
              和 {characterName} 开始对话吧
            </p>
            <p className="mt-1.5 max-w-xs text-[13px] font-light leading-relaxed text-zinc-500 dark:text-zinc-400">
              打字或按麦克风说话。{characterName} 会用对应语言回复并朗读，气泡里的西语也可以点词查词。
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.role === "user";
            const isAssistantStreaming = streaming && index === messages.length - 1 && !isUser;
            const canLookupAssistantMessage =
              message.role === "assistant" &&
              !isUser &&
              !isAssistantStreaming &&
              Boolean(message.content) &&
              isSpanishLookupCharacter(characterId, locale);

            return (
              <div
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                data-role={message.role}
                key={index}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 shadow-sm ${
                    isUser
                      ? "rounded-2xl rounded-br-md bg-brand-600 text-white dark:bg-brand-500"
                      : "glass-card rounded-2xl rounded-bl-md border border-zinc-200/60 bg-white/80 text-zinc-800 dark:border-zinc-800/50 dark:bg-zinc-900/70 dark:text-zinc-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                    {canLookupAssistantMessage ? (
                      <SpanishText
                        text={message.content}
                        translation=""
                        source={{
                          type: "talk",
                          url: `/talk/${characterId}?session=${sessionId ?? ""}#m${index}`,
                          characterId,
                          sessionId: sessionId ?? "",
                          messageIndex: index,
                          sentence: message.content
                        }}
                      />
                    ) : message.content ? (
                      message.content
                    ) : (
                      <TypingDots />
                    )}
                  </p>

                  {!isUser && message.corrections && message.corrections.length > 0 ? (
                    <div className="mt-2.5 rounded-card border border-amber-200/50 bg-amber-50/60 p-2.5 text-[12px] font-light text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                      <p className="font-display font-semibold">修正建议</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {message.corrections.map((item, correctionIndex) => (
                          <li key={correctionIndex}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {!isUser && message.newWords && message.newWords.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.newWords.map((word, wordIndex) => (
                        <span
                          className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                          key={wordIndex}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {!isUser && message.content ? (
                    <button
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-400 transition hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400"
                      onClick={() => void playTTS(message.content)}
                      type="button"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      重播
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="shrink-0 border-t border-zinc-100 bg-white/85 backdrop-blur-xl px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 dark:border-zinc-800/80 dark:bg-zinc-950/80 md:bg-transparent md:px-0 md:pb-4 md:pt-3 md:backdrop-blur-none"
        onSubmit={handleSubmit}
      >
        {statusMessage ? (
          <p className="mb-2 text-[12px] text-red-500">{statusMessage}</p>
        ) : null}

        {recording ? (
          <div className="mb-2 flex items-center gap-2 text-[12px] text-brand-600 dark:text-brand-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span>正在聆听 {formatDuration(recordingSeconds)}</span>
            {interimTranscript ? (
              <span className="truncate italic text-zinc-500 dark:text-zinc-400">
                {interimTranscript}
              </span>
            ) : null}
          </div>
        ) : null}

        {recognizing ? (
          <p className="mb-2 text-[12px] text-brand-600 dark:text-brand-400">识别中...</p>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:focus:border-brand-400 dark:focus:bg-zinc-900 dark:focus:ring-brand-900/20"
            disabled={streaming || recognizing}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) void send(input.trim());
              }
            }}
            placeholder={streaming ? "对方正在回复..." : "输入消息，或按麦克风说话"}
            rows={1}
            value={input}
          />

          <button
            aria-label={recording ? "停止录音" : "开始语音输入"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
              recording
                ? "animate-pulse border-red-400 bg-red-50 text-red-600 dark:bg-red-950/30"
                : "border-zinc-200 bg-white text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
            }`}
            disabled={streaming || recognizing}
            onClick={recording ? stopRecording : () => void startRecording()}
            type="button"
          >
            {recording ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <path d="M12 17v4" />
                <path d="M8 21h8" />
              </svg>
            )}
          </button>

          <button
            aria-label="发送"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition active:scale-95 hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
            disabled={!input.trim() || streaming || recognizing}
            type="submit"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
