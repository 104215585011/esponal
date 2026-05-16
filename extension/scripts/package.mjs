import { deflateRawSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(extensionRoot, "..");
const outputDir = path.join(repoRoot, "public", "extension");
const outputPath = path.join(outputDir, "esponal-extension.zip");

const files = [
  "manifest.json",
  "popup.html",
  "lemma-dict.json",
  "dist/background.js",
  "dist/content.js",
  "dist/popup.js"
];

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name.replaceAll("\\", "/"));
    const source = readFileSync(path.join(extensionRoot, entry.name));
    const compressed = deflateRawSync(source, { level: 9 });
    const checksum = crc32(source);
    const { time, day } = dosDateTime(new Date());

    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(8),
      writeUInt16(time),
      writeUInt16(day),
      writeUInt32(checksum),
      writeUInt32(compressed.length),
      writeUInt32(source.length),
      writeUInt16(nameBuffer.length),
      writeUInt16(0),
      nameBuffer
    ]);

    const centralHeader = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(8),
      writeUInt16(time),
      writeUInt16(day),
      writeUInt32(checksum),
      writeUInt32(compressed.length),
      writeUInt32(source.length),
      writeUInt16(nameBuffer.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      nameBuffer
    ]);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0)
  ]);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

for (const file of files) {
  readFileSync(path.join(extensionRoot, file));
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, createZip(files.map((name) => ({ name }))));
console.log(`Packaged ${path.relative(repoRoot, outputPath)} (${readdirSync(outputDir).length} file(s) in output dir)`);
