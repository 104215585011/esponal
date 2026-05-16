# INFRA-002 — 编码规范 lint + 仓库扫雷

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-16
**前置依赖**：无

---

## 背景

项目反复踩中文编码相关坑：
- `extension/lemma-dict.json` 660 条词形的中文翻译全是 `?`（编码丢失）
- `VocabAccordion.tsx` 第 7 行注释残留乱码 `閬亣` / `璺冲洖瑙嗛`
- `claude-progress.md` 多个会话章节有乱码字符（`Â` / `?` / `�`）
- 全仓库 LF / CRLF 混用，每次 git commit 都报 warning

这些都是「事后人工修」级别的问题。本 ticket 把扫描 + 拒绝写成 pre-commit + CI 检查，一次性把仓库内残留乱码清掉，未来同类污染进不来。

---

## 一、检查规则

### Rule 1：文件必须是 UTF-8（无 BOM）

- 工具：自己用 Node 写 `scripts/check-encoding.mjs`
- 实现：对每个 `*.ts | *.tsx | *.js | *.mjs | *.json | *.md` 文件用 `fs.readFileSync(path)` 拿 Buffer，调 `Buffer.isEncoding('utf8')` 不可靠，改用 `TextDecoder('utf-8', { fatal: true }).decode(buf)`，捕获异常即视为非 UTF-8
- BOM 检查：`buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF` → 拒绝（让人手动去 BOM 或脚本自动剥）

### Rule 2：中文文本不得含 mojibake 标志字符

- 在 `*.ts | *.tsx | *.md` 文件里搜索：
  - 连续 2+ 个 `?` 紧贴中文范围 `[一-鿿]` 字符
  - 字符 `�` (U+FFFD replacement character)
  - GBK→UTF-8 误解码典型字符：`鐪`、`璇`、`鎴`、`鏈`、`娆`、`閬`、`鐠`、`琛`等。维护一个黑名单 `MOJIBAKE_HINTS = ["鐪", "璇", "鎴", "鏈", "娆", "閬", "璺", "瑙", "嗛", "鐠"]`
- 命中即拒绝并打印文件+行号

### Rule 3：行结束符必须是 LF

- `git config core.autocrlf` 已经处理跨平台，但仓库已签入的文件有些是 CRLF
- 检查：`buf.includes(Buffer.from([0x0D, 0x0A]))` → 拒绝
- `.gitattributes` 加 `* text=auto eol=lf`，保证未来 checkout 一致

### Rule 4：JSON 文件可解析

- 对所有 `*.json` 跑 `JSON.parse`，失败拒绝
- 现成做法，半行代码

---

## 二、扫雷（一次性清理）

先把检查脚本跑一遍，列出所有违规文件。预期：

| 文件 | 问题 |
|---|---|
| `extension/lemma-dict.json` | meanings 全 `?`（已知历史问题，本 ticket 不修，加白名单跳过） |
| `claude-progress.md` 多处 | 乱码字符 |
| 一些 `*.tsx` 注释 | 残留乱码 |

策略：
- **能修的修**：脚本自动跑 `iconv -f GBK -t UTF-8`，肉眼复检；或人工删掉那些已经没意义的乱码注释
- **修不了的加白名单**：`scripts/check-encoding.mjs` 顶部维护 `ALLOWLIST = ["extension/lemma-dict.json"]`，记录原因（lemma-dict 的修复见独立 ticket VOCAB-005，待写）
- 修完后再跑一次，确认违规数 = 0

---

## 三、CI 接入

### pre-commit 钩子

用 `husky` + `lint-staged`：

```json
// package.json
{
  "scripts": {
    "lint:encoding": "node scripts/check-encoding.mjs"
  },
  "lint-staged": {
    "*.{ts,tsx,js,mjs,json,md}": "node scripts/check-encoding.mjs --files"
  }
}
```

`scripts/check-encoding.mjs` 支持两种模式：
- 无参数 → 全仓库扫描
- `--files file1 file2 ...` → 只检查指定文件（用于 lint-staged）

### CI（如果有 INFRA-004 CI 流水线）

`npm run lint:encoding` 加进 PR check。本 ticket 不依赖 INFRA-004——pre-commit 已经能挡 90% 问题。

---

## 四、文件清单

**新增**：
- `scripts/check-encoding.mjs`
- `.gitattributes`（`* text=auto eol=lf`）
- `tests/infra002.test.mjs`

**修改**：
- `package.json`：加 `lint:encoding` + `husky` + `lint-staged` 依赖与 scripts
- `.husky/pre-commit`：调用 `npx lint-staged`
- 各违规源文件：清理乱码（具体清单跑完脚本才能定）

---

## 五、测试断言

- `scripts/check-encoding.mjs` 存在
- 全仓库跑一遍 `node scripts/check-encoding.mjs` 退出码 0
- `.gitattributes` 包含 `eol=lf`
- 给一个故意带 mojibake 字符串的临时文件，脚本退出码 ≠ 0
- 给一个 UTF-16 编码的临时文件，脚本退出码 ≠ 0
- 给一个 CRLF 文件，脚本退出码 ≠ 0

---

## 六、验收（Codex2 用）

1. `npm run lint:encoding` 退出码 0
2. 故意 `echo "\xff\xfe..." > x.ts`（非 UTF-8），跑脚本失败，删掉
3. `git commit` 提交一个带 `??` 的中文文件应被 pre-commit 拒绝
4. 仓库内不再有任何 LF/CRLF git warning（`git status` 干净）
5. `npm test` 通过
6. `npm run build` 通过

---

## 七、不在本 ticket 范围内

- 重新生成 `lemma-dict.json` 的真实中文翻译（→ VOCAB-005，新 ticket，可走 GLM-5 离线批量生成）
- markdown 内容质量检查（拼写、链接死链）
- ESLint / Prettier 配置（已存在，独立配置）
- TypeScript strict 模式（独立工作量）
