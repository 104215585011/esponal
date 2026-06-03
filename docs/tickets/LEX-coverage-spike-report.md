# LEX Coverage Spike Report

**Time**: 2026-06-03 17:25  
**Runner**: Codex1  
**Scope**: Directional Wiktionary coverage measurement for the 15k Spanish lemma candidate set and the existing 3,957 skipped subset. No production code changed.

## Inputs

- Main denominator: `data/wordlist-b1-candidates.csv`
  - 15,000 rows, 15,000 unique lemmas
  - Columns: `lemma,freq_rank,raw_freq,source_forms,source_count`
  - Frequency rank range: 15 to 21,927
- Current skipped subset: `data/lexicon-b1-skipped.json`
  - 3,957 skipped lemmas
  - All 3,957 are present in the 15k wordlist
- ES->EN source: Kaikki Spanish postprocessed JSONL
  - URL: `https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl`
  - HEAD `Content-Length`: 925,689,125 bytes, about 882.8 MiB
  - Caveat: Kaikki marks this postprocessed download deprecated; acceptable for directional spike only.
- ES->Chinese source: Kaikki Chinese Wiktionary raw gzip
  - URL: `https://kaikki.org/dictionary/downloads/zh/zh-extract.jsonl.gz`
  - HEAD `Content-Length`: 221,579,352 bytes, about 211.3 MiB
  - Filter: `lang_code === "es"`

## Method

- Streamed JSONL parsing. The 882 MiB Spanish dump was not saved locally.
- The zh gzip was temporarily saved as `.tmp-zh-extract.jsonl.gz` because PowerShell corrupts binary gzip data when piping; it was parsed with Node streams and must not be committed.
- Coverage is exact match on `entry.word === lemma`.
- Two coverage levels:
  - `any`: at least one Wiktionary entry exists for the target word.
  - `strong`: at least one matched entry has a non-`form-of` gloss. Form-only entries are useful for morphology, but not enough for a full dictionary card.

## Coverage By Frequency Bucket

| Bucket | EN any | EN strong | ZH any | ZH strong | EN/ZH union any | EN/ZH union strong | neither any |
|---|---:|---:|---:|---:|---:|---:|---:|
| top1k | 708 (70.80%) | 644 (64.40%) | 729 (72.90%) | 696 (69.60%) | 840 (84.00%) | 762 (76.20%) | 160 (16.00%) |
| top3k | 1,985 (66.17%) | 1,743 (58.10%) | 1,980 (66.00%) | 1,836 (61.20%) | 2,367 (78.90%) | 2,053 (68.43%) | 633 (21.10%) |
| top5k | 3,144 (62.88%) | 2,690 (53.80%) | 3,078 (61.56%) | 2,815 (56.30%) | 3,774 (75.48%) | 3,188 (63.76%) | 1,226 (24.52%) |
| top10k | 5,885 (58.85%) | 4,833 (48.33%) | 5,538 (55.38%) | 4,931 (49.31%) | 7,120 (71.20%) | 5,763 (57.63%) | 2,880 (28.80%) |
| top15k | 8,333 (55.55%) | 6,647 (44.31%) | 7,628 (50.85%) | 6,632 (44.21%) | 10,150 (67.67%) | 7,970 (53.13%) | 4,850 (32.33%) |

## Existing 3,957 Skipped Subset

| Metric | Count | Percent |
|---|---:|---:|
| EN any | 1,170 | 29.57% |
| EN strong | 892 | 22.54% |
| ZH any | 601 | 15.19% |
| ZH strong | 479 | 12.11% |
| EN and ZH both any | 487 | 12.31% |
| EN/ZH union any | 1,284 | 32.45% |
| EN/ZH union strong | 983 | 24.84% |
| neither any | 2,673 | 67.55% |
| neither strong | 2,974 | 75.16% |

## Field Quality

