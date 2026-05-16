import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const migratedFiles = [
  "src/app/components/vocab/VocabAccordion.tsx",
  "src/app/watch/page.tsx",
  "src/app/watch/TranscriptPanel.tsx",
  "src/app/watch/LookupCard.tsx",
  "src/app/learn/page.tsx",
  "src/app/search/page.tsx"
];

test("WEB-011 exposes a shared EmptyState component with the required API", () => {
  const source = read("src/app/components/ui/EmptyState.tsx");

  assert.match(source, /type EmptyStateKind\s*=\s*"empty"\s*\|\s*"error"\s*\|\s*"loading-failed"/);
  assert.match(source, /type EmptyStateProps/);
  assert.match(source, /kind:\s*EmptyStateKind/);
  assert.match(source, /title:\s*string/);
  assert.match(source, /description\?:\s*string/);
  assert.match(source, /action\?:/);
  assert.match(source, /size\?:\s*"sm"\s*\|\s*"md"\s*\|\s*"lg"/);
  assert.match(source, /export default function EmptyState/);
  assert.match(source, /bg-brand-500/);
  assert.match(source, /rounded-card/);
});

test("WEB-011 migrates target screens to the shared EmptyState component", () => {
  for (const path of migratedFiles) {
    const source = read(path);

    assert.match(source, /@\/app\/components\/ui\/EmptyState/, path);
    assert.match(source, /<EmptyState\b/, path);
  }
});

test("WEB-011 removes the old hard-coded empty and error copy from target sources", () => {
  const forbidden = [
    "暂无字幕",
    "缺少视频参数",
    "暂不支持该词",
    "还没有遭遇过词汇",
    "没有找到匹配的视频"
  ];

  for (const path of migratedFiles) {
    const source = read(path);

    for (const phrase of forbidden) {
      assert.equal(source.includes(phrase), false, `${path} still contains ${phrase}`);
    }
  }
});

test("WEB-011 fix keeps no-subtitle state neutral and icon strokes consistent", () => {
  const transcriptPanel = read("src/app/watch/TranscriptPanel.tsx");
  const emptyState = read("src/app/components/ui/EmptyState.tsx");

  assert.match(transcriptPanel, /<EmptyState[\s\S]*kind="empty"[\s\S]*title=/);
  assert.doesNotMatch(transcriptPanel, /<EmptyState[\s\S]*kind="error"[\s\S]*title=/);
  assert.doesNotMatch(emptyState, /strokeWidth="[57]"/);
  assert.match(emptyState, /strokeWidth="3"/);
});
