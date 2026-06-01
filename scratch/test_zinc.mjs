import { readdir, readFile } from "node:fs/promises";

const watchFiles = await readdir("src/app/watch", { recursive: true });
const invalidZincSteps = /zinc-(?:150|355|450|550|650)\b/;

for (const file of watchFiles) {
  if (!file.endsWith(".tsx")) continue;
  const path = `src/app/watch/${file}`;
  const source = await readFile(path, "utf8");
  if (invalidZincSteps.test(source)) {
    console.log("FAIL file:", path);
    const matches = source.match(/zinc-\S+/g);
    console.log("Matches:", matches);
  }
}
console.log("Done checking zinc steps.");
