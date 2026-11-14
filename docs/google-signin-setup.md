# Google 登录接入清单(Android)

代码已全部写完。**只剩一件事要你做:去 Google Cloud Console 建一个 Android OAuth 客户端,拿到 client id。**
下面是完整清单,照着做即可,不需要改任何代码。

---

## 一、为什么必须建 Android 类型的 client

- 移动端拿的是 **id_token**(Google 签名的 JWT),服务端用 Google 公钥验签,`client_secret` 全程不进 App。
- Google 按 **包名 + 签名 SHA-1** 认 Android 客户端。包名和签名对不上,Google 直接拒绝发 token。
- 同一份代码换个签名(比如以后用正式证书打包),必须再建一个 client 或给现有 client 补一条指纹。

---

## 二、包名与签名指纹(已从线上 APK 实测)

| 项目 | 值 |
| --- | --- |
| 包名 | `cn.pcmuz.esponal` |
| SHA-1 | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| SHA-256 | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

> 指纹来源:直接从已发布的 `esponal-v1.0.1.apk` 的 v2 签名块里解出来,不是推算值。
> 如果以后换 keystore,用 `keytool -list -v -keystore <keystore>` 取新的 SHA-1。

---

## 三、控制台操作步骤

1. 打开 <https://console.cloud.google.com/apis/credentials>
   (选你已经在用来给 Web 端做 Google 登录的那个项目,这样用户账号是同一套。)
2. 顶部 **Create credentials → OAuth client ID**
3. Application type 选 **Android**
4. Name 随便填,例如 `Esponal Android`
5. Package name 填 `cn.pcmuz.esponal`
6. SHA-1 填上面那一串(带冒号,原样粘贴)
7. 创建后会弹出一个形如
   `1234567890-abcdefg.apps.googleusercontent.com`
   的值 —— **这就是 client id**(注意 Android 类型没有 client_secret,也不需要)

---

## 四、当前状态(2026-11-14 已配置)

Android client id 已填入 `app.config.js` 的 `FALLBACK_GOOGLE_ANDROID_CLIENT_ID`:

```
944314756480-p5qqusb05evjcbf18dhvk8prril23onv.apps.googleusercontent.com
```

它同时被写进 `scheme`(`com.googleusercontent.apps.944314756480-p5qqusb05evjcbf18dhvk8prril23onv`)
和 `extra.googleAndroidClientId`,由 `src/config/google.ts` 读取 —— 改 id 只需动 `app.config.js` 一处。

下面是「以后换 client 时」的通用流程。

### 1)App 构建(二选一)

- 直接改 `app.config.js` 里的 `FALLBACK_GOOGLE_ANDROID_CLIENT_ID`(当前采用的方式);或
- GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret,Name `GOOGLE_ANDROID_CLIENT_ID`(构建脚本已把它透传成 `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`,优先级更高)。

两种方式都会让:
- `src/config/google.ts` 自动读到 id,登录页按钮从「待配置 client id」变成「使用 Google 继续」
- `app.config.js` 自动把回跳 scheme `com.googleusercontent.apps.<id 反写>` 写进 AndroidManifest
  (少这一步会表现为「在浏览器里授权完回不到 App」)

### 2)服务端验签

Vercel → 项目 → Settings → Environment Variables → 新增

- Key:`GOOGLE_ANDROID_CLIENT_ID`
- Value:同一个 client id
- Environment:Production(和 Preview 一起勾也行)

> 服务端允许的 audience 是 `GOOGLE_ANDROID_CLIENT_ID` + `GOOGLE_CLIENT_ID`(Web 那个,你之前配过)。
> 所以同一份账号体系里,App 和 Web 拿到的 token 都能验通。

改完环境变量需要 **Redeploy** 一次才生效。

---

## 五、自测方法

1. 重装新包,进登录页,Google 按钮应不再是灰的
2. 点按钮 → 系统浏览器/Chrome Custom Tab 打开 Google 账号选择 → 授权 → 自动回到 App
3. 回到 App 后应直接进首页,「我的」页能看到邮箱

服务端接口可直接用错误 token 探活(这条现在就该返回 401,不是 404):

```bash
curl -s -X POST https://www.pcmuz.cn/api/mobile/auth/google \
  -H "Content-Type: application/json" -d '{"idToken":"x"}'
# {"error":"google token is invalid or expired","code":"INVALID_GOOGLE_TOKEN"}
```

## 六、常见报错对照

| 现象 | 原因 |
| --- | --- |
| 按钮是灰的,文案「待配置 client id」 | 构建时没拿到 `GOOGLE_ANDROID_CLIENT_ID` |
| 浏览器页显示 `Error 400: invalid_request` / `redirect_uri_mismatch` | 建的不是 Android 类型 client,或 scheme 没进 AndroidManifest |
| 授权完停在浏览器白页,没回 App | 同上,scheme 缺失 |
| 服务端 `INVALID_GOOGLE_TOKEN` | client id 的 aud 不在服务端白名单,或 Vercel 没 Redeploy |
| `EMAIL_NOT_VERIFIED` | 该 Google 账号邮箱未验证 |
