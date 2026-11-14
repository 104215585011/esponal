// Timestamp: 2026-11-15 03:18
import { NextResponse } from "next/server";
import { SPANISH_ALPHABET } from "../../../../../content/phonics/alphabet";

/**
 * GET /api/mobile/phonics
 *
 * 27 个西语字母与发音规则，直接复用 Web 端 content/phonics/alphabet.ts。
 */
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(
    {
      letters: SPANISH_ALPHABET.map((item) => ({
        letter: item.letter,
        letterLower: item.letterLower,
        name: item.name,
        example: item.example,
        exampleZh: item.exampleZh,
        slug: item.slug,
        rules: item.rules ?? [],
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }
  );
}
