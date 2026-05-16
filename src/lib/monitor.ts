import * as Sentry from "@sentry/nextjs";

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function setMonitoringUser(userId: string | null | undefined) {
  if (!userId) return;

  Sentry.setUser({ id: userId });
}

export function reportTranslateFailure(text: string, error: unknown) {
  Sentry.captureException(normalizeError(error), {
    tags: { feature: "translate" },
    extra: {
      textLength: text.length,
      textPreview: text.slice(0, 40)
    }
  });
}

export function reportLookupFailure(word: string, error: unknown) {
  Sentry.captureException(normalizeError(error), {
    tags: { feature: "lookup" },
    extra: { word }
  });
}

export function reportSubtitleFailure(videoId: string, error: unknown) {
  Sentry.captureException(normalizeError(error), {
    tags: { feature: "subtitle" },
    extra: { videoId }
  });
}
