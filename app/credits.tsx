// Timestamp: 2026-11-15 03:28
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { fetchCredits, type CreditSummary } from "@/api/account";
import { apiFetch } from "@/api/client";
import { colors, radius, spacing } from "@/theme";

type CreditTx = {
  id: string;
  reasonLabel?: string;
  reason?: string;
  deltaDisplay: string;
  balanceAfterDisplay: string;
  createdAt: string;
};

export default function CreditsScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [items, setItems] = useState<CreditTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [sum, tx] = await Promise.all([
        fetchCredits(),
        apiFetch<{ items?: CreditTx[] }>("/api/credits/transactions?limit=20")
      ]);
      setSummary(sum);
      setItems(tx.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.topTitle}>积分与配额</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.brand500]}
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            {summary ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>当前可用配额</Text>
                <Text style={styles.summaryValue}>{summary.balanceDisplay}</Text>
                <Text style={styles.summaryPlan}>当前方案：{summary.plan}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>近期配额记录</Text>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>暂无消费或发放记录</Text>
            ) : (
              <View style={styles.list}>
                {items.map((tx) => (
                  <View key={tx.id} style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowTitle}>{tx.reasonLabel || tx.reason || "配额变动"}</Text>
                      <Text style={styles.rowTime}>
                        {new Date(tx.createdAt).toLocaleString("zh-CN")}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowDelta}>{tx.deltaDisplay}</Text>
                      <Text style={styles.rowAfter}>余额 {tx.balanceAfterDisplay}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  topBar: {
    height: 48,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg
  },
  backBtn: { minWidth: 56 },
  backText: { fontSize: 13.5, fontWeight: "600", color: colors.brand600 },
  topTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  scroll: { padding: spacing.lg, gap: spacing.md },
  center: { paddingVertical: 48, alignItems: "center" },
  errorText: { fontSize: 13, color: colors.danger },
  summaryCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: 4
  },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 30, fontWeight: "800", color: colors.brand600 },
  summaryPlan: { fontSize: 12, color: colors.textTertiary },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textTertiary },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: "hidden"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  rowLeft: { gap: 2, flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  rowTime: { fontSize: 11, color: colors.textTertiary },
  rowRight: { alignItems: "flex-end", gap: 2 },
  rowDelta: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  rowAfter: { fontSize: 11, color: colors.textTertiary }
});
