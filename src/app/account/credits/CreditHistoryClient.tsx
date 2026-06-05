// Timestamp: 2026-06-05 14:49
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CreditTransactionItem } from "@/lib/credits/history";
import { getCreditTransactionLabel, getCreditTransactionTone } from "@/lib/credits/labels";

type CreditHistoryClientProps = {
  initialItems: CreditTransactionItem[];
  initialNextCursor: string | null;
  membershipHref: string;
};

type TransactionGroup = {
  label: string;
  items: CreditTransactionItem[];
};

function isToday(date: Date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getGroupLabel(date: Date) {
  if (isToday(date)) {
    return "今天";
  }

  const now = new Date();
  const ms = now.getTime() - date.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days > 30) {
    return "更早";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatSignedDisplay(value: number) {
  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${value >= 0 ? "+" : ""}${formatted}`;
}

function groupTransactions(items: CreditTransactionItem[]): TransactionGroup[] {
  const groups = new Map<string, CreditTransactionItem[]>();

  for (const item of items) {
    const label = getGroupLabel(new Date(item.createdAt));
    const bucket = groups.get(label) ?? [];
    bucket.push(item);
    groups.set(label, bucket);
  }

  return Array.from(groups.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}

function CreditRowIcon({ item }: { item: CreditTransactionItem }) {
  const label = getCreditTransactionLabel(item.reason, item.refType);
  const positive = item.deltaMinor >= 0;
  const wrapperClass = positive ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-600";

  if (item.reason === "grant" || item.reason === "refill") {
    return (
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${wrapperClass}`}>
        <svg className="h-5 w-5 fill-none stroke-current stroke-[1.9]" viewBox="0 0 24 24">
          <path d="M12 5v14" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (label.includes("对话")) {
    return (
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${wrapperClass}`}>
        <svg className="h-5 w-5 fill-none stroke-current stroke-[1.9]" viewBox="0 0 24 24">
          <path d="M8 10h8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 14h5" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (label.includes("发音")) {
    return (
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${wrapperClass}`}>
        <svg className="h-5 w-5 fill-none stroke-current stroke-[1.9]" viewBox="0 0 24 24">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 9a3 3 0 0 1 0 6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 6a7 7 0 0 1 0 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (label.includes("查词")) {
    return (
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${wrapperClass}`}>
        <svg className="h-5 w-5 fill-none stroke-current stroke-[1.9]" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`grid h-10 w-10 place-items-center rounded-2xl ${wrapperClass}`}>
      <svg className="h-5 w-5 fill-none stroke-current stroke-[1.9]" viewBox="0 0 24 24">
        <path d="M4 5h16v12H4Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 9h16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 13h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function CreditHistoryClient({
  initialItems,
  initialNextCursor,
  membershipHref,
}: CreditHistoryClientProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupTransactions(items), [items]);

  async function loadMore() {
    if (!nextCursor || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/credits/transactions?cursor=${encodeURIComponent(nextCursor)}&limit=20`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        items: CreditTransactionItem[];
        nextCursor: string | null;
      };

      setItems((current) => [...current, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("加载失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="mt-8 rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-400 shadow-sm">
          <svg className="h-5 w-5 fill-none stroke-current stroke-[1.9]" viewBox="0 0 24 24">
            <path d="M4 5h16v12H4Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 9h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold text-zinc-950">还没有配额记录</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          完成首次 AI 对话、字幕解锁或发音朗读之后，这里会开始记录每一笔配额变化。
        </p>
        <Link
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(16,185,129,0.8)]"
          href={membershipHref}
        >
          管理会员
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {group.label}
          </div>
          <div className="rounded-[28px] border border-zinc-200/70 bg-white px-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.35)]">
            {group.items.map((item) => {
              const tone = getCreditTransactionTone(item.deltaMinor);
              const label = getCreditTransactionLabel(item.reason, item.refType);

              return (
                <div
                  className="flex items-center gap-3 border-b border-zinc-100 py-4 last:border-b-0"
                  key={item.id}
                >
                  <CreditRowIcon item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-950">{label}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatTime(item.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-display text-sm font-bold ${
                        tone === "plus" ? "text-brand-700" : "text-zinc-900"
                      }`}
                    >
                      {formatSignedDisplay(item.deltaDisplay)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">余 {item.balanceAfterDisplay}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error ? <p className="mt-4 text-center text-sm text-red-500">{error}</p> : null}

      {nextCursor ? (
        <div className="mt-5 flex justify-center">
          <button
            className="min-h-[44px] rounded-full bg-brand-50 px-5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={loadMore}
            type="button"
          >
            {loading ? "加载中..." : "加载更多"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
