// Timestamp: 2026-05-28 16:44
import assert from "node:assert/strict";
import test from "node:test";

import { tryConjugateVerb } from "../src/lib/conjugate.ts";

const EXPECTED = {
  hablar: {
    participio: "hablado",
    gerundio: "hablando",
    vosotrosImperativo: "hablad",
    perfecto: {
      yo: "he hablado",
      tu: "has hablado",
      el: "ha hablado",
      nosotros: "hemos hablado",
      vosotros: "habéis hablado",
      ellos: "han hablado"
    }
  },
  comer: {
    participio: "comido",
    gerundio: "comiendo",
    vosotrosImperativo: "comed",
    perfecto: {
      yo: "he comido",
      tu: "has comido",
      el: "ha comido",
      nosotros: "hemos comido",
      vosotros: "habéis comido",
      ellos: "han comido"
    }
  },
  vivir: {
    participio: "vivido",
    gerundio: "viviendo",
    vosotrosImperativo: "vivid",
    perfecto: {
      yo: "he vivido",
      tu: "has vivido",
      el: "ha vivido",
      nosotros: "hemos vivido",
      vosotros: "habéis vivido",
      ellos: "han vivido"
    }
  },
  ser: {
    participio: "sido",
    gerundio: "siendo",
    vosotrosImperativo: "sed",
    perfecto: {
      yo: "he sido",
      tu: "has sido",
      el: "ha sido",
      nosotros: "hemos sido",
      vosotros: "habéis sido",
      ellos: "han sido"
    }
  },
  tener: {
    participio: "tenido",
    gerundio: "teniendo",
    vosotrosImperativo: "tened",
    perfecto: {
      yo: "he tenido",
      tu: "has tenido",
      el: "ha tenido",
      nosotros: "hemos tenido",
      vosotros: "habéis tenido",
      ellos: "han tenido"
    }
  }
};

test("LEX-001 Phase 2 adds participio, gerundio, and preteritoPerfectoCompuesto", () => {
  for (const [lemma, expected] of Object.entries(EXPECTED)) {
    const conjugations = tryConjugateVerb(lemma);
    assert.ok(conjugations, `${lemma} should conjugate`);
    assert.equal(conjugations.participio, expected.participio);
    assert.equal(conjugations.gerundio, expected.gerundio);
    assert.equal(conjugations.imperativo?.vosotros, expected.vosotrosImperativo);
    assert.deepEqual(conjugations.preteritoPerfectoCompuesto, expected.perfecto);
  }
});
