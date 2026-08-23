(() => {
  const DURATION = 30;
  const CIRCUMFERENCE = 2 * Math.PI * 52;
  const BEST_KEY = "table-non-savoir-best";

  let QUESTIONS = [];

  const screens = {
    home: document.getElementById("screen-home"),
    countdown: document.getElementById("screen-countdown"),
    quiz: document.getElementById("screen-quiz"),
    results: document.getElementById("screen-results"),
    admin: document.getElementById("screen-admin"),
  };

  const els = {
    start: document.getElementById("btn-start"),
    replayBtns: document.querySelectorAll(".btn-replay"),
    best: document.getElementById("best-score"),
    countdownDigit: document.getElementById("countdown-digit"),
    progress: document.getElementById("quiz-progress"),
    timerWrap: document.querySelector(".timer-wrap"),
    timerBar: document.getElementById("timer-bar"),
    timerSeconds: document.getElementById("timer-seconds"),
    index: document.getElementById("question-index"),
    theme: document.getElementById("question-theme"),
    text: document.getElementById("question-text"),
    form: document.getElementById("answer-form"),
    input: document.getElementById("answer-input"),
    scoreValue: document.getElementById("score-value"),
    scoreTotal: document.getElementById("score-total"),
    recap: document.getElementById("recap"),
    adminGate: document.getElementById("admin-gate"),
    adminCode: document.getElementById("admin-code"),
    adminGateError: document.getElementById("admin-gate-error"),
    adminList: document.getElementById("admin-list"),
    adminStatus: document.getElementById("admin-status"),
    adminHome: document.getElementById("btn-admin-home"),
    addQuestion: document.getElementById("btn-add-question"),
    saveQuestions: document.getElementById("btn-save-questions"),
  };

  const state = {
    index: 0,
    answers: [],
    remaining: DURATION,
    timerId: null,
    locked: false,
  };

  function show(name) {
    Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
    screens[name].classList.add("is-active");
  }

  function normalize(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’`]/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isCorrect(raw, accepted) {
    const given = normalize(raw);
    if (!given) return false;

    return accepted.some((item) => {
      const expected = normalize(item);
      if (given === expected) return true;
      if (expected.length >= 5 && (given.includes(expected) || expected.includes(given))) {
        return true;
      }
      return false;
    });
  }

  function renderBest() {
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    if (!best) return;
    els.best.hidden = false;
    els.best.textContent = `Meilleur : ${best} / ${QUESTIONS.length || 10}`;
  }

  function updateHome() {
    const n = QUESTIONS.length || 10;
    els.scoreTotal.textContent = `/ ${n}`;
    els.start.disabled = !QUESTIONS.length;
    els.start.textContent = QUESTIONS.length ? "Jouer" : "Aucune question";
    renderBest();
  }

  function buildProgress() {
    els.progress.innerHTML = QUESTIONS.map((_, i) => `<i data-i="${i}"></i>`).join("");
  }

  function updateProgress() {
    els.progress.querySelectorAll("i").forEach((dot, i) => {
      dot.classList.toggle("is-done", i < state.index);
      dot.classList.toggle("is-current", i === state.index);
    });
  }

  function setTimerVisual(secondsLeft) {
    const ratio = Math.max(0, secondsLeft / DURATION);
    els.timerBar.style.strokeDasharray = String(CIRCUMFERENCE);
    els.timerBar.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - ratio));
    els.timerSeconds.textContent = String(Math.ceil(secondsLeft));
    els.timerWrap.classList.toggle("is-urgent", secondsLeft <= 5 && secondsLeft > 0);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    state.remaining = DURATION;
    setTimerVisual(state.remaining);
    const started = Date.now();

    state.timerId = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      state.remaining = Math.max(0, DURATION - elapsed);
      setTimerVisual(state.remaining);
      if (state.remaining <= 0) {
        submitAnswer(els.input.value, true);
      }
    }, 80);
  }

  function loadQuestion() {
    const q = QUESTIONS[state.index];
    state.locked = false;
    els.index.textContent = `Question ${state.index + 1} / ${QUESTIONS.length}`;
    els.theme.textContent = q.theme;
    els.text.textContent = q.question;
    els.input.value = "";
    els.input.disabled = false;
    updateProgress();
    startTimer();
    els.input.focus();
  }

  function submitAnswer(value, fromTimer) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();

    const q = QUESTIONS[state.index];
    const given = (value || "").trim();
    state.answers.push({
      given,
      ok: isCorrect(given, q.answers),
      timedOut: Boolean(fromTimer && !given),
    });

    state.index += 1;
    if (state.index >= QUESTIONS.length) {
      finish();
      return;
    }
    loadQuestion();
  }

  function startCountdown() {
    if (!QUESTIONS.length) return;
    show("countdown");
    const steps = ["3", "2", "1", "GO"];
    let i = 0;
    els.countdownDigit.textContent = steps[0];

    const tick = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(tick);
        startQuiz();
        return;
      }
      els.countdownDigit.textContent = steps[i];
    }, 800);
  }

  function finish() {
    const score = state.answers.filter((a) => a.ok).length;
    const previous = Number(localStorage.getItem(BEST_KEY) || 0);
    if (score > previous) localStorage.setItem(BEST_KEY, String(score));

    els.scoreValue.textContent = String(score);
    els.scoreTotal.textContent = `/ ${QUESTIONS.length}`;
    els.recap.innerHTML = QUESTIONS.map((q, i) => {
      const a = state.answers[i];
      const yours = a.given ? a.given : a.timedOut ? "Temps écoulé" : "Pas de réponse";
      return `
        <li class="${a.ok ? "is-ok" : "is-ko"}">
          <div class="q-head">
            <span>${i + 1} · ${q.theme}</span>
            <span class="mark ${a.ok ? "ok" : "ko"}">${a.ok ? "Juste" : "Faux"}</span>
          </div>
          <p>${q.question}</p>
          <div class="answers">
            <span>Vous : <b>${escapeHtml(yours)}</b></span>
            <span>Réponse : <b>${escapeHtml(q.display)}</b></span>
          </div>
        </li>
      `;
    }).join("");

    show("results");
    renderBest();
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function startQuiz() {
    state.index = 0;
    state.answers = [];
    buildProgress();
    show("quiz");
    loadQuestion();
  }

  function emptyQuestion() {
    return { theme: "", question: "", display: "", answers: [] };
  }

  function renderAdmin(list = QUESTIONS) {
    const items = list.length ? list : [emptyQuestion()];
    els.adminList.innerHTML = items
      .map(
        (q, i) => `
        <article class="admin-card" data-index="${i}">
          <div class="admin-card-head">
            <strong>Question ${i + 1}</strong>
            <button class="btn btn-ghost btn-danger btn-delete" type="button">Supprimer</button>
          </div>
          <label>Thème
            <input class="f-theme" type="text" value="${escapeHtml(q.theme)}" />
          </label>
          <label>Question
            <textarea class="f-question">${escapeHtml(q.question)}</textarea>
          </label>
          <label>Réponse
            <input class="f-display" type="text" value="${escapeHtml(q.display)}" />
          </label>
          <label>Acceptées
            <textarea class="f-answers answers-box">${escapeHtml((q.answers || []).join("\n"))}</textarea>
          </label>
        </article>
      `
      )
      .join("");
  }

  function collectAdmin() {
    return Array.from(els.adminList.querySelectorAll(".admin-card")).map((card) => ({
      theme: card.querySelector(".f-theme").value,
      question: card.querySelector(".f-question").value,
      display: card.querySelector(".f-display").value,
      answers: card.querySelector(".f-answers").value.split(/\n/).map((s) => s.trim()).filter(Boolean),
    }));
  }

  function setAdminStatus(message, kind) {
    els.adminStatus.hidden = !message;
    els.adminStatus.textContent = message;
    els.adminStatus.classList.toggle("is-ok", kind === "ok");
    els.adminStatus.classList.toggle("is-ko", kind === "ko");
  }

  function openAdmin() {
    renderAdmin(QUESTIONS);
    setAdminStatus("", "");
    show("admin");
  }

  els.start.addEventListener("click", startCountdown);
  els.replayBtns.forEach((btn) => btn.addEventListener("click", startCountdown));
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAnswer(els.input.value, false);
  });

  els.adminGate.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = els.adminCode.value.trim();
    if (code !== ADMIN_CODE) {
      els.adminGateError.hidden = false;
      return;
    }
    els.adminGateError.hidden = true;
    els.adminCode.value = "";
    openAdmin();
  });

  els.adminHome.addEventListener("click", () => {
    updateHome();
    show("home");
  });

  els.addQuestion.addEventListener("click", () => {
    const current = collectAdmin();
    current.push(emptyQuestion());
    renderAdmin(current);
  });

  els.adminList.addEventListener("click", (event) => {
    const btn = event.target.closest(".btn-delete");
    if (!btn) return;
    const card = btn.closest(".admin-card");
    card.remove();
    const current = collectAdmin();
    renderAdmin(current.length ? current : [emptyQuestion()]);
  });

  els.saveQuestions.addEventListener("click", async () => {
    els.saveQuestions.disabled = true;
    setAdminStatus("Enregistrement…", "");
    try {
      const result = await STORAGE.save(collectAdmin(), ADMIN_CODE);
      QUESTIONS = result.questions;
      renderAdmin(QUESTIONS);
      updateHome();
      if (result.online) {
        setAdminStatus("Enregistré.", "ok");
      } else {
        setAdminStatus("Erreur d’enregistrement en ligne.", "ko");
      }
    } catch (err) {
      setAdminStatus(err.message || "Échec de l’enregistrement.", "ko");
    } finally {
      els.saveQuestions.disabled = false;
    }
  });

  (async function boot() {
    const loaded = await STORAGE.load();
    QUESTIONS = loaded.questions;
    updateHome();
    const bootStart = new URLSearchParams(location.search).get("start");
    if (bootStart === "quiz") startQuiz();
    if (bootStart === "admin") openAdmin();
  })();
})();
