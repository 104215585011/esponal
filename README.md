# Esponal Mobile(Expo / React Native)

原生 App。与 Web 端共用同一个后端(https://www.pcmuz.cn)、同一套账号。
架构与决策见主仓库 `docs/tickets/PLATFORM-001-native-app.md`。

## 在手机上跑(开发期,用 Expo Go)

1. 手机装 **Expo Go**(Google Play / App Store 搜索 "Expo Go")
2. 电脑终端:
   ```bash
   cd C:/Users/wang/esponal-mobile
   npx expo start
   ```
3. 手机和电脑连**同一个 WiFi**,用 Expo Go 扫终端里的二维码
4. 连不上就用隧道模式(不需要同一 WiFi):
   ```bash
   npx expo start --tunnel
   ```

改代码后手机自动刷新,不需要重新扫码。

## 登录

用网页版的同一个账号。测试账号:`e2e@esponal.test` / `test-e2e-password-2026`
(仅开发期使用,上架前必须删除)

## 目前完成度(P1 骨架)

- [x] Expo Router 5 tab:首页 / 视频 / 阅读 / 复习 / 我的
- [x] 原生登录页 + token 存储(expo-secure-store)
- [x] 双通道鉴权:401 自动单飞刷新、refresh 也失效应回登录页
- [x] 复习 tab 接真实数据(`GET /api/vocab/review`)
- [ ] 视频 tab:YouTube iframe + 原生字幕(P2)
- [ ] 阅读 tab:分级列表 + 阅读器(P2)
- [ ] 点词查词 sheet(P2)

## 结构

```
app/                 expo-router 路由
  _layout.tsx        根布局 + 登录态守卫
  sign-in.tsx        登录页
  (tabs)/            5 个一级 tab
src/
  api/client.ts      fetch 封装(Bearer + 单飞 refresh + SecureStore)
  auth/AuthProvider.tsx
  theme.ts           设计 token(与 Web 端一致)
```

## 环境变量

默认连生产 API。要连本地:

```bash
EXPO_PUBLIC_API_BASE=http://192.168.x.x:3000 npx expo start
```
