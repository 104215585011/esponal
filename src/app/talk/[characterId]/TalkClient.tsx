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

// 浏览器原生 SpeechRecognition 类型（不在默认 TS lib 里，简化声明）
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
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isSpanishLookupCharacter(characterId: string, locale: string) {
  const normalizedLocale = locale.trim().toLowerCase();
  return (
    characterId === "carlos" ||
    characterId.startsWith("es-") ||
    normalizedLocale.startsWith("spanish")
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
  // 记录会话开始时输入框已有的文本，识别到的内容追加在后面
  const baseInputRef = useRef<string>("");

  // 滚到底
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 全局倍速实时作用于正在播放的 TTS
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
      const resp = await fetch("/api/talk/synthesize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, text })
      });
      if (!resp.ok) return;
      const blob = await resp.blob();
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
      // 静默：TTS 不通不影响主对话流
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
      const resp = await fetch("/api/talk/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, message: text, sessionId })
      });

      if (!resp.ok || !resp.body) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${detail.slice(0, 200)}`);
      }

      const reader = resp.body.getReader();
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "对话失败";
      setStatusMessage(msg);
      // 把空的 assistant 占位 pop 掉
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
      // 不 await，让 UI 立即响应
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

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatusMessage("当前浏览器不支持语音识别（请用 Chrome 或 Edge）");
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = locale;
      recognition.continuous = true;
      recognition.interimResults = true;
      baseInputRef.current = input;

      recognition.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
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
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "无法启动识别");
    }
  }

  async function startRecording() {
    if (recording || recognizing) return;
    setStatusMessage(null);
    setInterimTranscript("");
    baseInputRef.current = input;

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      startSpeechRecognitionFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

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
    } catch (err) {
      cleanupMediaRecorder();
      const message = err instanceof Error ? err.message : "无法启动录音";
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
      {/* 消息流 */}
      <div
        className="flex-1 space-y-4 overflow-y-auto pb-3"
        data-testid="talk-message-list"
        ref={listRef}
      >
        {messages.length === 0 ? (
          <div className="rounded-surface border border-dashed border-gray-200 bg-white/50 p-6 text-center text-sm text-gray-500">
            <p>开始一段对话吧。你可以打字，也可以点麦克风按钮说话。</p>
            <p className="mt-2 text-[12px] text-gray-400">
              {characterName} 会用对应语言回复你，并自动朗读出来。
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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    isUser
                      ? "bg-brand-500 text-white"
                      : "border border-gray-100 bg-white text-gray-800 shadow-card"
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
                    ) : message.content || (
                      <span className="text-gray-400">…</span>
                    )}
                  </p>

                  {!isUser && message.corrections && message.corrections.length > 0 ? (
                    <div className="mt-3 rounded-card border border-amber-100 bg-amber-50/60 p-2 text-[12px] text-amber-800">
                      <p className="font-semibold">修正建议</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {message.corrections.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {!isUser && message.newWords && message.newWords.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.newWords.map((word, idx) => (
                        <span
                          className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                          key={idx}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {!isUser && message.content ? (
                    <button
                      className="mt-2 text-[11px] text-gray-400 hover:text-brand-600"
                      onClick={() => void playTTS(message.content)}
                      type="button"
                    >
                      ▶ 重播
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 输入 + 麦克风 */}
      <form
        className="border-t border-gray-100 pb-4 pt-3"
        onSubmit={handleSubmit}
      >
        {statusMessage ? (
          <p className="mb-2 text-[12px] text-red-500">{statusMessage}</p>
        ) : null}
        {recording ? (
          <p className="mb-2 text-[12px] text-brand-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" />
            {" "}正在录音 {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}{" "}
            <span className="italic text-gray-500">{interimTranscript}</span>
          </p>
        ) : null}
        {recognizing ? (
          <p className="mb-2 text-[12px] text-brand-600">识别中...</p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-[48px] max-h-32 flex-1 resize-none rounded-card border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            disabled={streaming || recognizing}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) void send(input.trim());
              }
            }}
            placeholder={streaming ? "..." : "输入或按麦克风说话（Enter 发送，Shift+Enter 换行）"}
            rows={1}
            value={input}
          />

          <button
            aria-label={recording ? "停止录音" : "开始录音"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
              recording
                ? "border-red-400 bg-red-50 text-red-600 animate-pulse"
                : "border-gray-200 bg-white text-gray-500 hover:border-brand-400 hover:text-brand-600"
            }`}
            disabled={streaming || recognizing}
            onClick={recording ? stopRecording : () => void startRecording()}
            type="button"
          >
            {recording ? "■" : "🎤"}
          </button>

          <button
            aria-label="发送"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={!input.trim() || streaming || recognizing}
            type="submit"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
