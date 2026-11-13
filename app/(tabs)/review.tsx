// Timestamp: 2026-11-13 17:38
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiFetch } from "@/api/client";
import { colors, radius, spacing } from "@/theme";

type DueWord = {
  id: string;
  lemma: string;
  translation: string | null;
  partOfSpeech: string | null;
  srsDue: string | null;
  srsState: string | null;
};

type ReviewResponse = {
  dueWords: DueWord[];
  totalDue: number;
};

export default function ReviewScreen() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<ReviewResponse>("/api/vocab/review");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator color={colors.brand500} />
        <Text style={styles.loadingText}>正在取复习队列…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Text style={styles.errorTitle}>加载失败</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => load()} style={styles.retry}>
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const totalDue = data?.totalDue ?? 0;
  const words = data?.dueWords ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        contentContainerStyle={styles.list}
        data={words}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>今天没有待复习的词</Text>
            <Text style={styles.emptyHint}>去视频或阅读里点几个词存进来。</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Hoy</Text>
            <Text style={styles.title}>复习</Text>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{totalDue}</Text>
                <Text style={styles.statLabel}>今日待复习</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{words.length}</Text>
                <Text style={styles.statLabel}>本批加载</Text>
              </View>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            colors={[colors.brand500]}
            onRefresh={() => load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              {item.partOfSpeech ? (
                <Text style={styles.pos}>{item.partOfSpeech}</Text>
              ) : null}
            </View>
            <Text style={styles.lemma}>{item.lemma}</Text>
            <Text style={styles.translation}>{item.translation ?? "—"}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSubtle,
    gap: spacing.md,
    paddingHorizontal: spacing.xl
  },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  errorTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  errorText: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  retry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  statRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.md
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11.5,
    color: colors.textSecondary
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  index: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 1
  },
  pos: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  lemma: {
    marginTop: spacing.sm,
    fontSize: 21,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.3
  },
  translation: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: spacing.sm
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 13, color: colors.textTertiary }
});
