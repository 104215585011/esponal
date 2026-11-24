// Timestamp: 2026-11-24 11:02
import test from "node:test";
import assert from "node:assert/strict";
import {
  alignSentencesToCues,
  needsAiSentenceSegmentation,
  segmentCuesByPunctuation,
  segmentSubtitleCuesToSentences
} from "../src/lib/subtitle-sentences.ts";

test("segmentCuesByPunctuation splits mid-cue sentence boundaries and merges fragments cleanly", () => {
  const raw = [
    { start: 0.16, dur: 2.04, text: "In this lesson, we will listen to one" },
    { start: 2.2, dur: 2.36, text: "simple story in Spanish. It is perfect" },
    { start: 4.56, dur: 2.08, text: "for all beginners. We will start by" },
    { start: 6.64, dur: 2.48, text: "listening to the text with subtitles." }
  ];

  const out = segmentCuesByPunctuation(raw, "es");
  assert.deepEqual(
    out.map((c) => c.text),
    [
      "In this lesson, we will listen to one simple story in Spanish.",
      "It is perfect for all beginners.",
      "We will start by listening to the text with subtitles."
    ]
  );
  assert.ok(out[0].start === 0.16);
  assert.ok(out[1].start > 2.2 && out[1].start < 4.56);
  assert.ok(out[2].start > 4.56 && out[2].start < 6.64);
  for (let i = 0; i < out.length - 1; i += 1) {
    assert.ok(out[i].start + out[i].dur <= out[i + 1].start + 0.002);
  }
});

test("segmentCuesByPunctuation does not split on abbreviations or decimal numbers", () => {
  const raw = [
    { start: 0, dur: 3, text: "El Sr. García llegó a las 3.5 horas" },
    { start: 3, dur: 2, text: "con el Dr. López. ¡Qué puntual!" }
  ];

  const out = segmentCuesByPunctuation(raw, "es");
  assert.deepEqual(
    out.map((c) => c.text),
    ["El Sr. García llegó a las 3.5 horas con el Dr. López.", "¡Qué puntual!"]
  );
});

test("needsAiSentenceSegmentation flags unpunctuated ASR transcripts and skips well-punctuated ones", () => {
  const punctuated = [
    { start: 0, dur: 3, text: "Hola amigos, hoy vamos a cocinar pasta." },
    { start: 3, dur: 3, text: "Primero hervimos el agua en una olla grande." },
    { start: 6, dur: 3, text: "Después añadimos un poco de sal." }
  ];
  assert.equal(needsAiSentenceSegmentation(punctuated, "es"), false);

  const unpunctuated = [
    { start: 0, dur: 4, text: "hola amigos hoy vamos a hablar sobre mi rutina diaria en madrid" },
    { start: 4, dur: 4, text: "normalmente me levanto a las siete de la mañana y preparo café" },
    { start: 8, dur: 4, text: "luego salgo a caminar un rato por el parque antes de trabajar" },
    { start: 12, dur: 4, text: "cuando vuelvo a casa preparo el desayuno y reviso mis correos" }
  ];
  assert.equal(needsAiSentenceSegmentation(unpunctuated, "es"), true);
});

test("alignSentencesToCues aligns AI-segmented sentences back onto spoken word timestamps and rejects hallucinations", () => {
  const chunk = [
    { start: 0, dur: 4, text: "hola amigos hoy vamos a hablar sobre mi rutina diaria" },
    { start: 4, dur: 4, text: "normalmente me levanto a las siete y tomo café" }
  ];

  const aligned = alignSentencesToCues(
    [
      "¡Hola, amigos! Hoy vamos a hablar sobre mi rutina diaria.",
      "Normalmente me levanto a las siete y tomo café."
    ],
    chunk,
    "es"
  );
  assert.ok(aligned);
  assert.equal(aligned.length, 2);
  assert.equal(aligned[0].start, 0);
  assert.ok(aligned[1].start >= 3.5 && aligned[1].start <= 4.5);

  // Hallucinated / heavily truncated output should be rejected (returns null)
  const truncated = alignSentencesToCues(["Resumen corto."], chunk, "es");
  assert.equal(truncated, null);
});

test("segmentSubtitleCuesToSentences splits Spanish multi-sentence cues accurately", async () => {
  const raw = [
    { start: 0, dur: 3, text: "¿Te gusta, Pablo? Sí, me gusta. Me" },
    { start: 3, dur: 3, text: "gusta. ¿No te cae bien? Sí que me cae" },
    { start: 6, dur: 2, text: "bien." }
  ];
  const res = await segmentSubtitleCuesToSentences(raw, "es", { allowAi: false });
  assert.equal(res.mode, "punctuation");
  assert.deepEqual(
    res.cues.map((c) => c.text),
    ["¿Te gusta, Pablo?", "Sí, me gusta.", "Me gusta.", "¿No te cae bien?", "Sí que me cae bien."]
  );
});
