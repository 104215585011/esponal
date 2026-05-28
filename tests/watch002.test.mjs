import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WATCH-002 shows a passive next recommendation card when the player ends", async () => {
  const client = await readText("src/app/watch/WatchClient.tsx");

  assert.match(client, /PlayerState\?\.ENDED/);
  assert.match(client, /setVideoEnded\(true\)/);
  assert.match(client, /data-testid="watch-ended-next-card"/);
  assert.match(client, /fixed bottom-6 right-6/);
  assert.match(client, /relatedVideos\[0\]/);
  assert.match(client, /href=\{nextVideo \? `\/watch\?v=\$\{nextVideo\.id\}` : "\/watch"\}/);
  assert.doesNotMatch(client, /setTimeout\([^)]*watch\?v=|window\.location\.(href|assign|replace)|router\.push/);
});
