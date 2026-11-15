// Timestamp: 2026-11-15 08:12
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioStream,
  type AudioPlayer
} from "expo-audio";
import { File, Paths } from "expo-file-system";

import {
  archiveTalkSession,
  fetchTalkCharacters,
  fetchTalkHistory,
  recognizeSpeech,
  sendTalkMessage,
  sendTalkVoiceTurn,
  type TalkCharacter,
  type TalkCorrection,
  type TalkMessage,
  type TalkNewWord
} from "@/api/talk";
import { ApiError } from "@/api/client";
import { LookupSheet } from "@/components/LookupSheet";
import { getPreferences, type LearningLanguage } from "@/lib/preferences";
import { speakAuto, stopSpeaking } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

/**
 * 语音直聊 Robot 界面（Plan A）：
 *
 * 默认走「直录 16kHz PCM WAV → 单次请求 /api/talk/voice (DeepSeek ASR + 对话模型 + DeepSeek TTS WAV) → 语音气泡直播」闭环；
 * 若设备端不支持 AudioStream，自动无缝降级到 Recorder + Whisper 隧道 + 本地 TTS；
 * 并保留可折叠文字/纠错/生词与键盘兜底模式。
 */
const NON_SPANISH_LANG: Record<string, string> = {
  emma: "en-GB",
  jake: "en-US",
  sophie: "fr-FR",
  kenji: "ja-JP"
};

const CHARACTER_LEARNING_LANG: Record<string, LearningLanguage> = {
  emma: "en",
  jake: "en",
  sophie: "fr",
  kenji: "ja"
};

const STARTER_PROMPTS = [
  "Hola, ¿cómo estás hoy?",
  "Quiero practicar cómo pedir comida en un restaurante.",
  "¿Qué planes tienes para este fin de semana?"
];

type ChatBubble = Omit<TalkMessage, "corrections" | "newWords"> & {
  corrections?: Array<TalkCorrection | string> | null;
  newWords?: Array<TalkNewWord | string> | null;
  pending?: boolean;
  failed?: boolean;
  isVoiceMessage?: boolean;
  voiceDurationSec?: number;
  replyAudioUri?: string | null;
};

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (typeof globalThis.atob === "function") {
    const bin = globalThis.atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i += 1) lookup[chars.charCodeAt(i)] = i;
  const len = clean.length;
  let pad = 0;
  if (clean.endsWith("==")) pad = 2;
  else if (clean.endsWith("=")) pad = 1;
  const bytes = new Uint8Array(((len * 3) >> 2) - pad);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (p < bytes.length) bytes[p++] = (triple >> 16) & 255;
    if (p < bytes.length) bytes[p++] = (triple >> 8) & 255;
    if (p < bytes.length) bytes[p++] = triple & 255;
  }
  return bytes;
}

