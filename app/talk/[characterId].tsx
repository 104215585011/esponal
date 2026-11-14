// Timestamp: 2026-11-14 15:45
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
import * as Speech from "expo-speech";

import {
  archiveTalkSession,
  fetchTalkCharacters,
  fetchTalkHistory,
  sendTalkMessage,
  type TalkCharacter,
  type TalkMessage
} from "@/api/talk";
import { ApiError } from "@/api/client";
import { colors, radius, spacing } from "@/theme";
import { speakSpanish } from "@/lib/speech";

/**
 * 各角色朗读语言(设备端 TTS,不花额度)。
 * 西语角色不再写死 es-ES,交给 speakSpanish 用设置里的口音;
 * 这里只给非西语角色标注语言。
 */
const NON_SPANISH_LANG: Record<string, string> = {
  emma: "en-GB",
  jake: "en-US",
  sophie: "fr-FR",
  kenji: "ja-JP"
};

type ChatBubble = TalkMessage & { pending?: boolean; failed?: boolean };

export default function TalkChatScreen() {
  const { characterId, sessionId: initialSessionId } = useLocalSearchParams<{
    characterId: string;
    sessionId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatBubble>>(null);

  const [character, setCharacter] = useState<TalkCharacter | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakOn, setSpeakOn] = useState(true);

  const nonSpanishLang = NON_SPANISH_LANG[String(characterId)] ?? null;

  /** 西语走设置里的口音,其它语言按角色固定 */
  const speakLine = useCallback(
    (text: string, rate = 0.9) => {
      if (nonSpanishLang) {
        Speech.stop();
        Speech.speak(text, { language: nonSpanishLang, rate });
        return;
      }
      speakSpanish(text, { rate });
    },
    [nonSpanishLang]
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
      Speech.stop();
    };
  }, [characterId, initialSessionId]);

  // 新消息滚到底
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length, sending]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: text, createdAt: new Date().toISOString(), pending: true }]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await sendTalkMessage({
        characterId: String(characterId),
        message: text,
        sessionId: sessionId ?? undefined
      });

      setSessionId(res.sessionId);
      setMessages((prev) => [
        ...prev.map((item) => (item.id === tempId ? { ...item, pending: false } : item)),
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          corrections: res.corrections,
          newWords: res.newWords,
          createdAt: new Date().toISOString()
        }
      ]);

      if (speakOn && res.reply) {
        speakLine(res.reply);
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((item) => (item.id === tempId ? { ...item, pending: false, failed: true } : item))
      );

      if (e instanceof ApiError) {
        if (e.status === 402) setError("积分不足,暂时聊不了。可以先做复习攒积分,或稍后再试。");
        else if (e.status === 401) setError("登录状态失效,请重新登录。");
        else setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "发送失败");
      }
    } finally {
      setSending(false);
    }
  }, [draft, sending, characterId, sessionId, speakOn, speakLine]);

  const handleRestart = useCallback(() => {
    Alert.alert("重新开始", "当前对话会被归档,下一句将开启新会话。", [
      { text: "取消", style: "cancel" },
      {
        text: "归档并重开",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (sessionId) {
              try {
                await archiveTalkSession(sessionId, String(characterId));
              } catch {
                // 归档失败也允许开新会话
              }
            }
            Speech.stop();
            setSessionId(null);
            setMessages([]);
            setError(null);
          })();
        }
      }
    ]);
  }, [sessionId, characterId]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{character?.name ?? "对话"}</Text>
        <Text style={styles.headerSub}>
          {character?.language ?? ""}
          {sessionId ? " · 已连接" : " · 新对话"}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          Speech.stop();
          setSpeakOn((prev) => !prev);
        }}
        style={[styles.chip, speakOn && styles.chipOn]}
      >
        <Text style={[styles.chipText, speakOn && styles.chipTextOn]}>
          {speakOn ? "🔊 朗读" : "🔇 静音"}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
            <Text style={styles.hint}>正在载入对话…</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {character ? `和 ${character.name} 打个招呼` : "开始对话"}
                </Text>
                <Text style={styles.emptyHint}>
                  试着用西语说一句 {`«Hola, ¿cómo estás?»`} —— 说错也没关系,它会顺手指出来。
                </Text>
              </View>
            }
            ListFooterComponent={() =>
              sending ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator color={colors.textTertiary} size="small" />
                  <Text style={styles.typingText}>对方正在输入…</Text>
                </View>
              ) : null
            }
            ref={listRef}
            renderItem={({ item }) => {
              const isUser = item.role === "user";
              return (
                <View style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                      {item.content}
                    </Text>
                    {item.pending ? <Text style={styles.pending}>发送中…</Text> : null}
                    {item.failed ? <Text style={styles.failed}>发送失败</Text> : null}
                  </View>

                  {/* 纠错:AI 顺手指出的语法问题 */}
                  {!isUser && (item.corrections ?? []).length > 0 ? (
                    <View style={styles.correctionBox}>
                      <Text style={styles.correctionLabel}>小提示</Text>
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

                  {/* 本轮新词 */}
                  {!isUser && (item.newWords ?? []).length > 0 ? (
                    <View style={styles.wordsRow}>
                      {(item.newWords ?? []).slice(0, 4).map((word, index) => {
                        const text = word.word ?? word.lemma ?? "";
                        const meaning = word.translation ?? word.meaning ?? "";
                        if (!text) return null;
                        return (
                          <Pressable
                            key={index}
                            onPress={() => speakLine(text, 0.85)}
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

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            editable={!sending}
            multiline
            onChangeText={setDraft}
            placeholder="用西语说点什么…"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            value={draft}
          />
          <Pressable
            disabled={sending || !draft.trim()}
            onPress={() => void handleSend()}
            style={[
              styles.sendButton,
              (sending || !draft.trim()) && styles.sendButtonDisabled
            ]}
          >
            <Text style={styles.sendText}>{sending ? "…" : "发送"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  chipOn: { backgroundColor: colors.brand50 },
  chipText: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: colors.brand700 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  hint: { fontSize: 12.5, color: colors.textTertiary },
  listContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  empty: { paddingTop: 48, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  emptyHint: { fontSize: 12.5, lineHeight: 20, color: colors.textTertiary, textAlign: "center" },
  bubbleWrap: { maxWidth: "86%", gap: 6 },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleAssistant: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { backgroundColor: colors.brand600 },
  bubbleText: { fontSize: 14, lineHeight: 21, color: colors.text },
  bubbleTextUser: { color: "#fff" },
  pending: { marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.75)" },
  failed: { marginTop: 4, fontSize: 10, color: "#FEE2E2" },
  correctionBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2
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
