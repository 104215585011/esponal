import sys

MOJIBAKE_HINTS = ["\u951f", "\ufffd", "\u95bb", "\u9420", "\u95b9", "\u95ba", "\u6fde", "\u95c1", "\u941f", "\u9361"]

with open('C:/Users/wang/esponal/session-handoff.md', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

out_lines = []
for idx, line in enumerate(lines):
    line_num = idx + 1
    for hint in MOJIBAKE_HINTS:
        if hint in line:
            out_lines.append(f"Line {line_num} ({hex(ord(hint))}): {line.strip()}\n")

with open('C:/Users/wang/esponal/scratch/mojibake_lines.txt', 'w', encoding='utf-8') as out_f:
    out_f.writelines(out_lines)

print(f"Done. Wrote {len(out_lines)} lines to scratch/mojibake_lines.txt.")
