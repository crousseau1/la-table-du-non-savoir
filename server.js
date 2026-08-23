const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "questions.json");
const PORT = Number(process.env.PORT) || 4173;
const ADMIN_CODE = "rando";
const GIST_ID = "e92fb2d066ff5e4421fd1f70f8446168";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function readQuestions() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeQuestions(questions) {
  const payload = {
    updatedAt: new Date().toISOString(),
    questions,
  };
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function getGithubToken() {
  return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
}

async function pushGist(questions) {
  const token = getGithubToken();
  const payload = {
    updatedAt: new Date().toISOString(),
    questions,
  };
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "questions.json": {
          content: JSON.stringify(payload, null, 2),
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist ${res.status}: ${text.slice(0, 200)}`);
  }
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("payload"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === "/") filePath = "/index.html";
  filePath = filePath.replace(/^\/+/, "").replace(/\//g, path.sep);
  const abs = path.normalize(path.join(ROOT, filePath));
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (abs !== ROOT && !abs.startsWith(rootWithSep)) {
    send(res, 403, { error: "Interdit" });
    return;
  }
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    send(res, 404, { error: "Introuvable" });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(abs).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/api/questions") {
      send(res, 200, readQuestions());
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/questions") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (String(body.code || "") !== ADMIN_CODE) {
        send(res, 403, { error: "Code incorrect." });
        return;
      }
      const questions = Array.isArray(body.questions) ? body.questions : [];
      const clean = questions
        .map((item) => ({
          theme: String(item.theme || "").trim() || "Général",
          question: String(item.question || "").trim(),
          display: String(item.display || "").trim(),
          answers: Array.isArray(item.answers)
            ? item.answers.map((a) => String(a).trim()).filter(Boolean)
            : [],
        }))
        .filter((item) => item.question && item.display && item.answers.length);
      if (!clean.length) {
        send(res, 400, { error: "Ajoutez au moins une question complète." });
        return;
      }
      writeQuestions(clean);
      let online = false;
      let gistError = "";
      try {
        await pushGist(clean);
        online = true;
      } catch (err) {
        gistError = String(err.message || err);
      }
      send(res, 200, {
        questions: clean,
        online,
        gist: `https://gist.github.com/crousseau1/${GIST_ID}`,
        gistError,
      });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res);
      return;
    }

    send(res, 405, { error: "Méthode non autorisée" });
  } catch (err) {
    send(res, 500, { error: "Erreur serveur", detail: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`La Table du non Savoir : http://127.0.0.1:${PORT}/`);
});
