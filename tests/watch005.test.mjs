import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WATCH-005: YouTube iframe parameters updated", async () => {
  const watchClientPath = "src/app/watch/WatchClient.tsx";
  assert.ok(existsSync(watchClientPath), `${watchClientPath} should exist`);

  const clientText = await readText(watchClientPath);

  // iframe src should have cc_load_policy=0 and no hl/cc_lang_pref
  assert.match(clientText, /cc_load_policy=0/);
  assert.doesNotMatch(clientText, /cc_load_policy=1/);
  assert.doesNotMatch(clientText, /hl=es/);
  assert.doesNotMatch(clientText, /cc_lang_pref=es/);
});

test("Watch Layout Redesign: Back to Current Position button locations", async () => {
  const watchClientText = await readText("src/app/watch/WatchClient.tsx");
  const transcriptPanelText = await readText("src/app/watch/TranscriptPanel.tsx");

  // Removed from WatchClient.tsx
  assert.doesNotMatch(watchClientText, /↺ 回到当前位置/);

  // Exists in TranscriptPanel.tsx at bottom center
  assert.match(transcriptPanelText, /↺ 回到当前位置/);
  assert.match(transcriptPanelText, /absolute bottom-6 left-1\/2 -translate-x-1\/2 z-20/);
});

test("Watch Layout Redesign: TranscriptPanel sentence grouping and styling", async () => {
  const transcriptPanelText = await readText("src/app/watch/TranscriptPanel.tsx");

  // Divider lines: border-b border-zinc-100 dark:border-zinc-900/60
  assert.match(transcriptPanelText, /border-b border-zinc-100 dark:border-zinc-900\/60/);
  // Active sentence styling: bg-zinc-50/50 dark:bg-zinc-900/20 border-l-[3px] border-l-brand-500 pl-[21px]
  assert.match(transcriptPanelText, /bg-zinc-50\/50 dark:bg-zinc-900\/20 border-l-\[3px\] border-l-brand-500 pl-\[21px\]/);
  // Inactive sentence styling: hover:bg-zinc-50/20 dark:hover:bg-zinc-900/5 border-l-[3px] border-l-transparent pl-[21px]
  assert.match(transcriptPanelText, /hover:bg-zinc-50\/20 dark:hover:bg-zinc-900\/5 border-l-\[3px\] border-l-transparent/);
});

test("Watch Layout Redesign: SubtitlePanel subtitle overlay container", async () => {
  const subtitlePanelText = await readText("src/app/watch/SubtitlePanel.tsx");

  // Raised to bottom-12
  assert.match(subtitlePanelText, /absolute bottom-12 left-1\/2 -translate-x-1\/2 z-30/);
  // Translucent backdrop border px-5 py-3 rounded-2xl shadow-hero
  assert.match(subtitlePanelText, /bg-black\/65 backdrop-blur-md border border-white\/10 px-5 py-3 rounded-2xl shadow-hero/);
});

test("Watch Layout Redesign: transcript translation fallback is not mojibake", async () => {
  const transcriptPanelText = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.doesNotMatch(transcriptPanelText, /鈥\?|閳\?/);
  assert.match(transcriptPanelText, /translations\[sentence\.startIndex\] \?\? ""/);
});

test("Watch Layout Redesign: new watch styles use standard Tailwind zinc steps", async () => {
  const watchFiles = await readdir("src/app/watch", { recursive: true });
  const invalidZincSteps = /zinc-(?:150|355|450|550|650)\b/;

  for (const file of watchFiles) {
    if (!file.endsWith(".tsx")) continue;
    const path = `src/app/watch/${file}`;
    const source = await readText(path);
    assert.doesNotMatch(source, invalidZincSteps, `${path} should not use non-standard zinc steps`);
  }
});

test("Watch Layout: layout files do not use invalid tailwind class h-4.5/w-4.5", async () => {
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");
  const desktopLayout = await readText("src/app/watch/WatchDesktopLayout.tsx");

  assert.doesNotMatch(mobileLayout, /\b[hw]-4\.5\b/);
  assert.doesNotMatch(desktopLayout, /\b[hw]-4\.5\b/);
});

test("Watch Layout: WatchMobileLayout implements a collapsible volume slider", async () => {
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");

  assert.match(mobileLayout, /isVolumeOpen/);
  assert.match(mobileLayout, /isVolumeOpen\s*\?\s*"w-12 opacity-100 mr-1"\s*:\s*"w-0 opacity-0"/);
});

test("Watch mobile layout suppresses native YouTube chrome without changing desktop iframe", async () => {
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");
  const desktopLayout = await readText("src/app/watch/WatchDesktopLayout.tsx");

  assert.match(mobileLayout, /controls=0/);
  assert.match(mobileLayout, /disablekb=1/);
  assert.match(mobileLayout, /playsinline=1/);
  assert.match(mobileLayout, /iv_load_policy=3/);
  assert.match(mobileLayout, /modestbranding=1/);
  assert.match(mobileLayout, /pointer-events-none/);
  assert.match(mobileLayout, /data-testid="mobile-youtube-chrome-shield"/);
  assert.match(mobileLayout, /const shouldCoverYouTubeChrome = shouldBlockYouTubeChrome \|\| showControls \|\| !isPlaying;/);
  assert.match(mobileLayout, /shouldCoverYouTubeChrome\s*\?\s*"opacity-100 bg-zinc-950"/);

  assert.doesNotMatch(desktopLayout, /controls=0/);
  assert.doesNotMatch(desktopLayout, /disablekb=1/);
  assert.doesNotMatch(desktopLayout, /data-testid="mobile-youtube-chrome-shield"/);
});

