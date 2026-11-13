# Esponal Mobile(Expo / React Native)

原生 App。与 Web 端共用同一个后端(https://www.pcmuz.cn)、同一套账号。
架构与决策见主仓库 `docs/tickets/PLATFORM-001-native-app.md`。

---

## 一、打 APK 装到手机(推荐)

APK 是**独立安装包**,不依赖电脑、不依赖 Metro,装上就能用。

### 本地构建(release)

前置(本机已配好):
- JDK 17 → `C:\Program Files\Java\jdk-17`
- Android SDK → `C:\Users\wang\android-sdk`(已装 platform-tools / android-36 / build-tools 36.0.0)

```bash
cd C:\Users\wang\esponal-mobile\android
./gradlew assembleRelease
```

产物:
```
android/app/build/outputs/apk/release/app-release.apk
```

> 首次构建会下 Gradle 发行版和依赖(约 200-400MB),之后走缓存。
> release 默认用 `debug.keystore` 签名 —— **能装能用**,但不是上架用的正式签名。
> 正式上架前必须生成自己的 keystore(见第五节)。

### 安装

- 数据线连电脑,把 apk 拷进手机,用文件管理器点开安装
- 或 `adb install -r android\app\build\outputs\apk\release\app-release.apk`
- 手机需允许「安装未知来源应用」

### 云端构建(没有 Android SDK 时)

```bash
npm i -g eas-cli
eas login          # 需要 Expo 账号
eas build -p android --profile preview
```
产出下载链接,`eas.json` 里 `preview` 已配成 APK。

---

## 二、开发期调试(Expo Go,改代码实时刷新)

1. 手机装 **Expo Go**(Google Play / App Store)
2. ```bash
   cd C:\Users\wang\esponal-mobile
   npx expo start
   ```
3. 手机与电脑**同一 WiFi**,用 Expo Go 扫终端二维码
4. 连不上用隧道:`npx expo start --tunnel`

> 本机网卡较多(含代理/虚拟网卡),Metro 可能选错 IP;终端按 `s` 可切换。

---

## 三、登录

用网页版的同一个账号。

开发测试账号:`e2e@esponal.test` / `test-e2e-password-2026`
(与主仓库 Playwright e2e 共用,**上架前必须删除或改密**)

---

## 四、完成度

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
- [ ] 双语字幕(中文行)
- [ ] 阅读 tab(分级列表 + 阅读器)
- [ ] 字幕本地缓存 / 离线

---

## 五、上架前必须做的(别忘)

1. **生成正式 keystore**,替换 `android/app/build.gradle` 里的 release 签名配置
2. 删除测试账号 `e2e@esponal.test`
3. 加「注销账号」入口(Play 强制要求)
4. 隐私政策链接(用 Web 端已有页面)
5. targetSdk 跟随 Google 要求(2026-08-31 起需 36)

---

## 六、结构

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
android/                  prebuild 生成,已被 gitignore
eas.json                  云构建配置
```

## 七、环境变量

默认连生产 API。要连本地后端:

```bash
EXPO_PUBLIC_API_BASE=http://192.168.x.x:3000 npx expo start
```

打 APK 时同样可以传(需在构建前设置):

```bash
$env:EXPO_PUBLIC_API_BASE="https://www.pcmuz.cn"
```