| Source / set | Hits | Strong among hits | Form-only among hits | IPA among hits | Forms among hits | Examples among hits | Gloss among hits |
|---|---:|---:|---:|---:|---:|---:|---:|
| EN 15k | 8,333 | 6,647 (79.77%) | 1,686 (20.23%) | 6,970 (83.64%) | 6,033 (72.40%) | 1,614 (19.37%) | 8,333 (100.00%) |
| ZH 15k | 7,628 | 6,632 (86.94%) | 994 (13.03%) | 1,905 (24.97%) | 1,661 (21.78%) | 266 (3.49%) | 7,626 (99.97%) |
| EN skipped | 1,170 | 892 (76.24%) | 278 (23.76%) | 886 (75.73%) | 513 (43.85%) | 142 (12.14%) | 1,170 (100.00%) |
| ZH skipped | 601 | 479 (79.70%) | 121 (20.13%) | 231 (38.44%) | 127 (21.13%) | 20 (3.33%) | 600 (99.83%) |

ZH direct coverage check: 7,625 / 7,628 ZH hits have CJK characters in sampled glosses (99.96%); 6,631 / 6,632 ZH strong hits have CJK glosses (99.98%). So direct ZH coverage is effectively real Chinese definitions, not just empty entries.

## Skipped Reason Breakdown

Top skipped reason buckets and how many the EN/ZH union can cover:

| Skipped reason bucket | Total | Union any | Union strong |
|---|---:|---:|---:|
| proper noun | 1,898 | 477 | 472 |
| english/foreign | 907 | 199 | 172 |
| morphology/form issue | 547 | 409 | 172 |
| not spanish | 409 | 70 | 61 |
| fetch failed | 108 | 84 | 68 |
| acronym | 12 | 9 | 9 |
| outside target CEFR: C2 | 10 | 9 | 7 |
| loanword | 7 | 5 | 3 |

Interpretation: the raw skipped count is heavily polluted by proper names and English/foreign tokens. The most useful Wiktionary rescue lanes are `fetch failed` and `morphology/form issue`; strong dictionary-card coverage is much lower for morphology than any/form coverage because many hits are form-only.

## Gap Samples

Neither EN nor ZH has an exact `any` hit among top-ranked words:

`niños`, `última`, `única`, `dólares`, `habría`, `estará`, `murió`, `john`, `deberíamos`, `mía`, `jack`, `haría`, `diré`, `habrá`, `hará`, `podríamos`, `estaré`, `cállate`, `daño`, `the`, `dejó`, `sam`, `estábamos`, `estaría`, `próxima`, `mató`, `tenías`, `llegó`, `creí`, `quédate`, `joe`, `michael`, `frank`, `charlie`, `tendrá`, `tom`, `george`, `hacía`, `estés`, `tendrás`

Skipped subset neither EN nor ZH exact `any` hit:

`john`, `jack`, `the`, `sam`, `joe`, `michael`, `frank`, `charlie`, `tom`, `george`, `mike`, `peter`, `paul`, `ben`, `james`, `max`, `harry`, `mary`, `you`, `bill`, `jimmy`, `jim`, `danny`, `nick`, `alex`, `steve`, `sarah`, `jane`, `tommy`, `ray`, `billy`, `johnny`, `cálmate`, `eddie`, `mark`, `sentí`, `robert`, `chris`, `will`, `ryan`

## Decision Readout

- Direct ZH Wiktionary is useful but not high enough to retire translation/AI alone: 50.85% `any` and 44.21% `strong` on the full 15k; only 15.19% `any` and 12.11% `strong` on current skipped.
- EN Wiktionary helps more for existing skipped, but still only 29.57% `any` and 22.54% `strong`.
- Combined Wiktionary import would cover about two thirds of the 15k by exact word match (`67.67% any`) but only about one quarter of current skipped with strong lexical entries (`24.84% strong`).
- The current skipped set is not a clean "real Spanish missing words" set. It is dominated by proper names, English/foreign tokens, and form/morphology issues. Architecture should split those lanes before deciding how much AI fallback is needed.

Recommended architecture direction:

1. Import Wiktionary as authoritative base, but do not expect it to fill all current holes.
2. Treat ZH Wiktionary as a high-trust native Chinese source when available.
3. Treat EN Wiktionary as a broader lexical base and translate/label EN glosses only when ZH is absent.
4. Add a morphology resolver lane before AI: many "gaps" are inflected forms (`habría`, `murió`, `cállate`, `sentí`) rather than true lemma dictionary gaps.
5. Keep LEX-007 quality-gated AI fallback only for the residual long tail after filtering names/foreign tokens and resolving morphology.