test("Watch mobile layout covers paused YouTube recommendations with an opaque app layer", async () => {
  const clientText = await readText("src/app/watch/WatchClient.tsx");
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");

  assert.match(clientText, /const \[playerState, setPlayerState\] = useState<number \| null>\(null\)/);
  assert.match(clientText, /setPlayerState\(event\.data\)/);
  assert.match(clientText, /playerState,/);
  assert.match(mobileLayout, /data-testid="mobile-youtube-chrome-shield"/);
  assert.match(mobileLayout, /playerState: number \| null/);
  assert.match(mobileLayout, /const shouldBlockYouTubeChrome = playerState === 2 \|\| playerState === 0;/);
  assert.match(mobileLayout, /shouldBlockYouTubeChrome \|\| showControls \|\| !isPlaying/);
  assert.match(mobileLayout, /data-testid="mobile-youtube-top-chrome-mask"/);
  assert.match(mobileLayout, /data-testid="mobile-youtube-bottom-chrome-mask"/);
  assert.match(mobileLayout, /h-28 bg-gradient-to-t from-black/);
  assert.match(mobileLayout, /shouldCoverYouTubeChrome\s*\?\s*"opacity-100 bg-zinc-950"/);
  assert.match(mobileLayout, /isFullscreen \? "fixed inset-0 z-\[80\]"/);
  assert.match(mobileLayout, /isFullscreen \? "w-full flex-1 bg-black relative z-40 flex items-center justify-center"/);
  assert.match(mobileLayout, /isFullscreen \? "hidden" : "flex-1 flex flex-col min-h-0 bg-zinc-950"/);
});

test("Watch fullscreen logs mobile runtime diagnostics and falls back when native fullscreen fails", async () => {
  const clientText = await readText("src/app/watch/WatchClient.tsx");
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");

  assert.match(clientText, /fullscreenEnabled/);
  assert.match(clientText, /navigator\.userAgent/);
  assert.match(clientText, /Mobile fullscreen request failed/);
  assert.match(clientText, /Mobile fullscreen is unavailable/);
  assert.match(clientText, /setIsFullscreen\(true\)/);
  assert.match(clientText, /isMobile/);
  assert.match(mobileLayout, /ref=\{playerContainerRef\}\s*className=\{`flex h-\[100dvh\]/s);
  assert.match(mobileLayout, /onClick=\{isFullscreen \? toggleFullscreen : undefined\}/);
});

test("Watch player setup waits for responsive layout iframe before binding YouTube API", async () => {
  const clientText = await readText("src/app/watch/WatchClient.tsx");

  assert.match(clientText, /if \(isMobile === null\) return;/);
  assert.match(clientText, /document\.getElementById\(PLAYER_IFRAME_ID\)/);
  assert.match(clientText, /if \(!playerIframe\) return;/);
  assert.match(clientText, /\}, \[videoId, isMobile, sendYouTubeCommand\]\);/);
});

test("Watch mobile play path is isolated from desktop and has iframe command fallback", async () => {
  const clientText = await readText("src/app/watch/WatchClient.tsx");
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");
  const desktopLayout = await readText("src/app/watch/WatchDesktopLayout.tsx");

  assert.match(clientText, /const handleMobilePlayPause = useCallback/);
  assert.match(clientText, /pendingMobilePlayRef/);
  assert.match(clientText, /postMessage\(\s*JSON\.stringify\(\{ event: "command", func: command/s);
  assert.match(clientText, /handlePlayPause=\{handleMobilePlayPause\}/);
  assert.match(clientText, /<WatchDesktopLayout \{\.\.\.sharedProps\} \/>/);
  assert.doesNotMatch(desktopLayout, /handleMobilePlayPause|pendingMobilePlayRef|postMessage/);
  assert.match(mobileLayout, /handlePlayPause: \(\) => void/);
});

test("MOBILE-001 keeps only transcript and related tabs on mobile", async () => {
  const mobileLayout = await readText("src/app/watch/WatchMobileLayout.tsx");

  assert.match(mobileLayout, /\(\["transcript", "related"\] as const\)/);
  assert.doesNotMatch(mobileLayout, /"subtitle"/);
  assert.match(mobileLayout, /tab === "transcript" && "转写"/);
  assert.match(mobileLayout, /tab === "related" && "推荐"/);
});

test("MOBILE-001 sentence mode uses word ordinals for active-token highlighting", async () => {
  const transcriptPanel = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(transcriptPanel, /const activeWordOrdinal =\s*cueIsActive && isMobile \? getActiveWordOrdinal\(tokens, cue, currentTimeSec\) : -1;/);
  assert.match(transcriptPanel, /renderedWordOrdinal === activeWordOrdinal/);
  assert.doesNotMatch(transcriptPanel, /isMobile && cueIsActive && tokenIndex === activeWordTokenIndex/);
});
