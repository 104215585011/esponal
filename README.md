# Esponal Mobile(Expo / React Native)

原生 App。与 Web 端共用同一个后端(https://www.pcmuz.cn)、同一套账号。
架构与决策见主仓库 `docs/tickets/PLATFORM-001-native-app.md`。

**仓库位置**:`C:\e`(独立 git 仓库,远程为 `esponal` 仓库的 `mobile` 分支)

> ⚠️ 为什么不在 `C:\Users\wang\esponal-mobile`?
> Windows 有 260 字符路径上限,RN 新架构编译时 CMake 会把源码绝对路径镜像到构建目录,
> 原路径直接超限、构建失败。移到 `C:\e` 后路径缩短 24 字符,问题解决。

---

## 一、装到手机(最快)

**直接下载安装**,不需要电脑、不需要 Expo Go:

```
https://github.com/104215585011/esponal/releases/download/mobile-v0.6.2/esponal-v0.6.2.apk
```

手机浏览器打开 → 下载 → 允许「安装未知来源应用」→ 安装。

当前包:v0.6.2(2026-11-14),31.2MB,arm64-v8a。
签名用的是 debug keystore —— **能装能用**,但不是上架用的正式签名。

**版本历史**
| 版本 | 内容 |
|---|---|
| v0.6.2 | 修复 YouTube Error 153(嵌入来源校验,YouTube 2025 新政策,与 API 配额无关) |
| v0.6.1 | 修复播放页暂停/拖进度条失灵(播放器 HTML 内置 + 程序化播放 + 触摸层);点视频画面可播放/暂停;词典未收录的词自动显示机器翻译 |
| v0.6.0 | + 播放页进度条(拖动控制播放)、+ 查词面板补齐词法讲解/用法/相关词组/变位、修复查询内容不显示 |
| v0.5.0 | + 应用内更新(App 内下载 APK 并拉起安装器)、登录态跨版本保留 |
| v0.4.1 | + 阅读器打开即标记已读(列表显示「已读」) |
| v0.4.0 | + 应用内更新检查(启动自动检查、我的页手动检查、一键下载) |
| v0.3.0 | + 阅读器段落朗读(连续播放、当前段高亮) |
| v0.2.0 | + 双语字幕(中文开关)、+ 阅读 tab(列表 + 阅读器 + 点词查词) |
| v0.1.0 | 5 tab、原生登录、复习、视频列表、播放页(字幕 + 点词) |

### 更新机制(重要)

侧载 APK 不会自动更新,所以做了**应用内更新**:

- App 启动(登录后)静默请求 `GET /api/mobile/app-version`
- 后端从 GitHub Releases 读最新 `mobile-v*` tag,**发新版即生效,无需人工维护**(Redis 缓存 5 分钟)
- 发现新版 → 弹窗 → 点「**立即更新**」→ **在 App 内下载 APK(带进度)→ 自动拉起系统安装器**
- 「我的」页也能手动检查

**登录态会保留**,因为:

1. 所有版本用同一个 `android/app/debug.keystore` 签名 —— 已实测 v0.4.0 与 v0.4.1 证书 SHA-256 完全相同(`fac61745dc090378...`)
2. 同签名覆盖安装时,Android 保留应用数据,`expo-secure-store` 里的 token 和用户信息都还在
3. `app.json` 加了 `REQUEST_INSTALL_PACKAGES` 权限,App 才能拉起安装器

> **系统限制**:Android 不允许应用静默安装 APK,下载完成后必须用户点「安装」确认。
> 这是安全策略,任何侧载 App 都一样。首次更新可能需要在系统设置里允许「安装未知应用」。

**发版时必做**:改 `app.json` 的 `version`(递增)和 `android.versionCode`(递增),否则 App 认为自己是新版、不会提示。

---

## 二、重新出包:GitHub Actions(推荐)

本地 Windows 构建有坑(见附录),**云端构建是已验证可靠的路径**。

```bash
cd C:\e
git add -A && git commit -m "feat: xxx"
git push origin master:mobile
```

推送到 `mobile` 分支即自动触发 `.github/workflows/build-apk.yml`:

1. Ubuntu + Node 22 + JDK 17 + 预装 Android SDK
2. `expo prebuild` 生成原生工程
3. 单 ABI(arm64-v8a)编译 release APK
4. 上传 artifact `esponal-apk`

**拿产物**:仓库 → Actions → 最新 `Build Android APK` → 页面底部 Artifacts → `esponal-apk.zip`(需登录 GitHub)

**发成公开直链**:用 GitHub API 建 release 并把 apk 上传为 asset,得到
`https://github.com/<owner>/<repo>/releases/download/<tag>/<name>.apk`,手机点开即下。

构建耗时:约 13-15 分钟(首次),之后走缓存更快。

---

## 三、本地构建(可选,有坑)

前置:JDK 17(`C:\Program Files\Java\jdk-17`)、Android SDK(`C:\Users\wang\android-sdk`)

```bash
cd C:\e\android
./gradlew assembleRelease
```

产物:`android/app/build/outputs/apk/release/app-release.apk`

如非必要,优先用 GitHub Actions。

---

## 四、开发期调试(Expo Go,改代码实时刷新)

1. 手机装 **Expo Go**(Google Play / App Store)
2. ```bash
   cd C:\e
   npx expo start
   ```
3. 手机与电脑**同一 WiFi**,用 Expo Go 扫终端二维码
4. 连不上用隧道:`npx expo start --tunnel`

> 本机网卡较多(含代理/虚拟网卡),Metro 可能选错 IP;终端按 `s` 可切换。

---

## 五、登录

用网页版的同一个账号。

开发测试账号:`e2e@esponal.test` / `test-e2e-password-2026`
(与主仓库 Playwright e2e 共用,**上架前必须删除或改密**)

---

## 六、完成度

### P1 骨架
- [x] expo-router 5 tab:首页 / 视频 / 阅读 / 复习 / 我的
- [x] 原生登录页 + `expo-secure-store` 存 token
- [x] 双通道鉴权:401 单飞刷新、refresh 失败自动回登录页
- [x] 复习 tab 接真实数据(`GET /api/vocab/review`)

### P2 播放体验
- [x] 视频列表(三个精选频道,真实数据 + 缩略图 + 时长)
- [x] 播放页:YouTube iframe(`controls=0`)+ 原生控制条
- [x] 原生字幕列表:自动跟随当前句、手动滚动暂停跟随、点句定位
- [x] 点词查词:原生面板(释义/音标/例句/加入词库)
- [x] **双语字幕**:当前句 ±2 滑动窗口预翻译,文本级缓存,「中文」开关可切纯西语
- [x] **阅读 tab**:分级列表(A1/A2/B1)+ 原生阅读器 + 段落点词 + 生词表
- [x] **段落朗读**:阅读器顶部「朗读」,连续播放全文,当前段高亮
  - 用预生成静态音频 `public/audio/lectura/<slug>/p<n>.mp3`(与段落 1:1),
    不走实时 TTS —— 服务端 `/api/tts` 目前生产返回 500(存量问题)
- [ ] 字幕本地缓存 / 离线
- [ ] App 内标记已读

---

## 七、上架前必须做的

1. **生成正式 keystore**,替换 `android/app/build.gradle` 的 release 签名配置
2. 删除测试账号 `e2e@esponal.test`
3. 加「注销账号」入口(Play 强制要求)
4. 隐私政策链接(用 Web 端已有页面)
5. targetSdk 跟随 Google 要求(2026-08-31 起需 36+)
6. Play 新账号需 12 名测试者 × 14 天封闭测试

---

## 八、结构

```
app/                      expo-router 路由
  _layout.tsx             根布局 + 登录态守卫
  sign-in.tsx             登录页
  (tabs)/                 5 个一级 tab
  watch/[videoId].tsx     播放页(iframe + 原生字幕 + 查词)
src/
  api/client.ts           fetch 封装(Bearer + 单飞 refresh + SecureStore)
  api/watch.ts            频道视频 / 字幕 / 查词 / 加词
  auth/AuthProvider.tsx   登录态
  components/TranscriptRow.tsx   字幕行(分词,单词可点)
  components/LookupSheet.tsx     查词面板
  theme.ts                设计 token(与 Web 端一致)
.github/workflows/build-apk.yml 云端构建
android/                  prebuild 生成(gitignore)
eas.json                  EAS 云构建配置(备用)
```

---

## 九、环境变量

默认连生产 API。要连本地后端:

```bash
EXPO_PUBLIC_API_BASE=http://192.168.x.x:3000 npx expo start
```

构建时同理(CI 里已写死 `https://www.pcmuz.cn`)。

---

## 附录:本地构建踩过的坑(2026-11-13 实测)

按顺序遇到并解决的问题,留作以后参考:

| # | 现象 | 根因 | 处理 |
|---|---|---|---|
| 1 | `next dev` / npm 安装失败 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` | 沙箱文件删除保护(50 文件/次) | 先手动清 `.next` / `node_modules/.cache` |
| 2 | `npx expo install` 崩溃 | CLI 子命令异常 | 查 `node_modules/expo/bundledNativeModules.json` 拿版本号,直接 `npm install` |
| 3 | `Unable to resolve module react-native-web-webview` | `react-native-youtube-iframe` 的 web 适配包缺失,Metro 会扫所有平台文件 | `npm i react-native-web-webview` |
| 4 | 构建卡 1 小时无输出 | Gradle 默认编 4 个 ABI(armeabi-v7a/arm64-v8a/x86/x86_64) | `reactNativeArchitectures=arm64-v8a` |
| 5 | `ninja: error: mkdir(...): No such file or directory` | **Windows 260 字符路径上限**(CMake 镜像源码绝对路径) | 项目移到 `C:\e` |
| 6 | Gradle 死锁(CPU 不涨、无进程活动) | 并行构建 + 路径异常 | `--max-workers=1` 可绕过,或换 Linux 云端构建 |
| 7 | 移动目录后 `projectDirectory ... does not exist` | autolinking / gradle 缓存了旧绝对路径 | 删 `android/build`、`android/.gradle`、`.expo`、`node_modules/.cache` |

**结论**:Windows 本地构建 RN 新架构不稳定,**优先用 GitHub Actions**。
