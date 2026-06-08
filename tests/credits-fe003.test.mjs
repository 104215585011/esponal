import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("CREDITS-FE-003 adds a cost explanation section to the account credits page using ACTION_COST_MINOR", async () => {
  const pagePath = "src/app/account/credits/page.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);

  const pageSource = await readText(pagePath);
  assert.match(pageSource, /ACTION_COST_MINOR/);
  assert.match(pageSource, /toDisplay/);
  assert.match(pageSource, /配额消耗说明|閰嶉娑堣€楄鏄?/);
  assert.match(pageSource, /AI 对话|AI 瀵硅瘽/);
  assert.match(pageSource, /发音朗读|鍙戦煶鏈楄/);
  assert.match(pageSource, /查词\(AI 回落\)|鏌ヨ瘝\(AI 鍥炶惤\)/);
  assert.match(pageSource, /短语提取|鐭鎻愬彇/);
  assert.match(pageSource, /视频字幕解锁|瑙嗛瀛楀箷瑙ｉ攣/);
  assert.match(pageSource, /免费动作|鍏嶈垂鍔ㄤ綔/);
  assert.match(pageSource, /看缓存视频|鐪嬬紦瀛樿棰?/);
  assert.match(pageSource, /本地词典查词|鏈湴璇嶅吀鏌ヨ瘝/);
  assert.match(pageSource, /复习 \/ SRS|澶嶄範 \/ SRS/);
  assert.match(pageSource, /收藏\(限 50 词\)|鏀惰棌\(闄?50 璇?/);
  assert.match(pageSource, /重看已解锁字幕|閲嶇湅宸茶В閿佸瓧骞?/);
  assert.match(pageSource, /配额仅用于 AI 加工;费率以实际扣费为准,数值随版本可能调整。|閰嶉浠呯敤浜?AI 鍔犲伐;璐圭巼浠ュ疄闄呮墸璐逛负鍑?鏁板€奸殢鐗堟湰鍙兘璋冩暣銆?/);
  assert.match(pageSource, /CreditHistoryClient/);
});
