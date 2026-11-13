// Timestamp: 2026-11-13 23:28
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme";

type ParagraphBlockProps = {
  text: string;
  first?: boolean;
  onWordPress: (word: string) => void;
};

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
 * 阅读器里的一个段落:整段文字连续排版,单词可点查词。
 * 与字幕行的区别:不切行、不放大,按正常阅读节奏排。
 */
export function ParagraphBlock({ text, first, onWordPress }: ParagraphBlockProps) {
  const tokens = useMemo(() => text.split(/(\s+)/).filter((t) => t.length > 0), [text]);

  return (
    <View style={[styles.wrap, first && styles.first]}>
      <Text style={styles.text}>
        {tokens.map((token, index) => {
          if (!isWord(token)) {
            return <Text key={index}>{token}</Text>;
          }

          const word = normalize(token);
          if (!word) {
            return <Text key={index}>{token}</Text>;
          }

          return (
            <Text
              key={index}
              onPress={() => onWordPress(word)}
              style={styles.word}
              suppressHighlighting={false}
            >
              {token}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg
  },
  first: { marginTop: 0 },
  text: {
    fontSize: 17,
    lineHeight: 31,
    color: colors.text
  },
  word: {
    // 不给每个词加下划线,避免整页花;点击有系统反馈
  }
});