async function saveBase64WavToCache(base64: string): Promise<string> {
  const bytes = decodeBase64ToBytes(base64);
  const file = new File(
    Paths.cache,
    `talk-reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.wav`
  );
  await file.write(bytes);
  return file.uri;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TalkRobotScreen() {
  const { characterId, sessionId: initialSessionId } = useLocalSearchParams<{
    characterId: string;
    sessionId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatBubble>>(null);

  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16"
  });
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const recordingBackendRef = useRef<"stream" | "recorder">("stream");
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamStartedAtRef = useRef<number>(0);
  const wavPlayerRef = useRef<AudioPlayer | null>(null);

  const [isStreamRecording, setIsStreamRecording] = useState(false);
  const [streamDurationMs, setStreamDurationMs] = useState(0);
  const [character, setCharacter] = useState<TalkCharacter | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [draft, setDraft] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceOnlyMode, setVoiceOnlyMode] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [lookupWord, setLookupWord] = useState<{ word: string; context?: string } | null>(null);

  const nonSpanishLang = NON_SPANISH_LANG[String(characterId)] ?? null;
  const sheetLang: LearningLanguage = CHARACTER_LEARNING_LANG[String(characterId)] ?? "es";
  const activeLang = nonSpanishLang ?? getPreferences().accent;
  const isRecording = isStreamRecording || recorderState.isRecording;
  const recordingMs = isStreamRecording ? streamDurationMs : recorderState.durationMillis;
  const busy = transcribing || sending;

  const stopAllPlayback = useCallback(() => {
    stopSpeaking();
    try {
      wavPlayerRef.current?.pause();
    } catch {
      // ignore
    }
  }, []);

  const speakLine = useCallback(
    (text: string, rateOverride?: number) => {
      const rate = rateOverride ?? (slowMode ? 0.75 : 0.92);
      speakAuto(text, { rate, fallbackLang: nonSpanishLang ?? undefined });
    },
    [nonSpanishLang, slowMode]
  );

  const playAssistantAudio = useCallback(
    async (item: { content: string; replyAudioUri?: string | null }, rateOverride?: number) => {
      stopAllPlayback();
      const rate = rateOverride ?? (slowMode ? 0.75 : 1);

      if (item.replyAudioUri) {
        try {
          await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
          if (!wavPlayerRef.current) {
            wavPlayerRef.current = createAudioPlayer();
          }
          wavPlayerRef.current.replace({ uri: item.replyAudioUri });
          wavPlayerRef.current.setPlaybackRate(rate, "medium");
          wavPlayerRef.current.play();
          return;
        } catch {
          // 缓存音频损坏或释放时，平滑退回本地 TTS 朗读
        }
      }

      speakLine(item.content, rateOverride);
    },
    [slowMode, speakLine, stopAllPlayback]
  );

  const clearStreamTimer = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  // 角色信息 + 历史消息
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const characters = await fetchTalkCharacters();
        if (cancelled) return;
        setCharacter(characters.find((item) => item.id === String(characterId)) ?? null);

        const history = await fetchTalkHistory({
          characterId: String(characterId),
          sessionId: initialSessionId ? String(initialSessionId) : undefined
        });
        if (cancelled) return;
        setSessionId(history.sessionId);
        setMessages(history.messages);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      clearStreamTimer();
      try {
        stream.stop();
      } catch {
        // ignore
      }
      stopAllPlayback();
      try {
        wavPlayerRef.current?.remove();
      } catch {
        // ignore
      }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, [characterId, initialSessionId, clearStreamTimer, stream, stopAllPlayback]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length, sending, transcribing]);

  const sendMessageText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;

      const tempId = `local-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: tempId, role: "user", content: text, createdAt: new Date().toISOString(), pending: true }
      ]);
      setSending(true);
      setError(null);

      try {
        const res = await sendTalkMessage({
          characterId: String(characterId),
          message: text,
          sessionId: sessionId ?? undefined
        });

        const assistantId = `assistant-${Date.now()}`;
        setSessionId(res.sessionId);
        setMessages((prev) => [
          ...prev.map((item) => (item.id === tempId ? { ...item, pending: false } : item)),
          {
            id: assistantId,
            role: "assistant",
            content: res.reply,
            corrections: res.corrections,
            newWords: res.newWords,
            createdAt: new Date().toISOString()
          }
        ]);

        // 新消息若有纠错，默认轻轻折叠为可点状态，保持语音对话流清爽
        if (autoSpeak && res.reply) {
          speakLine(res.reply);
        }
      } catch (e) {
        setMessages((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, pending: false, failed: true } : item))
        );

        if (e instanceof ApiError) {
          if (e.status === 402) setError("积分不足，暂时聊不了。可以先做复习攒积分，或稍后再试。");
          else if (e.status === 401) setError("登录状态失效，请重新登录。");
          else setError(e.message);
        } else {
          setError(e instanceof Error ? e.message : "发送失败");
        }
      } finally {
        setSending(false);
      }
    },
    [characterId, sessionId, autoSpeak, speakLine]
  );

  const handleSendText = useCallback(async () => {
    if (busy || !draft.trim()) return;
    const text = draft;
    setDraft("");
    await sendMessageText(text);
  }, [busy, draft, sendMessageText]);

  const sendVoiceTurn = useCallback(
    async (uri: string, durationSec: number, mimeType: string, filename: string) => {
      const tempId = `voice-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          role: "user",
          content: "🎙️ 正在语音直聊…",
          isVoiceMessage: true,
          voiceDurationSec: durationSec,
          createdAt: new Date().toISOString(),
          pending: true
        }
      ]);
      setSending(true);
      setError(null);

      try {
        const audioBase64 = await new File(uri).base64();
        if (!audioBase64) {
          setMessages((prev) => prev.filter((item) => item.id !== tempId));
          setError("录音内容为空，请重试。");
          return;
        }

        const res = await sendTalkVoiceTurn({
          characterId: String(characterId),
          sessionId: sessionId ?? undefined,
          audioBase64,
          mimeType,
          filename,
          language: activeLang,
          wantTts: autoSpeak
        });

        if (res.emptyTranscript) {
          setMessages((prev) => prev.filter((item) => item.id !== tempId));
          setError("没听清刚才的内容，再靠近一点说一遍，或切到打字试试。");
          return;
        }

        let replyAudioUri: string | null = null;
        if (res.replyAudioBase64) {
          try {
            replyAudioUri = await saveBase64WavToCache(res.replyAudioBase64);
          } catch {
            replyAudioUri = null;
          }
        }

        const assistantId = `assistant-${Date.now()}`;
        if (res.sessionId) setSessionId(res.sessionId);
        setMessages((prev) => [
          ...prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  content: res.userTranscript || "🎙️ 语音消息",
                  pending: false
                }
              : item
          ),
          {
            id: assistantId,
            role: "assistant",
            content: res.reply,
            replyAudioUri,
            corrections: res.corrections,
            newWords: res.newWords,
            createdAt: new Date().toISOString()
          }
        ]);

        if (autoSpeak && res.reply) {
          await playAssistantAudio({ content: res.reply, replyAudioUri });
        }
      } catch (e) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? { ...item, content: "🎙️ 语音消息（发送失败）", pending: false, failed: true }
              : item
          )
        );
        if (e instanceof ApiError) {
          if (e.status === 402) setError("积分不足，暂时聊不了。可以先做复习攒积分，或稍后再试。");
          else if (e.status === 401) setError("登录状态失效，请重新登录。");
          else if (e.status === 413) setError("这段语音太长了，请控制在 2 分钟以内。");
          else if (e.status === 503) setError(`${e.message}（可暂用左下角「⌨️ 打字」）`);
          else setError(e.message);
        } else {
          setError(e instanceof Error ? e.message : "语音发送失败");
        }
      } finally {
        setSending(false);
      }
    },
    [characterId, sessionId, activeLang, autoSpeak, playAssistantAudio]
  );

  const startRecording = useCallback(async () => {
    if (busy) return;
    setError(null);
    stopAllPlayback();

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要麦克风权限", "请在系统设置中允许 Esponal 使用麦克风后再试。");
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });

      if (Platform.OS !== "web") {
        try {
          await stream.start();
          await stream.startFileRecordingAsync({
            directory: "cache",
            format: "wav"
          });
          recordingBackendRef.current = "stream";
          streamStartedAtRef.current = Date.now();
          setStreamDurationMs(0);
          setIsStreamRecording(true);
          clearStreamTimer();
          streamTimerRef.current = setInterval(() => {
            setStreamDurationMs(Date.now() - streamStartedAtRef.current);
          }, 250);
          return;
        } catch {
          clearStreamTimer();
          setIsStreamRecording(false);
          try {
            stream.stop();
          } catch {
            // ignore
          }
        }
      }

      recordingBackendRef.current = "recorder";
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setError(e instanceof Error ? e.message : "无法启动录音");
    }
  }, [busy, recorder, stream, clearStreamTimer, stopAllPlayback]);

  const cancelRecording = useCallback(async () => {
    clearStreamTimer();
    if (recordingBackendRef.current === "stream" || isStreamRecording) {
      setIsStreamRecording(false);
      setStreamDurationMs(0);
      try {
        await stream.stopFileRecordingAsync();
      } catch {
        // ignore
      }
      try {
        stream.stop();
      } catch {
        // ignore
      }
    }
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
      }
    } catch {
      // ignore
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  }, [clearStreamTimer, isStreamRecording, stream, recorder, recorderState.isRecording]);

  const stopAndSendRecording = useCallback(async () => {
    if (recordingBackendRef.current === "stream" && isStreamRecording) {
      clearStreamTimer();
      const elapsedMs = Math.max(streamDurationMs, Date.now() - streamStartedAtRef.current);
      setIsStreamRecording(false);
      setStreamDurationMs(0);

      let uri = "";
      let durationSec = Math.max(1, Math.round(elapsedMs / 1000));
      try {
        const recorded = await stream.stopFileRecordingAsync();
        uri = recorded.uri;
        if (recorded.duration > 0) {
          durationSec = Math.max(1, Math.round(recorded.duration));
        }
        stream.stop();
      } catch (e) {
        try {
          stream.stop();
        } catch {
          // ignore
        }
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
        setError(e instanceof Error ? e.message : "停止录音失败");
        return;
      }

      // 必须立刻关掉录音模式，否则 Android TTS / 音频播放器会从听筒极小声输出
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

      if (elapsedMs > 0 && elapsedMs < 450) {
        setError("说话时间太短，请按一下说话、说完再点发送。");
        return;
      }
      if (!uri) {
        setError("未读取到录音文件，请重试。");
        return;
      }

      await sendVoiceTurn(uri, durationSec, "audio/wav", "speech.wav");
      return;
    }

    // 降级通路（Web 或不支持 AudioStream 的老设备）：m4a + Whisper 隧道
    const duration = recorderState.durationMillis;
    try {
      await recorder.stop();
    } catch (e) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setError(e instanceof Error ? e.message : "停止录音失败");
      return;
    }

    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

    if (duration > 0 && duration < 450) {
      setError("说话时间太短，请按一下说话、说完再点发送。");
      return;
    }

    const uri = recorder.uri;
    if (!uri) {
      setError("未读取到录音文件，请重试。");
      return;
    }

    setTranscribing(true);
    setError(null);
    try {
      const audioBase64 = await new File(uri).base64();
      if (!audioBase64) {
        setError("录音内容为空，请重试。");
        return;
      }

      const recognized = await recognizeSpeech({
        audioBase64,
        language: activeLang,
        mimeType: "audio/m4a"
      });

      if (recognized.provider === "unavailable") {
        setError(
          `语音识别暂不可用（${recognized.unavailableReason ?? "服务端未连通"}），已为你切换键盘输入。`
        );
        setInputMode("text");
        return;
      }

      const transcript = recognized.transcript.trim();
      if (!transcript) {
        setError("没听清刚才的内容，可以凑近一点再试，或切到打字。");
        return;
      }

      setTranscribing(false);
      await sendMessageText(transcript);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError("登录状态失效，请重新登录。");
        else if (e.status === 413) setError("这段语音太长了，请控制在 30 秒以内。");
        else setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "语音识别失败");
      }
    } finally {
      setTranscribing(false);
    }
  }, [
    isStreamRecording,
    streamDurationMs,
    clearStreamTimer,
    stream,
    sendVoiceTurn,
    recorder,
    recorderState.durationMillis,
    activeLang,
    sendMessageText
  ]);

  const handleToggleMic = useCallback(() => {
    if (isRecording) {
      void stopAndSendRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopAndSendRecording]);

  const handleRestart = useCallback(() => {
    Alert.alert("开启新对话", "当前对话会被归档，下一句将开启新会话。", [
      { text: "取消", style: "cancel" },
      {
        text: "归档并重开",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (isRecording) {
              await cancelRecording();
            }
            if (sessionId) {
              try {
                await archiveTalkSession(sessionId, String(characterId));
              } catch {
                // ignore
              }
            }
            stopAllPlayback();
            setSessionId(null);
            setMessages([]);
            setExpandedIds({});
            setError(null);
          })();
        }
      }
    ]);
  }, [isRecording, cancelRecording, sessionId, characterId, stopAllPlayback]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const robotStatus = isRecording
    ? `正在聆听 · ${formatDuration(recordingMs)}`
    : transcribing
      ? "正在解析语音…"
      : sending
        ? `${character?.name ?? "Robot"} 正在语音回复…`
        : "语音直聊就绪 · 开口说话即直达对方耳朵";

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{character?.name ?? "语音 Robot"}</Text>
        <Text style={styles.headerSub}>
          {character?.language ?? "西语对话"}
          {sessionId ? " · 已连接" : " · 新对话"}
        </Text>
      </View>
      <Pressable
        onPress={() => setVoiceOnlyMode((prev) => !prev)}
        style={[styles.chip, voiceOnlyMode && styles.chipOn]}
      >
        <Text style={[styles.chipText, voiceOnlyMode && styles.chipTextOn]}>
          {voiceOnlyMode ? "纯听说" : "显示文字"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          stopAllPlayback();
          setAutoSpeak((prev) => !prev);
        }}
        style={[styles.chip, autoSpeak && styles.chipOn]}
      >
        <Text style={[styles.chipText, autoSpeak && styles.chipTextOn]}>
          {autoSpeak ? "🔊 自动播" : "🔇 静音"}
        </Text>
      </Pressable>
      <Pressable onPress={handleRestart} style={styles.chip}>
        <Text style={styles.chipText}>重开</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {header}

      {/* Robot 语音状态条 */}
      <View style={styles.robotBanner}>
        <View style={[styles.robotOrb, isRecording && styles.robotOrbActive]}>
          <Text style={styles.robotOrbText}>
            {character ? character.name.slice(0, 1).toUpperCase() : "R"}
          </Text>
        </View>
        <View style={styles.robotInfo}>
          <Text style={styles.robotStateText}>{robotStatus}</Text>
          {character?.style ? (
            <Text numberOfLines={1} style={styles.robotStyleText}>
              {character.style}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
            <Text style={styles.hint}>正在唤醒语音 Robot…</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {character ? `直接开口和 ${character.name} 说话` : "开始语音对话"}
                </Text>
                <Text style={styles.emptyHint}>
                  点下方绿色麦克风直接用西语说话，听完会自动语音回复。也可以点一句开场白热身：
                </Text>
                {!nonSpanishLang ? (
                  <View style={styles.starterCol}>
                    {STARTER_PROMPTS.map((prompt) => (
                      <Pressable
                        key={prompt}
                        disabled={busy}
                        onPress={() => void sendMessageText(prompt)}
                        style={({ pressed }) => [styles.starterBtn, pressed && styles.pressed]}
                      >
                        <Text style={styles.starterText}>🎙️ {prompt}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            }
            ListFooterComponent={() =>
              busy ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator color={colors.brand500} size="small" />
                  <Text style={styles.typingText}>
                    {transcribing ? "正在转写你的语音…" : `${character?.name ?? "Robot"} 正在准备语音回复…`}
                  </Text>
                </View>
              ) : null
            }
            ref={listRef}
            renderItem={({ item }) => {
              const isUser = item.role === "user";
              const hasExtras =
                !isUser &&
                ((item.corrections ?? []).length > 0 || (item.newWords ?? []).length > 0);
              const isExpanded = Boolean(expandedIds[item.id]);
              const hideText =
                voiceOnlyMode && !isExpanded && (!isUser || Boolean(item.isVoiceMessage));

              return (
                <View style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    {isUser && item.isVoiceMessage ? (
                      <View style={styles.userVoiceRow}>
                        <Text style={styles.userVoiceTag}>
                          🎙️ 语音消息
                          {item.voiceDurationSec ? ` · ${formatDuration(item.voiceDurationSec * 1000)}` : ""}
                        </Text>
                        {voiceOnlyMode ? (
                          <Pressable onPress={() => toggleExpand(item.id)}>
                            <Text style={styles.userVoiceToggle}>
                              {isExpanded ? "收起文字" : "看转写"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    {!isUser ? (
                      <View style={styles.audioRow}>
                        <Pressable
                          onPress={() => void playAssistantAudio(item)}
                          style={styles.playPill}
                        >
                          <Text style={styles.playPillText}>
                            {item.replyAudioUri ? "🔊 播原生语音" : "🔊 播放语音"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void playAssistantAudio(item, 0.72)}
                          style={styles.slowPill}
                        >
                          <Text style={styles.slowPillText}>0.7x 慢读</Text>
                        </Pressable>
                        {voiceOnlyMode ? (
                          <Pressable onPress={() => toggleExpand(item.id)} style={styles.slowPill}>
                            <Text style={styles.slowPillText}>{isExpanded ? "收起字幕" : "看字幕"}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    {!hideText ? (
                      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                        {item.content}
                      </Text>
                    ) : (
                      <Text style={isUser ? styles.hiddenHintUser : styles.hiddenHint}>
                        {isUser ? "已隐藏语音转写（纯听说模式）" : "已隐藏文字（专注听力模式）"}
                      </Text>
                    )}

                    {item.pending ? <Text style={styles.pending}>语音处理中…</Text> : null}
                    {item.failed ? <Text style={styles.failed}>发送失败</Text> : null}
                  </View>

                  {hasExtras ? (
                    <Pressable onPress={() => toggleExpand(item.id)} style={styles.extrasToggle}>
                      <Text style={styles.extrasToggleText}>
                        {isExpanded
                          ? "收起纠错与新词 ▲"
                          : `查看本轮提示（${(item.corrections ?? []).length} 处纠错 · ${(item.newWords ?? []).length} 个新词）▼`}
                      </Text>
                    </Pressable>
                  ) : null}

                  {hasExtras && isExpanded ? (
                    <View style={styles.extrasPanel}>
                      {(item.corrections ?? []).length > 0 ? (
                        <View style={styles.correctionBox}>
                          <Text style={styles.correctionLabel}>表达优化建议</Text>
                          {(item.corrections ?? []).map((correction, index) => (
                            <Text key={index} style={styles.correctionText}>
                              {typeof correction === "string"
                                ? correction
                                : `${correction.original ? `${correction.original} → ` : ""}${correction.corrected ?? ""}${
                                    correction.explanation
                                      ? ` · ${correction.explanation}`
                                      : correction.note
                                        ? ` · ${correction.note}`
                                        : ""
                                  }`}
                            </Text>
                          ))}
                        </View>
                      ) : null}

                      {(item.newWords ?? []).length > 0 ? (
                        <View style={styles.wordsRow}>
                          {(item.newWords ?? []).slice(0, 6).map((word, index) => {
                            const text =
                              typeof word === "string" ? word : (word.word ?? word.lemma ?? "");
                            const meaning =
                              typeof word === "string" ? "" : (word.translation ?? word.meaning ?? "");
                            if (!text) return null;
                            return (
                              <Pressable
                                key={index}
                                onPress={() => {
                                  speakLine(text, 0.85);
                                  setLookupWord({ word: text, context: item.content });
                                }}
                                style={styles.wordChip}
                              >
                                <Text style={styles.wordChipText}>
                                  {text}
                                  {meaning ? ` · ${meaning}` : ""}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {inputMode === "voice" ? (
          <View style={[styles.voiceDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              disabled={busy}
              onPress={() => {
                if (isRecording) {
                  void cancelRecording();
                } else {
                  setInputMode("text");
                }
              }}
              style={styles.sideDockBtn}
            >
              <Text style={styles.sideDockIcon}>{isRecording ? "✕" : "⌨️"}</Text>
              <Text style={styles.sideDockLabel}>
                {isRecording ? "取消" : "打字"}
              </Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={handleToggleMic}
              style={({ pressed }) => [
                styles.micButton,
                isRecording && styles.micButtonRecording,
                busy && styles.micButtonDisabled,
                pressed && styles.pressed
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.micIcon}>{isRecording ? "■" : "🎙️"}</Text>
                  <Text style={styles.micLabel}>
                    {isRecording
                      ? `完成发送 ${formatDuration(recordingMs)}`
                      : "点击说话"}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => setSlowMode((prev) => !prev)}
              style={[styles.sideDockBtn, slowMode && styles.sideDockBtnActive]}
            >
              <Text style={styles.sideDockIcon}>🐢</Text>
              <Text style={[styles.sideDockLabel, slowMode && styles.sideDockLabelActive]}>
                {slowMode ? "0.75x" : "常速"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <Pressable
              disabled={busy}
              onPress={() => setInputMode("voice")}
              style={styles.switchMicBtn}
            >
              <Text style={styles.switchMicText}>🎙️</Text>
            </Pressable>
            <TextInput
              editable={!busy}
              multiline
              onChangeText={setDraft}
              placeholder="输入西语回复（语音不可用时也可直接聊）…"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              value={draft}
            />
            <Pressable
              disabled={busy || !draft.trim()}
              onPress={() => void handleSendText()}
              style={[styles.sendButton, (busy || !draft.trim()) && styles.sendButtonDisabled]}
            >
              <Text style={styles.sendText}>{busy ? "…" : "发送"}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <LookupSheet
        context={lookupWord?.context}
        language={sheetLang}
        onClose={() => setLookupWord(null)}
        word={lookupWord?.word ?? null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg
  },
  backHit: { width: 24, alignItems: "center" },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30 },
  headerText: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  headerSub: { fontSize: 10.5, color: colors.textTertiary },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  chipOn: { backgroundColor: colors.brand50 },
  chipText: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: colors.brand700 },

  robotBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  robotOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  robotOrbActive: {
    backgroundColor: "#DC2626"
  },
  robotOrbText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  robotInfo: { flex: 1, gap: 2 },
  robotStateText: { fontSize: 12, fontWeight: "700", color: colors.text },
  robotStyleText: { fontSize: 11, color: colors.textTertiary },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  hint: { fontSize: 12.5, color: colors.textTertiary },
  listContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  empty: { paddingTop: 28, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  emptyHint: { fontSize: 12.5, lineHeight: 20, color: colors.textTertiary, textAlign: "center" },
  starterCol: { width: "100%", gap: spacing.xs, marginTop: spacing.sm },
  starterBtn: {
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  starterText: { fontSize: 13, fontWeight: "600", color: colors.brand700 },
  pressed: { opacity: 0.85 },

  bubbleWrap: { maxWidth: "88%", gap: 6 },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 13, paddingVertical: 10, gap: 8 },
  bubbleAssistant: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { backgroundColor: colors.brand600 },
  audioRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  playPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50
  },
  playPillText: { fontSize: 11, fontWeight: "700", color: colors.brand700 },
  slowPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  slowPillText: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  bubbleText: { fontSize: 14, lineHeight: 21, color: colors.text },
  bubbleTextUser: { color: "#fff" },
  userVoiceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  userVoiceTag: { fontSize: 11.5, fontWeight: "700", color: "rgba(255,255,255,0.92)" },
  userVoiceToggle: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textDecorationLine: "underline"
  },
  hiddenHint: { fontSize: 12, fontStyle: "italic", color: colors.textTertiary },
  hiddenHintUser: { fontSize: 12, fontStyle: "italic", color: "rgba(255,255,255,0.78)" },
  pending: { fontSize: 10, color: "rgba(255,255,255,0.75)" },
  failed: { fontSize: 10, color: "#FEE2E2" },

  extrasToggle: { alignSelf: "flex-start", paddingVertical: 2 },
  extrasToggleText: { fontSize: 11, fontWeight: "600", color: colors.brand700 },
  extrasPanel: { gap: 6 },
  correctionBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 3
  },
  correctionLabel: { fontSize: 10, fontWeight: "700", color: "#B45309" },
  correctionText: { fontSize: 11.5, lineHeight: 17, color: "#92400E" },
  wordsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  wordChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50
  },
  wordChipText: { fontSize: 10.5, fontWeight: "600", color: colors.brand700 },

  typingRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  typingText: { fontSize: 11.5, color: colors.textTertiary },
  errorBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.dangerBg
  },
  errorText: { fontSize: 11.5, lineHeight: 17, color: colors.danger },

  voiceDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg
  },
  sideDockBtn: {
    width: 60,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  sideDockBtnActive: { backgroundColor: colors.brand50 },
  sideDockIcon: { fontSize: 18 },
  sideDockLabel: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  sideDockLabelActive: { color: colors.brand700 },
  micButton: {
    flex: 1,
    maxWidth: 200,
    height: 60,
    marginHorizontal: spacing.md,
    borderRadius: 30,
    backgroundColor: colors.brand500,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  micButtonRecording: { backgroundColor: "#DC2626" },
  micButtonDisabled: { opacity: 0.6 },
  micIcon: { fontSize: 18, color: "#fff" },
  micLabel: { fontSize: 14, fontWeight: "800", color: "#fff" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg
  },
  switchMicBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  switchMicText: { fontSize: 17 },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: colors.text
  },
  sendButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendText: { fontSize: 13, fontWeight: "700", color: "#fff" }
});
