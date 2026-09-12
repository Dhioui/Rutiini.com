/**
 * Development only. Nothing in production may import this module.
 *
 * It pulls in Vite, vite.config and nanoid, none of which exist in the runtime
 * image -- that is built with `npm ci --omit=dev`. index.ts therefore reaches it
 * through `await import("./vite")` inside the development branch, and the build
 * runs esbuild with --splitting so that import becomes a chunk loaded on demand
 * rather than a static import resolved at startup.
 *
 * Anything production needs lives in static.ts.
 */

import { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server) {
  // Vite runs in middleware mode, so it cannot work out which port the browser
  // reached it on. Without clientPort the HMR client builds the URL
  // "ws://localhost:undefined" and throws, which does more damage than losing hot
  // reload: when Vite re-optimises its dependency cache it answers in-flight
  // requests for the previous build with 504 "Outdated Optimize Dep" and relies on
  // an HMR full-reload to recover. With the socket dead that reload never arrives,
  // react-dom never loads, and the dev server serves a blank page until someone
  // reloads by hand.
  const port = Number.parseInt(process.env.PORT || '5000', 10);

  // Vite's host check protects the dev server against DNS rebinding. It used to be
  // disabled outright so the Replit preview domain would work; now that the project
  // is host-agnostic, set DEV_ALLOWED_HOSTS (comma-separated) when developing behind
  // a tunnel or proxy, and leave it unset for normal local work. Dev server only --
  // production serves pre-built static files and never reaches this code.
  const allowedHostsEnv = process.env.DEV_ALLOWED_HOSTS?.trim();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server, clientPort: port },
    ...(allowedHostsEnv
      ? { allowedHosts: allowedHostsEnv.split(',').map((h) => h.trim()).filter(Boolean) }
      : {}),
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
