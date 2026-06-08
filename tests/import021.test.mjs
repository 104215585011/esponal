import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-4 adds a YouTube URL parser for supported URL shapes", async () => {
  const parserPath = "src/lib/import/parse-video-url.ts";
  assert.equal(existsSync(parserPath), true, `${parserPath} missing`);

  const { parseYouTubeVideoId } = await import("../src/lib/import/parse-video-url.ts");

  assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=A0yzRIuKYUw"), "A0yzRIuKYUw");
  assert.equal(parseYouTubeVideoId("https://youtu.be/A0yzRIuKYUw?t=12"), "A0yzRIuKYUw");
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/shorts/A0yzRIuKYUw?feature=share"), "A0yzRIuKYUw");
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/embed/A0yzRIuKYUw"), "A0yzRIuKYUw");
  assert.equal(parseYouTubeVideoId("A0yzRIuKYUw"), "A0yzRIuKYUw");
  assert.equal(parseYouTubeVideoId("https://example.com/watch?v=A0yzRIuKYUw"), null);
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=bad"), null);
});

test("IMPORT-4 exposes a server route that returns a watch redirect for valid YouTube URLs", async () => {
  const routePath = "src/app/api/import/url/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const source = await read(routePath);
  assert.match(source, /export async function POST/);
  assert.match(source, /parseYouTubeVideoId/);
  assert.match(source, /redirect:\s*`\/watch\?v=\$\{videoId\}`/);
  assert.match(source, /status:\s*400/);
  assert.match(source, /unsupported_url/);
});
