import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const outputDir = new URL("../public/icons/", import.meta.url);
const brand = [0x10, 0xb9, 0x81, 0xff];
const white = [0xff, 0xff, 0xff, 0xff];

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPng(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const text = Buffer.from("Comment\0Esponal generated app icon");

  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    pixels.copy(rows, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("tEXt", text),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function setPixel(pixels, size, x, y, color) {
  const offset = (y * size + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function fillRoundedRect(pixels, size, inset, radius, color) {
  const left = inset;
  const top = inset;
  const right = size - inset - 1;
  const bottom = size - inset - 1;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = x < left + radius ? left + radius - x : x > right - radius ? x - (right - radius) : 0;
      const dy = y < top + radius ? top + radius - y : y > bottom - radius ? y - (bottom - radius) : 0;
      if (dx * dx + dy * dy <= radius * radius || dx === 0 || dy === 0) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function fillRect(pixels, size, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      setPixel(pixels, size, col, row, color);
    }
  }
}

function drawLetterE(pixels, size, inset) {
  const box = size - inset * 2;
  const letterHeight = Math.round(box * 0.58);
  const letterWidth = Math.round(box * 0.36);
  const stemWidth = Math.max(12, Math.round(letterWidth * 0.24));
  const barHeight = Math.max(12, Math.round(letterHeight * 0.16));
  const x = Math.round((size - letterWidth) / 2);
  const y = Math.round((size - letterHeight) / 2);

  fillRect(pixels, size, x, y, stemWidth, letterHeight, white);
  fillRect(pixels, size, x, y, letterWidth, barHeight, white);
  fillRect(
    pixels,
    size,
    x,
    y + Math.round((letterHeight - barHeight) / 2),
    Math.round(letterWidth * 0.72),
    barHeight,
    white
  );
  fillRect(pixels, size, x, y + letterHeight - barHeight, letterWidth, barHeight, white);
}

async function writeIcon(filename, size, insetRatio) {
  const pixels = Buffer.alloc(size * size * 4);
  const inset = Math.round(size * insetRatio);
  const radius = Math.round((size - inset * 2) * 0.22);

  fillRoundedRect(pixels, size, inset, radius, brand);
  drawLetterE(pixels, size, Math.round(size * (insetRatio + 0.12)));

  const png = createPng(size, size, pixels);
  await writeFile(new URL(filename, outputDir), png);
  return png;
}

function createIcoFromPng(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const directory = Buffer.alloc(16);
  directory[0] = size >= 256 ? 0 : size;
  directory[1] = size >= 256 ? 0 : size;
  directory[2] = 0;
  directory[3] = 0;
  directory.writeUInt16LE(1, 4);
  directory.writeUInt16LE(32, 6);
  directory.writeUInt32LE(png.length, 8);
  directory.writeUInt32LE(header.length + directory.length, 12);

  return Buffer.concat([header, directory, png]);
}

await mkdir(outputDir, { recursive: true });
const faviconPng = await writeIcon("icon-192.png", 192, 0.08);
await writeIcon("icon-512.png", 512, 0.08);
await writeIcon("icon-maskable-192.png", 192, 0.04);
await writeIcon("icon-maskable-512.png", 512, 0.04);
await writeFile(new URL("../favicon.ico", outputDir), createIcoFromPng(faviconPng, 192));
