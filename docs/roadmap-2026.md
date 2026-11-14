# Esponal 双端项目进度与未来规划（2026-11-15）

> 覆盖仓库：
> - **App 端（Expo / React Native）**：`C:\e`（`master` → `mobile` 分支自动出 APK，当前 **v1.0.10**）
> - **服务端 & Web 端（Next.js + Prisma + Redis）**：`C:\Users\wang\esponal`（`main` 分支 → Vercel 自动部署）

---

## 一、当前项目真实进度

### 1. App 端（`C:\e`，已迭代至 `v1.0.10`）
核心移动端学习闭环已跑通并可侧载实机使用：
- **基础架构**：5 Tab（首页 / 视频 / 阅读 / 复习 / 我的）、原生登录注册 + Google OAuth 服务端换 code、应用内自动检查更新与 APK 下载安装。
- **视频学习**：YouTube 播放（含 Error 153 补丁）、双语字幕、点词查义（含词法/变位/搭配/机器翻译兜底）、单句循环、倍速记忆（0.75x–1.5x）、横屏全屏、双语字幕 PDF 讲义导出、**跨设备续播（Redis 服务端同步）**。
- **阅读与听力**：分级短文、段落朗读（自动语种识别 + 缺西语音色走服务端 TTS）、**听力精听盲听模式**。
- **语法 / 词库 / 对话 / 复习**：语法知识库、AI 口语对话（Carlos）、我的词库 & 短语搭配、设置页（口音/语速/朗读偏好）、**FSRS 复习（批末小结 + 忘词补练 + 自动续批）**。

### 2. Web / 服务端（`C:\Users\wang\esponal`）
`feature_list.json` 共 **121 项**：
- `passing`：**99 项**（含近期补齐的 Mobile Auth、`/api/mobile/grammar`、`/api/mobile/app-version`、Redis 观看进度、TTS 升级等）
- `ready_for_qa`：**13 项**（`CREDITS-002`、`CREDITS-FE-001/003`、`IMPORT-1/3/4/5/6/7`、`MOBILE-R-001/PERF`、`INFRA-PW`、`INFRA-001`）
- `not_started`：**4 项**（`PATH-001`、`LEX-006`、`VOCAB-013`、`YT-SUBSCRIPTIONS`）
- `backlog`：**3 项**（`VOCAB-009-C`、`TALK-004`、`IMPORT-2`）
- `superseded`：**2 项**（`WATCH-008`、`MOBILE-005`）

---

## 二、当前主要差距与风险

1. **Web 端有、App 端尚未接入的功能**：统一导入（YouTube 链接 / PDF / EPUB 我的导入库）、零基础入门（`/phonics` 字母发音、`/learn` 9 单元骨架课程）、句子拆解器（`/dissect`）。
2. **Web 端自身待收口问题**：13 项 `ready_for_qa` 积压；Web 移动壳 `/home`、`/review`、`/me` 仍为过渡文案，`/settings` 404；`/` 未登录假数据 `119 词 / 4 篇` 与禁区进度环 SVG 残留；EPUB 阅读器尚缺点击查词。
3. **App 端商业化与分发短板**：积分/会员页（`CREDITS-FE`）尚未在 App 端完整闭环；当前为 `debug.keystore` 侧载，缺少正式发布签名、崩溃监控与 iOS 构建。

---

## 三、分阶段未来规划

### Phase 1 · 存量收口与 QA 归零（优先级：最高，建议 3–5 天）
- **目标**：把已经写完的 13 项 `ready_for_qa` 验证通过，消灭 Web 端死链和规范漂移。
- **服务端 / Web**：
  1. 集中过完 `CREDITS-002 / FE-001 / FE-003` 与 `IMPORT-1/3..7` 的 QA，更新 `feature_list.json` 为 `passing`。
  2. 补齐 Web `/settings`（或移除无效跳转），清理 `/home`、`/review`、`/me` 占位文案。
  3. 去掉 `/` 未登录假数据 `119 词 / 4 篇` 与 `DesktopLearningStepCard` 进度环 SVG，同步 `DESIGN-SYSTEM.md`。
  4. 清理根目录临时文件（`mockup-*.html`、`.tmp-*`、`test_out.txt`、`debug.log`）。

### Phase 2 · App 端补齐高价值闭环（v1.1.0，建议 1–2 周）
- **目标**：让 App 端从「好用的工具」升级为「零基础到进阶完整自洽」。
- **App 端（`C:\e`）**：
  1. **个人导入（接通服务端 `/api/import`）**：支持 App 内贴任意 YouTube 链接直接进播放学习；新增「我的导入库」查看已导入的 PDF/EPUB/文章并阅读点词。
  2. **零基础入门入口**：把 Web 端的「字母发音（`/phonics`）」和「骨架课程（`/learn`）」接口化并接入 App 首页/发现区，解决纯新手不知从何下手的问题。
  3. **积分与会员闭环**：在 App「我的」页接入配额消耗明细、积分不足引导与会员/兑换入口（对齐 `CREDITS-FE`）。
- **Web 端同步**：EPUB 阅读器接入点词查义 + 收藏到语料库；Watch 页清理 `MOCK_CHAPTERS`。

### Phase 3 · 深度能力与产品护城河（v1.2.0+，建议 2–4 周）
- **多模态口语纠音（`TALK-004`）**：AI 对话支持用户语音直传，针对中文母语者常见发音难点（如 `r/rr`、清浊辅音、重音位置）给出具体口型与发音建议。
- **YouTube 订阅与频道追踪（`YT-SUBSCRIPTIONS`）**：用户 OAuth 绑定后直接拉取常看西语频道更新，配合已有跨设备续播形成“每日可理解输入流”。
- **生词导出与复习生态（`VOCAB-013` / `LEX-006`）**：支持一键导出 Anki `.apkg`/CSV；探索轻量的语感搭配网络图。

### Phase 4 · 正式发布与工程化基建（上商店前必做）
- **Android 正式签名与上架准备**：生成正式 release keystore（妥善备份，切勿提交仓库），支持 AAB 构建、配置隐私政策页与账号注销流程（合规要求）。
- **可观测性与崩溃监控**：App 端接入 Sentry（服务端已有 Sentry），统一追踪播放器 Error、TTS 回退率、OAuth 失败率。
- **iOS 端验证**：基于 Expo 现有代码在 macOS / EAS Build 上跑通 iOS 真机测试与音频/后台播放权限。
