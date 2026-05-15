import { NextResponse } from "next/server";
import { lookupDictionary } from "@/lib/dictionary";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim() ?? "";

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  const entry = await lookupDictionary(word);

  if (!entry) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  return NextResponse.json(entry);
}
