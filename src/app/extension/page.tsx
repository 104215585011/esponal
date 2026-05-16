import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";

const features = [
  {
    label: "双语字幕",
    title: "西语原文和中文解释同屏",
    body: "看视频时保留西语输入，同时用中文帮你确认意思。"
  },
  {
    label: "点词查义",
    title: "字幕里的单词可以直接点",
    body: "查看词形、义项和例句，把听不懂的地方变成可学习材料。"
  },
  {
    label: "自动生词本",
    title: "遇到的词会回到 Web 端",
    body: "保存词条时带上视频时间点，之后可以从词库跳回原片段。"
  }
];

const steps = [
  "下载 Esponal Chrome 插件安装包。",
  "解压 zip 文件到一个固定文件夹。",
  "打开 chrome://extensions，并开启开发者模式。",
  "点击“加载已解压的扩展程序”，选择解压后的文件夹。"
];

const faqs = [
  {
    question: "为什么现在不是 Chrome 商店安装？",
    answer: "当前版本还在早期验证阶段，先通过开发者模式安装。等权限、隐私说明和审核材料稳定后，再推进商店上架。"
  },
  {
    question: "支持哪些浏览器？",
    answer: "优先支持 Chrome，也可以在 Edge、Brave 等 Chromium 内核浏览器中用开发者模式安装。"
  },
  {
    question: "生词会同步到 Web 端吗？",
    answer: "会。插件调用同一套 Web API 保存词条和出处，所以你可以在 Web 端词库里继续整理。"
  },
  {
    question: "数据存在什么地方？",
    answer: "账号、词库和遭遇记录保存在 Esponal 后端。后续会补充导出和更细的数据管理能力。"
  }
];

export default function ExtensionPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-screen-xl px-4 py-10 sm:py-14">
          <div className="overflow-hidden rounded-hero bg-gradient-to-br from-brand-50 via-white to-surface px-6 py-10 shadow-hero sm:px-10 sm:py-16">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Esponal Chrome Extension
                </p>
                <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
                  把 YouTube 变成你的西语课堂
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-gray-600">
                  在西语 YouTube 视频里看双语字幕、点词查义，并把有用的生词自动收进词库。
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    className="rounded-card bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                    download
                    href="/extension/esponal-extension.zip"
                  >
                    下载安装包
                  </a>
                  <Link
                    className="rounded-card border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-400 hover:text-brand-700"
                    href="/watch?v=A0yzRIuKYUw"
                  >
                    看 30 秒演示
                  </Link>
                </div>
                <p className="mt-5 text-sm text-gray-500">
                  兼容 Chrome / Edge / Brave。当前通过开发者模式安装。
                </p>
              </div>

              <div className="relative overflow-hidden rounded-hero bg-gray-950 p-5 text-white shadow-elevated">
                <div className="aspect-video overflow-hidden rounded-card bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Spanish YouTube lesson preview"
                    className="h-full w-full object-cover"
                    src="https://img.youtube.com/vi/A0yzRIuKYUw/hqdefault.jpg"
                  />
                </div>
                <div className="mt-5 rounded-card bg-black/35 p-4">
                  <p className="text-sm text-white/75">¿De dónde salió esa idea?</p>
                  <p className="mt-2 text-lg font-medium">这个主意是从哪里来的？</p>
                </div>
                <div className="mt-3 flex gap-2 text-xs text-white/75">
                  <span className="rounded-full bg-white/10 px-3 py-1">字幕叠加</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">点词查义</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">保存出处</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-screen-xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div className="rounded-card bg-surface p-6 shadow-card" key={feature.title}>
              <p className="text-sm font-semibold text-brand-600">{feature.label}</p>
              <h2 className="mt-3 text-xl font-semibold text-gray-950">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-screen-xl px-4 py-8">
        <div className="rounded-hero bg-surface px-6 py-8 shadow-card sm:px-8">
          <h2 className="text-2xl font-bold text-gray-950">安装步骤</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {steps.map((step, index) => (
              <div className="rounded-card bg-muted p-5" key={step}>
                <span className="flex h-8 w-8 items-center justify-center rounded-card bg-brand-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="mt-4 text-sm leading-6 text-gray-700">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-screen-xl px-4 py-10">
        <div className="rounded-hero bg-surface px-6 py-8 shadow-card sm:px-8">
          <h2 className="text-2xl font-bold text-gray-950">FAQ</h2>
          <div className="mt-5 divide-y divide-gray-100">
            {faqs.map((faq) => (
              <details className="group py-4" key={faq.question}>
                <summary className="cursor-pointer list-none text-base font-semibold text-gray-900">
                  {faq.question}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
