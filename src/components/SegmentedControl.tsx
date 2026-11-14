// Timestamp: 2026-11-15 06:55
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/theme";

export type SegmentOption<T extends string> = {
  key: T;
  label: string;
  badge?: string | number;
};

/** 顶部胶囊分段切换器，用于合并同域页面（如阅读/书架、复习/词库/短语） */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {item.label}
              {item.badge !== undefined && item.badge !== null ? ` (${item.badge})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
    gap: 3
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.sm + 1
  },
  itemActive: {
    backgroundColor: colors.bg,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary
  },
  labelActive: {
    color: colors.text,
    fontWeight: "700"
  }
});
