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

  function remember(questions) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ questions }));
  }

  function saveDraft(list) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ questions: list || [] }));
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : data.questions;
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  async function fromCrud() {
    const res = await fetch(`${CRUD_BASE}/questions?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("crud");
    const rows = await res.json();
    const doc = Array.isArray(rows) ? rows[0] : rows;
    const questions = parsePayload(doc);
    if (!questions.length) throw new Error("crud-empty");
    return questions;
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

  async function fromStatic() {
    const res = await fetch(`data/questions.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("static");
    return parsePayload(await res.json());
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

  async function load() {
    for (const source of [fromCrud, fromGist, fromApi, fromStatic, fromCache]) {
      try {
        const questions = await source();
        if (questions.length) {
          remember(questions);
          return { questions, source: source.name };
        }
      } catch {
        /* try next */
      }
    }
    const fallback = sanitize(typeof DEFAULT_QUESTIONS !== "undefined" ? DEFAULT_QUESTIONS : []);
    return { questions: fallback, source: "defaults" };
  }

  async function putQuestions(payload) {
    const res = await fetch(`${CRUD_BASE}/questions?t=${Date.now()}`, { cache: "no-store" });
    const rows = res.ok ? await res.json() : [];
    const id = Array.isArray(rows) && rows[0] && rows[0]._id;
    if (id) {
      const put = await fetch(`${CRUD_BASE}/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!put.ok) throw new Error("Impossible d’enregistrer.");
      return;
    }
    const created = await fetch(`${CRUD_BASE}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!created.ok) throw new Error("Impossible d’enregistrer.");
  }

  async function save(questions, code) {
    const clean = sanitize(questions);
    if (!clean.length) throw new Error("Aucune question complète.");
    const payload = { updatedAt: new Date().toISOString(), questions: clean };
    await putQuestions(payload);
    remember(clean);
    try {
      await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, questions: clean }),
      });
    } catch {
      /* GitHub Pages n’a pas ce serveur ; crudcrud suffit */
    }
    return { questions: clean, online: true };
  }

  async function savePlay(play) {
    const res = await fetch(`${CRUD_BASE}/plays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(play),
    });
    if (!res.ok) throw new Error("play");
  }

  async function loadPlays() {
    const res = await fetch(`${CRUD_BASE}/plays?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows)
      ? rows.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
      : [];
  }

  return { load, save, saveDraft, loadDraft, savePlay, loadPlays, sanitize };
})();
