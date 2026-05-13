export function buildVideoJumpHref(sourceUrl: string, timestampSec: number) {
  const safeTimestamp = Math.max(0, Math.floor(timestampSec));

  return sourceUrl.includes("?")
    ? `${sourceUrl}&t=${safeTimestamp}`
    : `${sourceUrl}?t=${safeTimestamp}`;
}
