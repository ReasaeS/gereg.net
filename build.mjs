import * as esbuild from "esbuild";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const dev = process.argv.includes("--dev");
const outdir = "dist";

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: [
    { in: "src/app.ts", out: "app" },
    // Built with the copy loader so edits to it trigger a live reload.
    { in: "public/index.html", out: "index" },
  ],
  loader: { ".html": "copy" },
  outdir,
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: dev ? "inline" : true,
  minify: !dev,
  logLevel: "info",
  // Reload the page whenever the dev server rebuilds.
  banner: dev
    ? {
        js: 'new EventSource("/esbuild").addEventListener("change", () => location.reload());',
      }
    : {},
};

async function minifyHtml(path) {
  const html = await readFile(path, "utf8");
  const minified = html
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => {
      const minifiedCss = css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\s+/g, " ")
        .replace(/\s*([{}:;,>])\s*/g, "$1")
        .replace(/;}/g, "}")
        .trim();
      return `<style>${minifiedCss}</style>`;
    })
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim();
  await writeFile(path, minified);
}

await rm(outdir, { recursive: true, force: true });
await cp("public", outdir, { recursive: true });

if (dev) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  // esbuild strips types without checking them, so run tsc alongside it.
  spawn("npx", ["tsc", "--noEmit", "--watch", "--preserveWatchOutput"], {
    stdio: "inherit",
  });
  const { port } = await ctx.serve({ servedir: outdir, port: 9001 });
  console.log(`Dev server: http://localhost:${port}`);
} else {
  await esbuild.build(options);
  await minifyHtml(`${outdir}/index.html`);
}
