// Minimal static server on pure Node (no dependencies).
// Serves files from this folder, safely resolves paths, knows MIME types.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8001;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  // Drop query string, "/" -> "/index.html".
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  // Path traversal guard: normalize and keep the path inside this folder.
  const safePath = normalize(join(__dirname, urlPath));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403).end("403 Forbidden");
    return;
  }

  try {
    const data = await readFile(safePath);
    const type = MIME[extname(safePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`\n  🎮 Wander running → http://localhost:${PORT}\n`);
});
