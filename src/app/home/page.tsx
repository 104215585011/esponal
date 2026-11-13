// Timestamp: 2026-11-13 14:00
import Link from "next/link";

type Entry = {
  title: string;
  hint: string;
  href: string;
};

const primaryEntries: Entry[] = [
  { title: "复习生词", hint: "到期待复习的词", href: "/review" },
  { title: "看视频", hint: "YouTube 双语字幕", href: "/watch" },
  { title: "读短文", hint: "分级读物 + 我的导入", href: "/lectura" }
];

const tools: Entry[] = [
  { title: "学习路线", hint: "A1 → B1", href: "/learn" },
  { title: "语料库", hint: "生词本", href: "/vocab" },
  { title: "AI 对话", hint: "5 位老师", href: "/talk" },
  { title: "语法", hint: "要点卡片", href: "/grammar" },
  { title: "拆解", hint: "句子骨架", href: "/dissect" },
  { title: "字母", hint: "发音入门", href: "/phonics" }
];

export default function MobileHomePage() {
  return (
    <main className="px-4 pb-2 pt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Hoy</p>
      <h1 className="mt-2 text-[26px] font-extrabold leading-[1.3] tracking-tight text-zinc-950 dark:text-zinc-50">
        今天继续读一点
        <br />
        西语。
      </h1>
      <p className="mt-2.5 text-[13px] leading-6 text-zinc-500">
        正式首页在 P1 上线。这一版先把所有入口摆齐,不让任何功能变成黑户。
      </p>

      <div className="mt-5 grid gap-2">
        {primaryEntries.map((entry) => (
          <Link
            className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3.5 transition active:scale-[0.99] dark:border-zinc-800/70 dark:bg-zinc-900"
            href={entry.href}
            key={entry.href}
          >
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</span>
              <span className="mt-0.5 text-[11.5px] text-zinc-500">{entry.hint}</span>
            </span>
            <span className="text-[12px] font-semibold text-brand-600">进入 →</span>
          </Link>
        ))}
      </div>

      <h2 className="mt-7 text-[15px] font-bold text-zinc-900 dark:text-zinc-50">练习与工具</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tools.map((tool) => (
          <Link
            className="rounded-2xl border border-zinc-200/70 bg-white px-2 py-3.5 text-center transition active:scale-[0.97] dark:border-zinc-800/70 dark:bg-zinc-900"
            href={tool.href}
            key={tool.href}
          >
            <span className="block text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-50">{tool.title}</span>
            <span className="mt-1 block text-[10.5px] text-zinc-500">{tool.hint}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
