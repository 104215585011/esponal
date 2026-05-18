import { build } from "esbuild";

await build({
  entryPoints: ["background.js", "content.js", "popup.js", "harvest.js"],
  bundle: true,
  outdir: "dist",
  format: "iife",
  define: {
    "process.env.EXT_INGEST_TOKEN": JSON.stringify(process.env.EXT_INGEST_TOKEN ?? ""),
    "process.env.ESPONAL_APP_ORIGIN": JSON.stringify(
      process.env.ESPONAL_APP_ORIGIN ?? "http://localhost:3000"
    )
  }
});
