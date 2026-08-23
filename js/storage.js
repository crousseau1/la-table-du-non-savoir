const STORAGE = (() => {
  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => ({
        theme: String(item.theme || "").trim() || "Général",
        question: String(item.question || "").trim(),
        display: String(item.display || "").trim(),
        answers: Array.isArray(item.answers)
          ? item.answers.map((a) => String(a).trim()).filter(Boolean)
          : String(item.answers || "")
              .split(/\n|,/)
              .map((a) => a.trim())
              .filter(Boolean),
      }))
      .filter((item) => item.question && item.display && item.answers.length);
  }

  function parsePayload(data) {
    const list = Array.isArray(data) ? data : data && data.questions;
    return sanitize(list);
  }

  async function fromGist() {
    const url = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("gist");
    const gist = await res.json();
    const file = gist.files && gist.files["questions.json"];
    if (!file || !file.content) throw new Error("gist-file");
    return parsePayload(JSON.parse(file.content));
  }

  async function fromApi() {
    const res = await fetch(`/api/questions?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("api");
    return parsePayload(await res.json());
  }

  async function fromCache() {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return parsePayload(JSON.parse(raw));
  }

  function remember(questions) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ questions }));
  }

  async function load() {
    const errors = [];
    for (const source of [fromGist, fromApi, fromCache]) {
      try {
        const questions = await source();
        if (questions.length) {
          remember(questions);
          return { questions, source: source.name };
        }
      } catch (err) {
        errors.push(String(err && err.message ? err.message : err));
      }
    }
    const fallback = sanitize(typeof DEFAULT_QUESTIONS !== "undefined" ? DEFAULT_QUESTIONS : []);
    return { questions: fallback, source: "defaults", errors };
  }

  async function save(questions, code) {
    const clean = sanitize(questions);
    if (!clean.length) throw new Error("Ajoutez au moins une question complète.");
    remember(clean);
    const res = await fetch("/api/questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, questions: clean }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Impossible d’enregistrer.");
    }
    return { questions: clean, online: Boolean(body.online), gist: body.gist || "" };
  }

  return { load, save, sanitize };
})();
