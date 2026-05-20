import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const harvestEntry = path.join(extensionRoot, "harvest.js");
const parseJson3Entry = path.join(extensionRoot, "parseJson3.js");
const esponalSiteEntry = path.join(extensionRoot, "esponal-site.js");

const EXT_INGEST_TOKEN = process.env.EXT_INGEST_TOKEN ?? "";
const ESPONAL_APP_ORIGIN =
  process.env.ESPONAL_APP_ORIGIN ?? "http://localhost:3000";

await build({
  absWorkingDir: extensionRoot,
  bundle: true,
  define: {
    __EXT_INGEST_TOKEN__: JSON.stringify(EXT_INGEST_TOKEN),
    __ESPONAL_APP_ORIGIN__: JSON.stringify(ESPONAL_APP_ORIGIN)
  },
  entryPoints: {
    harvest: harvestEntry,
    "esponal-site": esponalSiteEntry
  },
  format: "iife",
  outdir: path.join(extensionRoot, "dist"),
  platform: "browser",
  target: ["chrome114"]
});

if (!parseJson3Entry) {
  throw new Error("parseJson3.js entry is required");
}
