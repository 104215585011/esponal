// Timestamp: 2026-11-13 17:20
//
// PLATFORM-001:原生 App 双通道鉴权回归脚本。
//
// 用法:
//   node scripts/verify-mobile-auth.mjs                                  # 本地 3017
//   BASE_URL=https://www.pcmuz.cn node scripts/verify-mobile-auth.mjs    # 线上
//
// 前置:npm run seed:e2e(创建 e2e@esponal.test 账号,幂等)
//
// 退出码:0 全部通过;1 有断言失败(可接 CI)。

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3017";
const EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@esponal.test";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "test-e2e-password-2026";

const results = [];

const call = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body };
};

const check = (label, actual, expected, extra = "") => {
  const ok = actual === expected;
  results.push({ label, actual, expected, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(32)} 期望 ${expected} 实际 ${actual}${extra ? `  ${extra}` : ""}`
  );
};

const run = async () => {
  // ---- 1. 登录 ----
  const login = await call("/api/mobile/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  check("登录返回 200", login.status, 200);
  const accessToken = login.body?.accessToken;
  const refreshToken = login.body?.refreshToken;
  check("返回 accessToken", Boolean(accessToken), true);
  check("返回 refreshToken", Boolean(refreshToken), true);
  check("accessToken 15 分钟", login.body?.accessTokenExpiresIn, 900);
  check("refreshToken 30 天", login.body?.refreshTokenExpiresIn, 2592000);

  if (!accessToken || !refreshToken) {
    console.error("\n登录失败,后续用例跳过。请确认已执行 npm run seed:e2e");
    process.exit(1);
  }

  // ---- 2. 错误密码 ----
  const wrong = await call("/api/mobile/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "definitely-wrong" })
  });
  check("错误密码 401", wrong.status, 401);
  check("错误码 INVALID_CREDENTIALS", wrong.body?.code, "INVALID_CREDENTIALS");

  // ---- 3. 必需登录的接口 ----
  check("业务接口无 token → 401", (await call("/api/vocab/review")).status, 401);
  check(
    "业务接口坏 token → 401",
    (await call("/api/vocab/review", { headers: { Authorization: "Bearer garbage" } })).status,
    401
  );
  const withBearer = await call("/api/vocab/review", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  check("业务接口 Bearer → 200", withBearer.status, 200);
  check("返 dueWords 字段", Array.isArray(withBearer.body?.dueWords), true);

  // ---- 3b. 加词/收藏搭配的双通道回归(VOCAB-APP) ----
  const addWord = await call("/api/vocab/add", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      lemma: "e2e-verify-word",
      translation: "验证词",
      form: "e2e-verify-word",
      sourceType: "video",
      sourceUrl: "https://www.youtube.com/watch?v=e2e-verify",
      timestampSec: 1,
      originalSentence: "Frase de verificación e2e.",
      translatedSentence: "e2e 验证句子。"
    })
  });
  check("vocab/add Bearer → 200", addWord.status, 200);
  const addRepeat = await call("/api/vocab/add", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      lemma: "e2e-verify-word",
      translation: "验证词",
      form: "e2e-verify-word",
      sourceType: "video",
      sourceUrl: "https://www.youtube.com/watch?v=e2e-verify",
      timestampSec: 2,
      originalSentence: "Segunda frase de verificación e2e.",
      translatedSentence: "e2e 第二个验证句子。"
    })
  });
  check("vocab/add 重复加词 → 200", addRepeat.status, 200);
  check(
    "vocab/add 无 token → 401",
    (
      await call("/api/vocab/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lemma: "x", translation: "x", form: "x", sourceUrl: "x", timestampSec: 0, originalSentence: "x" })
      })
    ).status,
    401
  );
  const addPhrase = await call("/api/vocab/phrase/add", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      lemma: "e2e-verify-phrase",
      kind: "phrase",
      translationZh: "e2e 验证短语"
    })
  });
  check("phrase/add Bearer → 200", addPhrase.status, 200);
  check(
    "phrase/add 无 token → 401",
    (
      await call("/api/vocab/phrase/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lemma: "x", kind: "phrase" })
      })
    ).status,
    401
  );
  const phraseList = await call("/api/vocab/phrase/list?limit=5", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  check("phrase/list Bearer → 200", phraseList.status, 200);

  // ---- 4. 可选登录的接口 ----
  check(
    "字幕匿名可访问 → 200",
    (await call("/api/subtitle?v=12bbekXC7Zo&lang=es")).status,
    200
  );
  check(
    "字幕 Bearer → 200",
    (
      await call("/api/subtitle?v=12bbekXC7Zo&lang=es", {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ).status,
    200
  );
  const translated = await call("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ text: "hola" })
  });
  check("翻译 Bearer → 200", translated.status, 200);
  check("返回 translation", typeof translated.body?.translation === "string", true);

  // ---- 5. refresh 轮换 ----
  const refreshed = await call("/api/mobile/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  check("refresh 返回 200", refreshed.status, 200);
  check("拿到新 accessToken", Boolean(refreshed.body?.accessToken), true);
  check("拿到新 refreshToken", Boolean(refreshed.body?.refreshToken), true);

  // ---- 6. 旧 refreshToken 重放必须失败(rotation) ----
  const replay = await call("/api/mobile/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  check("旧 refreshToken 重放 → 401", replay.status, 401);
  check("错误码 INVALID_REFRESH_TOKEN", replay.body?.code, "INVALID_REFRESH_TOKEN");

  // ---- 7. 新 token 可继续用 ----
  const newToken = refreshed.body?.accessToken;
  const newRefresh = refreshed.body?.refreshToken;
  check(
    "新 accessToken 可用 → 200",
    (await call("/api/vocab/review", { headers: { Authorization: `Bearer ${newToken}` } })).status,
    200
  );

  // ---- 8. logout 吊销 ----
  check(
    "logout → 200",
    (
      await call("/api/mobile/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: newRefresh })
      })
    ).status,
    200
  );
  check(
    "注销后 refresh → 401",
    (
      await call("/api/mobile/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: newRefresh })
      })
    ).status,
    401
  );

  // ---- 汇总 ----
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} 通过${failed.length ? `,${failed.length} 失败` : ""}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("脚本异常:", error.message);
  process.exit(1);
});
