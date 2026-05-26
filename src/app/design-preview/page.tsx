// Timestamp: 2026-05-26 16:30
"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────────
   Esponal · 书页感 / 杂志排版 设计原型 v2
   核心原则：
   · 版式即设计，不依赖卡片、数字序号、stats bar
   · 双栏 editorial 布局，留白是主角
   · serif 衬线字体贯穿全局
   · 用 rule 和空白分隔，不用边框
   · 内容本身就是美的
───────────────────────────────────────────────────────────── */

export default function DesignPreviewV2() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="ed-sans"
      style={{ backgroundColor: "#0F0C08", color: "#F5F0E8", minHeight: "100vh" }}
    >

        {/* ══════════════════════════════════════════
            MASTHEAD — 像杂志封面的刊头
        ══════════════════════════════════════════ */}
        <header>
          {/* 顶部细栏 */}
          <div
            className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3"
            style={{ borderBottom: "1px solid rgba(245,240,232,0.08)" }}
          >
            <span className="ed-marginnote" style={{ color: "#5C544A" }}>VOL. I — A1/A2</span>
            <div className="hidden items-center gap-8 sm:flex">
              {["发音", "词汇", "语法", "阅读"].map((t) => (
                <a key={t} href="#" className="ed-link ed-sans" style={{ fontSize: "0.75rem", letterSpacing: "0.06em" }}>
                  {t}
                </a>
              ))}
            </div>
            <span className="ed-marginnote">2026</span>
          </div>

          {/* 大标题区 — 不对称双栏 */}
          <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-20 sm:pb-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-0">

              {/* 左栏：刊名 */}
              <div className="flex-1 lg:pr-12">
                <p className="ed-marginnote mb-4" style={{ color: "#D97706" }}>
                  ESPAÑOL · PARA HABLANTES DE CHINO
                </p>
                <h1
                  className="ed-display font-black leading-[0.92] tracking-tight"
                  style={{ fontSize: "clamp(4.5rem, 12vw, 9rem)", color: "#F5F0E8" }}
                >
                  Espo<br />
                  <em style={{ color: "#D97706", fontStyle: "italic" }}>nal</em>
                </h1>
              </div>

              {/* 右栏：副标题 + 入口 */}
              <div
                className="max-w-xs lg:max-w-[280px] lg:border-l lg:pl-8"
                style={{ borderColor: "rgba(245,240,232,0.1)" }}
              >
                <p
                  className="ed-body mb-6 leading-relaxed"
                  style={{ fontSize: "1.15rem", color: "#A89880", fontStyle: "italic" }}
                >
                  为中文母语者设计的西班牙语学习平台。从零开始，A1 到 A2。
                </p>
                <a href="#" className="ed-link" style={{ fontSize: "0.85rem" }}>
                  从发音开始 →
                </a>
              </div>
            </div>
          </div>

          <hr className="ed-rule mx-auto max-w-6xl" style={{ marginLeft: "1.5rem", marginRight: "1.5rem" }} />
        </header>


        {/* ══════════════════════════════════════════
            EDITORIAL INTRO — 像一篇杂志开篇语
        ══════════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">

            {/* 左：章节注 */}
            <div className="lg:pt-1">
              <p className="ed-marginnote mb-3" style={{ color: "#D97706" }}>§ 01</p>
              <p className="ed-marginnote" style={{ color: "#3A342E" }}>
                学西语的人都说，<br />
                前期最难熬，<br />
                后来停不下来。
              </p>
            </div>

            {/* 右：正文 */}
            <div>
              <p
                className="ed-display mb-6 font-bold leading-[1.2]"
                style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.25rem)", color: "#F5F0E8" }}
              >
                西语不难，难的是<br />
                <em style={{ color: "#D97706" }}>撑过最初那三个月。</em>
              </p>

              <div className="ed-body space-y-4 leading-[1.9]" style={{ fontSize: "1.1rem", color: "#A89880" }}>
                <p>
                  几乎每个学过西语的人都说同一件事：前期的记忆和重复很枯燥，但只要撑过去，某个节点之后，语言会开始自己运转。句子不再需要翻译，你直接读懂了。
                </p>
                <div className="ed-pullquote my-6">
                  <p
                    className="ed-display italic"
                    style={{ fontSize: "1.35rem", color: "#D97706" }}
                  >
                    &quot;El idioma es la ropa del pensamiento.&quot;
                  </p>
                  <p className="ed-marginnote mt-2" style={{ color: "#5C544A" }}>语言是思维的衣服。</p>
                </div>
                <p>
                  Esponal 不会帮你跳过那三个月——但会让它不那么难熬。发音、词汇、语法、阅读，每一步都用你本来就懂的中文逻辑来解释西语的不同。
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="ed-rule mx-6" />


        {/* ══════════════════════════════════════════
            TABLE OF CONTENTS — 杂志目录，不是卡片
        ══════════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex items-baseline justify-between">
            <p className="ed-marginnote" style={{ color: "#D97706" }}>CONTENIDO</p>
            <p className="ed-marginnote">— 四个章节</p>
          </div>

          <div>
            {[
              {
                num: "I",
                zh: "发音",
                es: "Fonética",
                desc: "26 个字母，每个字母的变音规则，从 a 到 z 建立听觉基础。大多数学习者在这里省略太多，导致后面越来越难。",
                note: "约 2 小时",
              },
              {
                num: "II",
                zh: "词汇",
                es: "Vocabulario",
                desc: "核心 500 词，按语义场分组，配例句与闪卡。词义不是孤立的，是在句子里学会的。",
                note: "500 词",
              },
              {
                num: "III",
                zh: "语法",
                es: "Gramática",
                desc: "动词变位、名词性别、ser 与 estar 的分野。不是表格背诵，是用中文逻辑理解西语为什么这样设计。",
                note: "12 话题",
              },
              {
                num: "IV",
                zh: "阅读",
                es: "Lectura",
                desc: "从句子到段落，真实语料。阅读是所有学习的目的地，也是检验一切的地方。",
                note: "持续更新",
              },
            ].map((item) => (
              <a
                key={item.num}
                href="#"
                className="ed-toc-item flex cursor-pointer items-baseline gap-6 px-0 py-5"
                style={{ textDecoration: "none", display: "flex" }}
              >
                {/* 章节号 */}
                <span
                  className="ed-display shrink-0 font-bold"
                  style={{ fontSize: "1rem", color: "#3A342E", minWidth: "2rem" }}
                >
                  {item.num}
                </span>

                {/* 标题 */}
                <span
                  className="ed-display shrink-0 font-bold"
                  style={{ fontSize: "clamp(1.1rem,2.5vw,1.5rem)", color: "#F5F0E8", minWidth: "4rem" }}
                >
                  {item.zh}
                </span>
                <span
                  className="ed-body shrink-0 hidden italic sm:inline"
                  style={{ fontSize: "1rem", color: "#5C544A", minWidth: "6rem" }}
                >
                  {item.es}
                </span>

                {/* 描述 — 自动填充剩余空间 */}
                <span
                  className="ed-body hidden flex-1 leading-relaxed lg:block"
                  style={{ fontSize: "0.95rem", color: "#7A6E63" }}
                >
                  {item.desc}
                </span>

                {/* 备注 */}
                <span
                  className="ed-marginnote shrink-0 ml-auto ed-toc-arrow"
                  style={{ color: "#3A342E", opacity: 0.4, transition: "opacity 0.2s" }}
                >
                  {item.note}
                </span>
              </a>
            ))}
            <hr className="ed-rule" />
          </div>
        </section>


        {/* ══════════════════════════════════════════
            SPECIMEN PAGE — 字符标本页（惊喜时刻）
            像一本排版手册的展示页，不是 UI 组件
        ══════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          style={{ backgroundColor: "#080604", minHeight: "85vh" }}
        >
          {/* 字母充满背景 */}
          <div
            className="ed-display ed-specimen-bg pointer-events-none absolute inset-0 flex items-center justify-center select-none font-black"
            style={{
              fontSize: "min(90vw, 90vh)",
              color: "#F5F0E8",
              opacity: 0.06,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            Ñ
          </div>

          {/* 内容：左右两栏，像字典页 */}
          <div className="relative mx-auto grid min-h-[85vh] max-w-6xl px-6 py-20 lg:grid-cols-2 lg:gap-16 items-center">

            {/* 左：字符展示 */}
            <div className="flex flex-col justify-center">
              <p className="ed-marginnote mb-6" style={{ color: "#D97706" }}>LETRA · 27ª</p>
              <div
                className="ed-display font-black leading-none"
                style={{ fontSize: "clamp(7rem,22vw,16rem)", color: "#F5F0E8", lineHeight: 0.88 }}
              >
                Ñ
              </div>
              <div
                className="ed-display mt-4 italic"
                style={{ fontSize: "clamp(1.2rem,3vw,1.75rem)", color: "#D97706" }}
              >
                [ɲ]
              </div>
            </div>

            {/* 右：多栏注释，像标本页的文字说明 */}
            <div
              className="flex flex-col justify-center border-t pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10"
              style={{ borderColor: "rgba(245,240,232,0.08)" }}
            >
              <h3
                className="ed-display mb-3 font-bold"
                style={{ fontSize: "1.5rem", color: "#F5F0E8" }}
              >
                西语独有的字母
              </h3>

              <p className="ed-body mb-6 leading-[1.85]" style={{ fontSize: "1.05rem", color: "#7A6E63" }}>
                26 个拉丁字母加上这个 ñ，才是完整的西班牙语字母表。这个顶着波浪符的 n，发音像中文&quot;你&quot;里的鼻音，但要拉长一拍。
              </p>

              <hr className="ed-rule mb-6" />

              {/* 例词，像字典条目 */}
              <div className="space-y-4">
                {[
                  { word: "niño",    ipa: "['ni.ɲo]",       zh: "男孩"    },
                  { word: "mañana",  ipa: "[ma.'ɲa.na]",    zh: "明天 / 早上" },
                  { word: "español", ipa: "[es.pa.'ɲol]",   zh: "西班牙语" },
                  { word: "señor",   ipa: "[se.'ɲor]",      zh: "先生"    },
                ].map((e) => (
                  <div key={e.word} className="flex items-baseline gap-3">
                    <span
                      className="ed-display font-semibold"
                      style={{ fontSize: "1.05rem", color: "#F5F0E8", minWidth: "5.5rem" }}
                    >
                      {e.word}
                    </span>
                    <span
                      className="ed-body hidden italic sm:inline"
                      style={{ fontSize: "0.85rem", color: "#5C544A", minWidth: "8rem" }}
                    >
                      {e.ipa}
                    </span>
                    <span
                      className="ed-sans"
                      style={{ fontSize: "0.8rem", color: "#7A6E63" }}
                    >
                      {e.zh}
                    </span>
                  </div>
                ))}
              </div>

              <hr className="ed-rule mt-6 mb-5" />

              <a href="#" className="ed-link ed-sans" style={{ fontSize: "0.8rem", letterSpacing: "0.04em" }}>
                查看全部字母 →
              </a>
            </div>
          </div>
        </section>


        {/* ══════════════════════════════════════════
            FLASHCARD — 练习册页的感觉，不是 UI 组件
        ══════════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-14 lg:grid-cols-[2fr_1fr]">

            {/* 左：排版说明文字 */}
            <div>
              <p className="ed-marginnote mb-5" style={{ color: "#D97706" }}>§ 02 · VOCABULARIO</p>
              <h2
                className="ed-display mb-5 font-bold leading-[1.1]"
                style={{ fontSize: "clamp(1.8rem,4vw,2.75rem)", color: "#F5F0E8" }}
              >
                一次遇见一个词，<br />
                <em style={{ color: "#D97706" }}>在句子里</em>记住它。
              </h2>
              <p className="ed-body mb-8 leading-[1.85]" style={{ fontSize: "1.1rem", color: "#7A6E63" }}>
                每张卡带例句、词性标注和发音。不是孤立地背一个词义，而是在它本来生长的地方遇见它。
              </p>
              <a href="#" className="ed-link ed-sans" style={{ fontSize: "0.8rem", letterSpacing: "0.04em" }}>
                进入词汇练习 →
              </a>
            </div>

            {/* 右：闪卡 */}
            <div>
              <div className="ed-flip-scene" style={{ height: "240px" }}>
                <div className={`ed-flip-inner ${flipped ? "flipped" : ""}`}>
                  {/* 正面 */}
                  <div
                    className="ed-flip-face cursor-pointer"
                    style={{
                      backgroundColor: "#16130F",
                      border: "1px solid rgba(245,240,232,0.08)",
                    }}
                    onClick={() => setFlipped(true)}
                  >
                    <p className="ed-marginnote mb-4" style={{ color: "#5C544A" }}>n. masculino</p>
                    <p
                      className="ed-display font-bold"
                      style={{ fontSize: "clamp(2.5rem,8vw,3.5rem)", color: "#F5F0E8" }}
                    >
                      libro
                    </p>
                    <p className="ed-sans mt-4" style={{ fontSize: "0.72rem", color: "#3A342E", letterSpacing: "0.08em" }}>
                      点击翻面
                    </p>
                  </div>

                  {/* 背面 */}
                  <div
                    className="ed-flip-face ed-flip-back cursor-pointer"
                    style={{
                      backgroundColor: "#1A1510",
                      border: "1px solid rgba(217,119,6,0.12)",
                    }}
                    onClick={() => setFlipped(false)}
                  >
                    <p
                      className="ed-display font-bold"
                      style={{ fontSize: "2.75rem", color: "#D97706" }}
                    >
                      书
                    </p>
                    <p className="ed-body mt-3 text-center italic leading-[1.8]" style={{ fontSize: "0.95rem", color: "#5C544A" }}>
                      &quot;Me gusta leer este libro.&quot;
                      <br />
                      <span style={{ color: "#7A6E63", fontStyle: "normal" }}>我喜欢读这本书。</span>
                    </p>
                  </div>
                </div>
              </div>
              <p className="ed-marginnote mt-3 text-center" style={{ color: "#2E2820" }}>
                空格键播放 · → 下一张
              </p>
            </div>
          </div>
        </section>

        <hr className="ed-rule mx-6" />


        {/* ══════════════════════════════════════════
            CLOSING — 收尾，克制，不是 CTA 横幅
        ══════════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-6 py-28 text-center">
          <p
            className="ed-display mx-auto mb-4 max-w-xl italic leading-[1.3]"
            style={{ fontSize: "clamp(1.3rem,3vw,2rem)", color: "#A89880" }}
          >
            &quot;Hablar otro idioma es poseer una segunda alma.&quot;
          </p>
          <p className="ed-marginnote mb-12" style={{ color: "#3A342E" }}>
            — 说另一种语言，就是拥有第二个灵魂。
          </p>
          <a
            href="#"
            className="ed-sans inline-block rounded-full px-8 py-3 text-sm font-medium"
            style={{ backgroundColor: "#D97706", color: "#0F0C08", textDecoration: "none", transition: "opacity 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.82")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            开始学习 →
          </a>
        </section>


        {/* ══════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════ */}
        <footer style={{ borderTop: "1px solid rgba(245,240,232,0.07)" }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <span className="ed-display font-bold" style={{ fontSize: "1.1rem", color: "#F5F0E8" }}>Esponal</span>
            <span className="ed-marginnote" style={{ color: "#2E2820" }}>
              为中文母语者设计的西语学习平台
            </span>
          </div>
        </footer>

    </div>
  );
}
