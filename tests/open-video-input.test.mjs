import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseYouTubeStartSeconds } from "../src/lib/import/parse-video-url.ts";

const readText = (path) => readFile(path, "utf8");

test("start-time parser handles compact and bare-second timestamps", () => {
  assert.equal(parseYouTubeStartSeconds("https://youtu.be/abcDEF12345?t=1h2m3s"), 3723);
  assert.equal(parseYouTubeStartSeconds("https://www.youtube.com/watch?v=abcDEF12345&t=90"), 90);
  assert.equal(parseYouTubeStartSeconds("https://www.youtube.com/watch?v=abcDEF12345&t=2m30s"), 150);
  assert.equal(parseYouTubeStartSeconds("https://www.youtube.com/watch?v=abcDEF12345"), null);
  assert.equal(parseYouTubeStartSeconds("https://example.com/watch?v=abcDEF12345&t=90"), null);
  assert.equal(parseYouTubeStartSeconds("not a url"), null);
});

test("open-video input reuses the shared parser and pushes to /watch", async () => {
  const component = await readText("src/app/components/web/OpenVideoInput.tsx");

  assert.match(component, /parseYouTubeVideoId/);
  assert.match(component, /parseYouTubeStartSeconds/);
  assert.match(component, /router\.push\(`\/watch\?v=\$\{videoId\}\$\{start\}`\)/);
  assert.match(component, /&t=\$\{startSeconds\}s/);
  assert.match(component, /无法识别这个链接/);
});

test("watch page forwards the start-time hint into the player", async () => {
  const page = await readText("src/app/watch/page.tsx");
  const client = await readText("src/app/watch/WatchClient.tsx");
  const desktop = await readText("src/app/watch/WatchDesktopLayout.tsx");
  const mobile = await readText("src/app/watch/WatchMobileLayout.tsx");

  assert.match(page, /t\?: string/);
  assert.match(page, /startSeconds=\{startSeconds\}/);
  assert.match(client, /startSeconds\?: number/);
  assert.match(desktop, /&start=\$\{startSeconds\}/);
  assert.match(mobile, /&start=\$\{startSeconds\}/);
});

test("watch page surfaces the paste-a-link entry point on the channel wall", async () => {
  const page = await readText("src/app/watch/page.tsx");

  assert.match(page, /OpenVideoInput/);
});
