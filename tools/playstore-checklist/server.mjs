/**
 * Local checklist app — serves UI and persists progress to progress.json.
 * Run: node server.mjs   (or npm start / .\start.ps1)
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CHECKLIST_PORT) || 9473;
const PROGRESS_FILE = path.join(__dirname, "progress.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function readProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    }
  } catch {
    /* ignore corrupt file */
  }
  return { checked: {}, signoff: {}, updatedAt: null };
}

function writeProgress(data) {
  const payload = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  let urlPath = req.url?.split("?")[0] ?? "/";
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(__dirname, urlPath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
}

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split("?")[0] ?? "/";

  if (urlPath === "/api/progress" && req.method === "GET") {
    sendJson(res, 200, readProgress());
    return;
  }

  if (urlPath === "/api/progress" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const saved = writeProgress({
          checked: parsed.checked ?? {},
          signoff: parsed.signoff ?? {},
        });
        sendJson(res, 200, saved);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON" });
      }
    });
    return;
  }

  if (urlPath === "/api/progress" && req.method === "DELETE") {
    writeProgress({ checked: {}, signoff: {} });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log("");
  console.log("  Listahan Play Store Checklist");
  console.log("  -----------------------------");
  console.log(`  Open: ${url}`);
  console.log(`  Progress file: ${PROGRESS_FILE}`);
  console.log("");
  console.log("  Press Ctrl+C to stop this window.");
  console.log("");
  if (process.env.CHECKLIST_NO_OPEN !== "1") {
    openBrowser(url);
  }
});
