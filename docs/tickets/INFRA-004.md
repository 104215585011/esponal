# INFRA-004 — CI 流水线（GitHub Actions）

**优先级**：P2 | **负责人**：Codex1 | **日期**：2026-05-16
**前置依赖**：无（INFRA-002 / INFRA-003 完成后会自动接进来）

---

## 背景

当前 PR 合并完全靠本地 `npm test && npm run build`，没人卡：
- 偶尔忘跑测试就推
- 测试在本机过、CI 网络/版本环境下挂了发现不了
- Vercel deploy preview 跑通了不等于代码质量过关
- Codex2 QA 只在 ticket 完工时跑一次，平时改动没保护

本 ticket 加 GitHub Actions：每个 PR 自动跑测试 + build + （未来的）lint + E2E，全绿才允许 merge。

---

## 一、Workflow 设计

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          # build 不需要真实密钥，但需要变量存在以免 prisma 报错
          DATABASE_URL: postgresql://placeholder@localhost/placeholder
          NEXTAUTH_SECRET: ci-placeholder-secret
          NEXTAUTH_URL: http://localhost:3000

  lint-encoding:
    # 只在 INFRA-002 合并后启用
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/check-encoding.mjs
        if: ${{ hashFiles('scripts/check-encoding.mjs') != '' }}

  e2e:
    # 只在 INFRA-003 合并后启用
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports: [5432:5432]
        options: --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
        env: { DATABASE_URL: postgresql://postgres:postgres@localhost/postgres }
      - run: npm run seed:e2e
        env: { DATABASE_URL: postgresql://postgres:postgres@localhost/postgres }
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/postgres
          NEXTAUTH_SECRET: ci-secret
          NEXTAUTH_URL: http://localhost:3000
          E2E_USER_EMAIL: e2e@esponal.test
          E2E_USER_PASSWORD: test-e2e-password-2026
          E2E_TEST_VIDEO_ID: dQw4w9WgXcQ
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

### 注意点
- `npm ci` 比 `npm install` 严格，保证 lockfile 一致
- `actions/setup-node` 的 cache: npm 命中后 `npm ci` 只需 ~10s
- build 步骤吞掉真实密钥（用 placeholder），因为只验证编译通过
- E2E job 起一个 PostgreSQL service，跑 migrate 再跑测试

---

## 二、Branch Protection

GitHub repo settings → branch protection rules → `main`：
- Require status checks: `test` 必过
- `lint-encoding` 和 `e2e`：先设为非必需，等稳定 1-2 周后变必需
- Require PR review：作为单人项目暂不开

**本 ticket 不通过 API 改 GitHub 设置**——只交付 workflow 文件 + 在 ticket 里说明手动开启步骤。

---

## 三、本地预运行

加 `package.json`：
```json
{
  "scripts": {
    "ci:local": "npm test && npm run build"
  }
}
```

提交前可以 `npm run ci:local` 一把过，避免 push 后才发现红。

---

## 四、文件清单

**新增**：
- `.github/workflows/ci.yml`
- `tests/infra004.test.mjs`

**修改**：
- `package.json`：加 `ci:local` script

---

## 五、测试断言

- `.github/workflows/ci.yml` 存在
- workflow 文件 YAML 合法（用 `yaml` 解析不抛异常）
- 包含 `npm test` 步骤
- 包含 `npm run build` 步骤
- `on:` 包含 `pull_request` 和 `push: main`

---

## 六、验收（Codex2 用）

1. workflow 文件 YAML 合法
2. 推一个 PR 触发 CI，`test` job 全绿
3. 故意改一个测试让它失败，推 PR，`test` job 红 + PR 显示 ❌
4. `npm run ci:local` 本地能跑通
5. README 或 session-handoff 写好"如何手动启用 branch protection"步骤

---

## 七、不在本 ticket 范围内

- 性能基线 / Lighthouse CI
- 自动发布到 Vercel（Vercel 已经自己装了 GitHub App）
- Slack / Discord 通知集成
- Renovate / Dependabot 自动升级
- Branch protection 的 API 自动化配置

---

## 注意事项

- GitHub Actions 免费额度 public repo 无限、private repo 2000 min/month，单 PR ~3min，足够
- `npm ci` 失败常见原因是 `package.json` 和 `package-lock.json` 不同步，本地一定要 commit lockfile
- E2E job 跑得慢且消耗 GLM-5 quota，可以加 `if: contains(github.event.pull_request.labels.*.name, 'e2e')` 让默认不跑，给 PR 打 label 才跑
