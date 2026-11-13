// Timestamp: 2026-11-13 17:45
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme";

type TranscriptRowProps = {
  text: string;
  active: boolean;
  onSeek: () => void;
  onWordPress: (word: string) => void;
  onPhrasePress: () => void;
};

/** 把句子切成「可点的词」与「不可点的标点/空白」 */
function tokenize(text: string) {
  const parts = text.split(/(\s+)/);
  return parts.filter((p) => p.length > 0);
}

function isWord(token: string) {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/.test(token);
}

function normalize(token: string) {
  return token
    .replace(/^[¿¡"“”'«»(\[]+/, "")
    .replace(/[.,;:!?"“”'»)\]]+$/, "")
    .trim();
}

/**
 * 一行字幕。当前句高亮;单词可点(查词),句子右侧留一个「整句」入口。
 * 用 memo 避免每秒时间更新导致整列表重渲染。
 */
export const TranscriptRow = memo(function TranscriptRow({
  text,
  active,
  onSeek,
  onWordPress,
  onPhrasePress
}: TranscriptRowProps) {
  const tokens = useMemo(() => tokenize(text), [text]);

  return (
    <Pressable
      onPress={onSeek}
      style={[styles.row, active && styles.rowActive]}
      // 长按整句交给上层处理(可选),这里只做点击定位
    >
      <View style={styles.content}>
        <Text style={[styles.text, active && styles.textActive]}>
          {tokens.map((token, index) => {
            if (!isWord(token)) {
              return (
                <Text key={index} style={[styles.text, active && styles.textActive]}>
                  {token}
                </Text>
              );
            }

            const word = normalize(token);
            if (!word) {
              return (
                <Text key={index} style={[styles.text, active && styles.textActive]}>
                  {token}
                </Text>
              );
            }

            return (
              <Text
                key={index}
                onPress={() => onWordPress(word)}
                style={[styles.text, active && styles.textActive, styles.word]}
                suppressHighlighting={false}
              >
                {token}
              </Text>
            );
          })}
        </Text>

        {active ? (
          <Pressable onPress={onPhrasePress} style={styles.phraseButton} hitSlop={8}>
            <Text style={styles.phraseButtonText}>整句</Text>
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
  text: {
    flexShrink: 1,
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
  word: {
    // 不画下划线,避免整屏都是线;靠点击反馈
  },
  phraseButton: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand100
  },
  phraseButtonText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.brand700
  }
});
