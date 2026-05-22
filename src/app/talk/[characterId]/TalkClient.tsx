"use client";

import { useEffect, useRef, useState } from "react";
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
};

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== "undefined" ? window.btoa(binary) : "";
}

export function TalkClient({ characterId, characterName, locale }: TalkClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [playbackRate] = usePlaybackRate();

  const listRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 滚到底
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 全局倍速实时作用于正在播放的 TTS
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

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
  }

  async function startRecording() {
    if (recording) return;
    setStatusMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setStatusMessage("识别中...");
        try {
          const buffer = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const resp = await fetch("/api/talk/recognize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, language: locale, mimeType: recorder.mimeType })
          });
          if (!resp.ok) throw new Error(`recognize ${resp.status}`);
          const data = (await resp.json()) as { transcript?: string };
          if (data.transcript) {
            setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript ?? ""));
            setStatusMessage(null);
          } else {
            setStatusMessage("没听清，再试一次");
          }
        } catch (err) {
          setStatusMessage(err instanceof Error ? err.message : "识别失败");
        }
      });

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setStatusMessage("无法访问麦克风（检查浏览器权限）");
    }
  }

  function stopRecording() {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
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
            <p>开始一段对话吧。你可以打字，也可以按住下面的麦克风按钮说话。</p>
            <p className="mt-2 text-[12px] text-gray-400">
              {characterName} 会用对应语言回复你，并自动朗读出来。
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.role === "user";
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
                    {message.content || (
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
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-[48px] max-h-32 flex-1 resize-none rounded-card border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            disabled={streaming}
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
            disabled={streaming}
            onClick={recording ? stopRecording : startRecording}
            type="button"
          >
            {recording ? "■" : "🎤"}
          </button>

          <button
            aria-label="发送"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={!input.trim() || streaming}
            type="submit"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
