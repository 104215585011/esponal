// SSE 客户端工具：把 fetch 返回的 ReadableStream 解析成事件流
// 搬自 talks/src/lib/chat/sse.ts

export type ParsedSseEvent = {
  event: string;
  data: unknown;
};

export function parseSseChunk(buffer: string) {
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() ?? "";
  const events: ParsedSseEvent[] = [];

  for (const chunk of chunks) {
    const eventLine = chunk
      .split("\n")
      .find((line) => line.startsWith("event: "))
      ?.slice("event: ".length);
    const dataLine = chunk
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice("data: ".length);

    if (!eventLine || !dataLine) continue;

    try {
      events.push({ event: eventLine, data: JSON.parse(dataLine) as unknown });
    } catch {
      continue;
    }
  }

  return { events, remainder };
}
