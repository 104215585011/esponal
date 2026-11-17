// Timestamp: 2026-11-17 15:25
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LearningLanguage } from "@/lib/preferences";
import { detectPhrasesInSentence, type DetectedPhraseSpan } from "@/lib/phraseDetector";
import { colors, radius, spacing } from "@/theme";

type TranscriptRowProps = {
  text: string;
  start: number;
  translation?: string | null;
  language?: LearningLanguage;
  active: boolean;
  onSeek: (start: number) => void;
  onWordPress: (word: string, sentence: string) => void;
  onPhrasePress: (phraseLemma: string, sentence: string) => void;
};

type RenderSegment =
  | { type: "plain"; raw: string }
  | { type: "word"; raw: string; clean: string }
  | { type: "phrase"; raw: string; span: DetectedPhraseSpan };

/** 把非短语区切成「可点的词」与「不可点的标点/空白」 */
function tokenizePlainChunk(chunk: string): RenderSegment[] {
  const parts = chunk.split(/(\s+)/);
  const out: RenderSegment[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/[A-Za-zÄÖÜäöüßÁÉÍÓÚÜÑáéíóúüñ¿¡]/.test(part)) {
      const clean = part
        .replace(/^[¿¡"„“”'«»(\[]+/, "")
        .replace(/[.,;:!?"„“”'»)\]]+$/, "")
        .trim();
      if (clean) {
        out.push({ type: "word", raw: part, clean });
        continue;
      }
    }
    out.push({ type: "plain", raw: part });
  }
  return out;
}

function buildSegments(text: string, spans: DetectedPhraseSpan[]): RenderSegment[] {
  if (spans.length === 0) {
    return tokenizePlainChunk(text);
  }

  const segments: RenderSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push(...tokenizePlainChunk(text.slice(cursor, span.start)));
    }
    if (span.end > span.start) {
      segments.push({
        type: "phrase",
        raw: text.slice(span.start, span.end),
        span
      });
      cursor = span.end;
    }
  }

  if (cursor < text.length) {
    segments.push(...tokenizePlainChunk(text.slice(cursor)));
  }

  return segments;
}

/**
 * 一行视频字幕。
 * - 自动识别并琥珀色高亮西语固定搭配/短语/习语（点击直接查整个搭配并暂停视频）
 * - 底部展示本句识别到的固定搭配标签条（如「🔗 tener que · 必须」）
 * - 稳定 props 配合 React.memo，避免播放轮询导致整列表重绘闪退
 */
export const TranscriptRow = memo(function TranscriptRow({
  text,
  start,
  translation,
  language = "es",
  active,
  onSeek,
  onWordPress,
  onPhrasePress
}: TranscriptRowProps) {
  const spans = useMemo(
    () => (language === "es" ? detectPhrasesInSentence(text) : []),
    [text, language]
  );
  const segments = useMemo(() => buildSegments(text, spans), [text, spans]);

  // 去重展示本句识别到的固定搭配胶丸
  const uniqueSpans = useMemo(() => {
    if (spans.length === 0) return [];
    const seen = new Set<string>();
    return spans.filter((s) => {
      if (seen.has(s.lemma)) return false;
      seen.add(s.lemma);
      return true;
    });
  }, [spans]);

  return (
    <Pressable onPress={() => onSeek(start)} style={[styles.row, active && styles.rowActive]}>
      <View style={styles.content}>
        <View style={styles.textColumn}>
          <Text style={[styles.text, active && styles.textActive]}>
            {segments.map((seg, index) => {
              if (seg.type === "plain") {
                return (
                  <Text key={index} style={[styles.text, active && styles.textActive]}>
                    {seg.raw}
                  </Text>
                );
              }

              if (seg.type === "phrase") {
                return (
                  <Text
                    key={index}
                    onPress={() => onPhrasePress(seg.span.lemma, text)}
                    style={[
                      styles.text,
                      active && styles.textActive,
                      styles.phraseHighlight,
                      active && styles.phraseHighlightActive
                    ]}
                    suppressHighlighting={false}
                  >
                    {seg.raw}
                  </Text>
                );
              }

              return (
                <Text
                  key={index}
                  onPress={() => onWordPress(seg.clean, text)}
                  style={[styles.text, active && styles.textActive]}
                  suppressHighlighting={false}
                >
                  {seg.raw}
                </Text>
              );
            })}
          </Text>

          {translation ? (
            <Text
              numberOfLines={active ? 3 : 2}
              style={[styles.translation, active && styles.translationActive]}
            >
              {translation}
            </Text>
          ) : null}

          {uniqueSpans.length > 0 ? (
            <View style={styles.collocationBar}>
              {uniqueSpans.map((span) => (
                <Pressable
                  key={span.lemma}
                  hitSlop={6}
                  onPress={() => onPhrasePress(span.lemma, text)}
                  style={[styles.collocationChip, active && styles.collocationChipActive]}
                >
                  <Text style={styles.collocationBadge}>搭配</Text>
                  <Text style={styles.collocationLemma}>{span.lemma}</Text>
                  {span.zh ? (
                    <Text numberOfLines={1} style={styles.collocationZh}>
                      · {span.zh}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {active && uniqueSpans.length > 0 ? (
          <Pressable
            hitSlop={8}
            onPress={() => onPhrasePress(uniqueSpans[0].lemma, text)}
            style={styles.phraseButton}
          >
            <Text style={styles.phraseButtonText}>查搭配</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginHorizontal: spacing.md
  },
  rowActive: {
    backgroundColor: colors.brand50
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  textColumn: {
    flex: 1,
    gap: 4
  },
  text: {
    fontSize: 16.5,
    lineHeight: 29,
    color: colors.textTertiary
  },
  textActive: {
    fontSize: 18,
    lineHeight: 31,
    fontWeight: "600",
    color: colors.text
  },
  phraseHighlight: {
    color: "#B45309",
    backgroundColor: "rgba(251, 191, 36, 0.16)",
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(217, 119, 6, 0.55)"
  },
  phraseHighlightActive: {
    color: "#92400E",
    backgroundColor: "rgba(251, 191, 36, 0.28)",
    fontWeight: "700"
  },
  translation: {
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.textTertiary
  },
  translationActive: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary
  },
  collocationBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2
  },
  collocationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  collocationChipActive: {
    backgroundColor: "#FDE68A",
    borderColor: "#F59E0B"
  },
  collocationBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    backgroundColor: "rgba(217, 119, 6, 0.16)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden"
  },
  collocationLemma: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78350F"
  },
  collocationZh: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#92400E",
    maxWidth: 130
  },
  phraseButton: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B"
  },
  phraseButtonText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#92400E"
  }
});
