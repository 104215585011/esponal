// Timestamp: 2026-11-15 07:40
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
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState
} from "expo-audio";
import { File } from "expo-file-system";

import {
  archiveTalkSession,
  fetchTalkCharacters,
  fetchTalkHistory,
  recognizeSpeech,
  sendTalkMessage,
  type TalkCharacter,
  type TalkMessage
} from "@/api/talk";
import { ApiError } from "@/api/client";
import { LookupSheet } from "@/components/LookupSheet";
import { getPreferences } from "@/lib/preferences";
import { speakAuto, stopSpeaking } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

/**
 * 语音直聊 Robot 界面。
 *
 * 默认走「开口说话 → Whisper 转写 → Robot 生成回复 → 自动语音播报」闭环；
 * 同时保留可折叠文字/纠错/生词与键盘兜底模式，避免环境无录音或识别服务离线时卡死。
 */
const NON_SPANISH_LANG: Record<string, string> = {
  emma: "en-GB",
  jake: "en-US",
  sophie: "fr-FR",
  kenji: "ja-JP"
};

const STARTER_PROMPTS = [
  "Hola, ¿cómo estás hoy?",
  "Quiero practicar cómo pedir comida en un restaurante.",
  "¿Qué planes tienes para este fin de semana?"
];

type ChatBubble = TalkMessage & { pending?: boolean; failed?: boolean };

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

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

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
  const activeLang = nonSpanishLang ?? getPreferences().accent;
  const busy = transcribing || sending;

  const speakLine = useCallback(
    (text: string, rateOverride?: number) => {
      const rate = rateOverride ?? (slowMode ? 0.75 : 0.92);
      speakAuto(text, { rate, fallbackLang: nonSpanishLang ?? undefined });
    },
    [nonSpanishLang, slowMode]
  );

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
      stopSpeaking();
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, [characterId, initialSessionId]);

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

  const startRecording = useCallback(async () => {
    if (busy) return;
    setError(null);
    stopSpeaking();

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
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setError(e instanceof Error ? e.message : "无法启动录音");
    }
  }, [busy, recorder]);

  const cancelRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // ignore
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  }, [recorder]);

  const stopAndSendRecording = useCallback(async () => {
    const duration = recorderState.durationMillis;
    try {
      await recorder.stop();
    } catch (e) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setError(e instanceof Error ? e.message : "停止录音失败");
      return;
    }

    // 必须立刻关掉录音模式，否则 Android TTS 会从听筒极小声输出
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
  }, [recorder, recorderState.durationMillis, activeLang, sendMessageText]);

  const handleToggleMic = useCallback(() => {
    if (recorderState.isRecording) {
      void stopAndSendRecording();
    } else {
      void startRecording();
    }
  }, [recorderState.isRecording, startRecording, stopAndSendRecording]);

  const handleRestart = useCallback(() => {
    Alert.alert("开启新对话", "当前对话会被归档，下一句将开启新会话。", [
      { text: "取消", style: "cancel" },
      {
        text: "归档并重开",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (recorderState.isRecording) {
              await cancelRecording();
            }
            if (sessionId) {
              try {
                await archiveTalkSession(sessionId, String(characterId));
              } catch {
                // ignore
              }
            }
            stopSpeaking();
            setSessionId(null);
            setMessages([]);
            setExpandedIds({});
            setError(null);
          })();
        }
      }
    ]);
  }, [recorderState.isRecording, cancelRecording, sessionId, characterId]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const robotStatus = recorderState.isRecording
    ? `正在聆听 · ${formatDuration(recorderState.durationMillis)}`
    : transcribing
      ? "正在把语音转成文字…"
      : sending
        ? `${character?.name ?? "Robot"} 正在回复…`
        : "语音直聊就绪 · 点击下方麦克风开口说";

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
          stopSpeaking();
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
        <View style={[styles.robotOrb, recorderState.isRecording && styles.robotOrbActive]}>
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
              const hideText = !isUser && voiceOnlyMode && !isExpanded;

              return (
                <View style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    {!isUser ? (
                      <View style={styles.audioRow}>
                        <Pressable
                          onPress={() => speakLine(item.content)}
                          style={styles.playPill}
                        >
                          <Text style={styles.playPillText}>🔊 播放语音</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => speakLine(item.content, 0.72)}
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
                      <Text style={styles.hiddenHint}>已隐藏文字（专注听力模式）</Text>
                    )}

                    {item.pending ? <Text style={styles.pending}>发送中…</Text> : null}
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
                              {correction.original ? `${correction.original} → ` : ""}
                              {correction.corrected ?? ""}
                              {correction.explanation
                                ? ` · ${correction.explanation}`
                                : correction.note
                                  ? ` · ${correction.note}`
                                  : ""}
                            </Text>
                          ))}
                        </View>
                      ) : null}

                      {(item.newWords ?? []).length > 0 ? (
                        <View style={styles.wordsRow}>
                          {(item.newWords ?? []).slice(0, 6).map((word, index) => {
                            const text = word.word ?? word.lemma ?? "";
                            const meaning = word.translation ?? word.meaning ?? "";
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
                if (recorderState.isRecording) {
                  void cancelRecording();
                } else {
                  setInputMode("text");
                }
              }}
              style={styles.sideDockBtn}
            >
              <Text style={styles.sideDockIcon}>{recorderState.isRecording ? "✕" : "⌨️"}</Text>
              <Text style={styles.sideDockLabel}>
                {recorderState.isRecording ? "取消" : "打字"}
              </Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={handleToggleMic}
              style={({ pressed }) => [
                styles.micButton,
                recorderState.isRecording && styles.micButtonRecording,
                busy && styles.micButtonDisabled,
                pressed && styles.pressed
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.micIcon}>{recorderState.isRecording ? "■" : "🎙️"}</Text>
                  <Text style={styles.micLabel}>
                    {recorderState.isRecording
                      ? `完成发送 ${formatDuration(recorderState.durationMillis)}`
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
  hiddenHint: { fontSize: 12, fontStyle: "italic", color: colors.textTertiary },
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
