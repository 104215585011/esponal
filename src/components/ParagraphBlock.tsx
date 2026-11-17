// Timestamp: 2026-11-17 23:12
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LearningLanguage } from "@/lib/preferences";
import { detectPhrasesInSentence, type DetectedPhraseSpan } from "@/lib/phraseDetector";
import { tokenizeTextChunk } from "@/lib/tokenizeText";
import { colors, radius, spacing } from "@/theme";

type ParagraphBlockProps = {
  text: string;
  first?: boolean;
  fontSize?: number;
  textColor?: string;
  language?: LearningLanguage;
  onWordPress: (word: string) => void;
};

type RenderSegment =
  | { type: "plain"; raw: string }
  | { type: "word"; raw: string; clean: string }
  | { type: "phrase"; raw: string; span: DetectedPhraseSpan };

function tokenizePlainChunk(chunk: string, language: LearningLanguage): RenderSegment[] {
  return tokenizeTextChunk(chunk, language).map((seg) =>
    seg.clean
      ? { type: "word", raw: seg.raw, clean: seg.clean }
      : { type: "plain", raw: seg.raw }
  );
}

function buildSegments(
  text: string,
  spans: DetectedPhraseSpan[],
  language: LearningLanguage
): RenderSegment[] {
  if (spans.length === 0) {
    return tokenizePlainChunk(text, language);
  }

  const segments: RenderSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push(...tokenizePlainChunk(text.slice(cursor, span.start), language));
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
    segments.push(...tokenizePlainChunk(text.slice(cursor), language));
  }

  return segments;
}

/**
 * 阅读器里的一个段落：
 * - 自动识别并高亮段内西语固定搭配 / 短语 / 习语（点击直接按完整搭配查词与收藏）
 * - 段落下方展示本段识别到的固定搭配胶丸
 */
export function ParagraphBlock({
  text,
  first,
  fontSize = 17,
  textColor = colors.text,
  language = "es",
  onWordPress
}: ParagraphBlockProps) {
  const spans = useMemo(
    () => (language === "es" ? detectPhrasesInSentence(text) : []),
    [text, language]
  );
  const segments = useMemo(() => buildSegments(text, spans, language), [text, spans, language]);
  const uniqueSpans = useMemo(() => {
    if (spans.length === 0) return [];
    const seen = new Set<string>();
    return spans.filter((s) => {
      if (seen.has(s.lemma)) return false;
      seen.add(s.lemma);
      return true;
    });
  }, [spans]);
  const lineHeight = Math.round(fontSize * 1.72);

  return (
    <View style={[styles.wrap, first && styles.first]}>
      <Text style={[styles.text, { fontSize, lineHeight, color: textColor }]}>
        {segments.map((seg, index) => {
          if (seg.type === "plain") {
            return <Text key={index}>{seg.raw}</Text>;
          }

          if (seg.type === "phrase") {
            return (
              <Text
                key={index}
                onPress={() => onWordPress(seg.span.lemma)}
                style={styles.phraseHighlight}
                suppressHighlighting={false}
              >
                {seg.raw}
              </Text>
            );
          }

          return (
            <Text
              key={index}
              onPress={() => onWordPress(seg.clean)}
              suppressHighlighting={false}
            >
              {seg.raw}
            </Text>
          );
        })}
      </Text>

      {uniqueSpans.length > 0 ? (
        <View style={styles.collocationBar}>
          {uniqueSpans.map((span) => (
            <Pressable
              key={span.lemma}
              hitSlop={6}
              onPress={() => onWordPress(span.lemma)}
              style={styles.collocationChip}
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    gap: 6
  },
  first: { marginTop: 0 },
  text: {
    fontSize: 17,
    lineHeight: 29,
    color: colors.text
  },
  phraseHighlight: {
    color: "#B45309",
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(217, 119, 6, 0.55)"
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
    backgroundColor: "rgba(254, 243, 199, 0.9)",
    borderWidth: 1,
    borderColor: "#FDE68A"
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
    maxWidth: 150
  }
});
