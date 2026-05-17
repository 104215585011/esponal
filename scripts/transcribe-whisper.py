import argparse
import json
import sys

import whisper


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--language", default="es")
    parser.add_argument("--task", default="transcribe")
    args = parser.parse_args()

    model = whisper.load_model(args.model)
    result = model.transcribe(
        args.audio,
        language=args.language,
        task=args.task,
        fp16=False,
        verbose=False,
    )

    cues = []
    for segment in result.get("segments", []):
        text = str(segment.get("text", "")).strip()
        start = float(segment.get("start", 0))
        end = float(segment.get("end", start))
        dur = max(0.01, end - start)

        if text:
            cues.append({"start": start, "dur": dur, "text": text})

    json.dump(cues, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
