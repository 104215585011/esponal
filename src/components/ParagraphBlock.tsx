// Timestamp: 2026-11-15 15:15
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

type ParagraphBlockProps = {
  text: string;
  first?: boolean;
  fontSize?: number;
  textColor?: string;
  onWordPress: (word: string) => void;
};

function isWord(token: string) {
  return /\p{L}/u.test(token);
}

function normalize(token: string) {
  return token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").trim();
}

/**
 * 阅读器里的一个段落：整段文字连续排版，单词可点击查词与看变位。
 */
export function ParagraphBlock({
  text,
  first,
  fontSize = 17,
  textColor = colors.text,
  onWordPress
}: ParagraphBlockProps) {
  const tokens = useMemo(() => text.split(/(\s+)/).filter((t) => t.length > 0), [text]);
  const lineHeight = Math.round(fontSize * 1.72);

  return (
    <View style={[styles.wrap, first && styles.first]}>
      <Text style={[styles.text, { fontSize, lineHeight, color: textColor }]}>
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
    marginTop: spacing.md
  },
  first: { marginTop: 0 },
  text: {
    fontSize: 17,
    lineHeight: 29,
    color: colors.text
  }
});
