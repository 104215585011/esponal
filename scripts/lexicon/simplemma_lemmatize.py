#!/usr/bin/env python
# Timestamp: 2026-05-29 21:20
import json
import sys

import simplemma


def main() -> int:
    payload = json.load(sys.stdin)
    words = payload.get("words", [])
    results = {}
    for word in words:
        if not isinstance(word, str):
            continue
        results[word] = simplemma.lemmatize(word, lang="es")
    json.dump({"lemmas": results}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
