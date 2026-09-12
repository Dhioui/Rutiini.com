/**
 * The parts of the server that production actually uses: logging, and serving
 * the built client.
 *
 * These lived in vite.ts, next to setupVite, which is a development-only helper
 * that imports Vite, vite.config and @vitejs/plugin-react. Because index.ts,
 * push.ts and email.ts all imported `log` from there, esbuild followed the chain
 * and wrote a static `import ... from "vite"` into dist/index.js. ESM resolves
 * static imports before any code runs, so the NODE_ENV check that was supposed
 * to keep Vite out of production never got the chance: the runtime image, built
 * with `npm ci --omit=dev`, has no Vite and the process died at startup with
 * ERR_MODULE_NOT_FOUND before printing a single line.
 *
 * Nothing here may import a devDependency. That is the whole point of the file.
 */

import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
