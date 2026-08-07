/*
  Geography Quiz — Enhanced Edition
  mode:          "countries" | "capitals"
  selectionType: "letter"   | "continent"
  currentLetter:    "A"–"Z"
  currentContinent: e.g. "Asia"
*/

let DATA = null;
let LANG = "en"; // "en" | "ru"

// ── State ──────────────────────────────────────────────
let mode             = "countries";
let selectionType    = "letter";
let currentLetter    = "A";
let currentContinent = "Africa";

let includeTerritories = true;
let running   = false;
let timeLeft  = 60;
let totalTime = 60;
let timerId   = null;
let score     = 0;
let found     = new Set();

let validByModeLetter = { countries: {}, capitals: {} };
let answerIndexMap    = new Map();

const CONTINENTS = ["Africa","Antarctica","Asia","Europe","North America","Oceania","South America"];

// ── Flags Quiz State ──────────────────────────────────
let flagsMode = false;
let currentRound = 1;
let flagsPerRound = [5, 10, 15];
let currentFlagIndex = 0;
let flagsPool = [];
let flagTimer = null;
let flagTimeLeft = 10;
let flagScore = 0;
let flagRoundScores = [];
let currentFlagData = null;


// ── Helpers ────────────────────────────────────────────
const $ = id => document.getElementById(id);

function stripDiacritics(str) {
  return (str || "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalise(str) {
  return stripDiacritics(str)
    .toLowerCase().trim()
    .replace(/['']/g, "'")
    .replace(/[^\p{L}0-9\s-]/gu, "")
    .replace(/\s+/g, " ");
}

// ── Timer bar ──────────────────────────────────────────
function updateTimerBar() {
  const bar = $("timerBar"); if (!bar) return;
  const pct = totalTime > 0 ? timeLeft / totalTime : 0;
  bar.style.transform = `scaleX(${pct})`;
  const warn = pct <= 0.25;
  bar.classList.toggle("warning", warn);
  $("timeLeft").style.color       = warn ? "#ff4f4f" : "";
  $("statTime").style.borderColor = warn ? "rgba(255,79,79,0.4)" : "";
}

function resetTimerBar() {
  const bar = $("timerBar"); if (!bar) return;
  bar.style.transition = "none";
  bar.style.transform  = "scaleX(1)";
  bar.classList.remove("warning");
  $("timeLeft").style.color       = "";
  $("statTime").style.borderColor = "";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = "transform 1s linear, background 1s ease";
  }));
}

// ── Particles ──────────────────────────────────────────
const PARTICLE_COLORS = ["#10d97e","#06c8e8","#3b6bff","#a855f7","#ffb020","#fff"];

function spawnParticles(x, y, count = 14) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const dist  = 60 + Math.random() * 80;
    const dur   = 0.6 + Math.random() * 0.5;
    p.style.cssText = `left:${x-4}px;top:${y-4}px;background:${PARTICLE_COLORS[Math.floor(Math.random()*PARTICLE_COLORS.length)]};--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist-30}px;--dur:${dur}s;border-radius:${Math.random()>0.5?"50%":"2px"};`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000 + 100);
  }
}

function spawnScorePop(x, y, text = "+1") {
  const el = document.createElement("div");
  el.className = "score-pop";
  el.textContent = text;
  el.style.cssText = `left:${x}px;top:${y}px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function pulseStatEl(id) {
  const el = $(id); if (!el) return;
  el.classList.remove("pulse-anim"); void el.offsetWidth; el.classList.add("pulse-anim");
  el.addEventListener("animationend", () => el.classList.remove("pulse-anim"), { once: true });
}

function flashPanel() {
  const p = $("mainPanel"); if (!p) return;
  p.classList.remove("flash-correct"); void p.offsetWidth; p.classList.add("flash-correct");
  p.addEventListener("animationend", () => p.classList.remove("flash-correct"), { once: true });
}

function shakeInput() {
  const el = $("answerInput");
  el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

// ── Data loading ───────────────────────────────────────
async function loadData() {
  let res;
  try {
    res = await fetch("./quiz_data.json", { cache: "no-store" });
  } catch (error) {
    throw new Error(
      "The quiz data could not be loaded. Open the game through a local web server, not by double-clicking index.html."
    );
  }

  if (!res.ok) {
    throw new Error(`Could not load quiz_data.json (HTTP ${res.status}).`);
  }

  DATA = await res.json();
  if (!DATA || !Array.isArray(DATA.countries)) {
    throw new Error("quiz_data.json is present, but its structure is invalid.");
  }
}

function buildIndex() {
  validByModeLetter = { countries: {}, capitals: {} };
  const rows = DATA.countries || [];

  rows.forEach(r => {
    const un   = (r.un_recognised || "").toLowerCase();
    const unOk = ["yes","true","1"].includes(un);

    const country  = LANG === "ru" ? r.country_ru  : r.country_en;
    const capital  = LANG === "ru" ? r.capital_ru  : r.capital_en;
    const cLetter  = (LANG === "ru" ? r.country_letter_ru : r.country_letter_en).toUpperCase();
    const capLetter= (LANG === "ru" ? r.capital_letter_ru : r.capital_letter_en).toUpperCase();
    const cont     = LANG === "ru" ? r.continent_ru : r.continent_en;

    if (!validByModeLetter.countries[cLetter]) validByModeLetter.countries[cLetter] = [];
    validByModeLetter.countries[cLetter].push({
      n: normalise(country),
      display: country,
      continent: cont,
      unOk
    });

    if (!validByModeLetter.capitals[capLetter]) validByModeLetter.capitals[capLetter] = [];
    validByModeLetter.capitals[capLetter].push({
      n: normalise(capital),
      display: capital,
      continent: cont,
      unOk
    });
  });
}

// ── Pool ───────────────────────────────────────────────
function getPool() {
  const bucket = mode === "countries" ? validByModeLetter.countries : validByModeLetter.capitals;
  let list;
  if (selectionType === "letter") {
    list = bucket[currentLetter] || [];
  } else {
    // flatten all letters, filter by continent
    list = Object.values(bucket).flat().filter(x => x.continent === currentContinent);
  }
  return includeTerritories ? list : list.filter(x => x.unOk);
}

function calculateRoundTime() {
  const secondsPerAnswer = LANG === "ru" ? 30 : 20;
  return Math.max(
    secondsPerAnswer,
    getPool().length * secondsPerAnswer
  );
}

// ── Answer slots ───────────────────────────────────────
function buildAnswerSlots() {
  const pool     = getPool();
  const ordered  = pool.map(x => x.display).sort((a, b) => a.localeCompare(b));
  answerIndexMap.clear();

  const ul = $("foundList");
  ul.innerHTML = "";
  ordered.forEach((display, i) => {
    const li = document.createElement("li");
    li.textContent = "—";
    ul.appendChild(li);
    answerIndexMap.set(normalise(display), i);
  });
  $("foundCount").textContent = String(found.size);
}

// ── Letter picker ──────────────────────────────────────
function buildLetters() {
  const el = $("letters");
  el.innerHTML = "";

  const alphabet = LANG === "ru"
    ? "АБВГДЕЗИЙКЛМНОПРСТУФХЦЧШЭЮЯ"
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  alphabet.split("").forEach(L => {
    const b = document.createElement("button");
    b.className = "letter" + (L === currentLetter ? " active" : "");
    b.textContent = L;

    b.onclick = () => {
      currentLetter = L;
      document.querySelectorAll(".letter").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      resetRound(false);
      updateUI();
    };

    el.appendChild(b);
  });
}

// ── Continent picker ───────────────────────────────────
function buildContinents() {
  const el = $("continents");
  if (!el) return;

  el.innerHTML = "";

  const list = LANG === "ru"
    ? ["Африка","Антарктида","Азия","Европа","Северная Америка","Океания","Южная Америка"]
    : ["Africa","Antarctica","Asia","Europe","North America","Oceania","South America"];

  list.forEach(c => {
    const b = document.createElement("button");
    b.className = "continent-btn" + (c === currentContinent ? " active" : "");
    b.textContent = c;

    b.onclick = () => {
      currentContinent = c;
      document.querySelectorAll(".continent-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      resetRound(false);
      updateUI();
    };

    el.appendChild(b);
  });
}

function refreshContinentHighlight() {
  document.querySelectorAll(".continent-btn").forEach(b => {
    b.classList.toggle("active", b.textContent === currentContinent);
  });
}

function refreshLetterHighlight() {
  document.querySelectorAll(".letter").forEach(b => {
    b.classList.toggle("active", b.textContent === currentLetter);
  });
}

// ── Show/hide pickers ──────────────────────────────────
function showLetterPicker() {
  const l = $("letters");    if (l) l.style.display = "";
  const c = $("continents"); if (c) c.style.display = "none";
}

function showContinentPicker() {
  const l = $("letters");    if (l) l.style.display = "none";
  const c = $("continents"); if (c) c.style.display = "flex";
}

// ── Tab switching ──────────────────────────────────────
function setActiveTabUI(tabId) {
  ["tabCountries","tabCapitals","tabContinent"].forEach(id => {
    const el = $(id); if (el) el.classList.toggle("active", id === tabId);
  });
}

function onCountriesTab() {
  mode = "countries";
  selectionType = "letter";
  setActiveTabUI("tabCountries");
  showLetterPicker();
  refreshLetterHighlight();
  resetRound(false);
  updateUI();
}

function onCapitalsTab() {
  mode = "capitals";
  selectionType = "letter";
  setActiveTabUI("tabCapitals");
  showLetterPicker();
  refreshLetterHighlight();
  resetRound(false);
  updateUI();
}

function onContinentTab() {
  mode = "countries";  // Force to countries mode
  selectionType = "continent";
  setActiveTabUI("tabContinent");
  buildContinents();   // rebuild to ensure buttons exist
  showContinentPicker();
  refreshContinentHighlight();
  resetRound(false);
  updateUI();
}


// ── Flags Quiz Functions ──────────────────────────────
function startFlagsQuiz() {
  flagsMode = true;
  currentRound = 1;
  currentFlagIndex = 0;
  flagScore = 0;
  flagRoundScores = [];
  
  // Hide other quiz elements
  $("letters").style.display = "none";
  $("continents").style.display = "none";
  $("answerInput").parentElement.style.display = "none";
  $("feedback").style.display = "none";
  
  // Show flags quiz
  $("flagsQuiz").style.display = "block";
  
  startFlagRound();
}

function startFlagRound() {
  const roundSize = flagsPerRound[currentRound - 1];
  
  // Update round info
  const roundTitle = LANG === "ru" 
    ? `Раунд ${currentRound} из 3`
    : `Round ${currentRound} of 3`;
  const roundDesc = LANG === "ru"
    ? `Определите ${roundSize} флагов`
    : `Identify ${roundSize} flags`;
  
  $("flagRoundTitle").textContent = roundTitle;
  $("flagRoundDesc").textContent = roundDesc;
  
  // Generate random pool for this round
  const allCountries = DATA.countries || [];
  const shuffled = [...allCountries].sort(() => Math.random() - 0.5);
  flagsPool = shuffled.slice(0, roundSize);
  
  currentFlagIndex = 0;
  
  showNextFlag();
}

function showNextFlag() {
  if (currentFlagIndex >= flagsPool.length) {
    endFlagRound();
    return;
  }
  
  currentFlagData = flagsPool[currentFlagIndex];
  
  // Update flag image
  $("flagImage").src = currentFlagData.flag_url || "";
  
  // Clear inputs
  $("countryInput").value = "";
  $("capitalInput").value = "";
  $("countryInput").focus();
  
  // Update progress
  const progress = LANG === "ru"
    ? `${currentFlagIndex + 1} / ${flagsPool.length}`
    : `${currentFlagIndex + 1} / ${flagsPool.length}`;
  $("flagProgress").textContent = progress;
  
  // Start timer
  flagTimeLeft = 10;
  $("flagTimeLeft").textContent = String(flagTimeLeft);
  $("flagTimeLeft").classList.remove("warning");
  
  if (flagTimer) clearInterval(flagTimer);
  flagTimer = setInterval(() => {
    flagTimeLeft -= 1;
    $("flagTimeLeft").textContent = String(flagTimeLeft);
    
    if (flagTimeLeft <= 3) {
      $("flagTimeLeft").classList.add("warning");
    }
    
    if (flagTimeLeft <= 0) {
      submitFlagAnswer(true); // auto-submit on timeout
    }
  }, 1000);
}

function submitFlagAnswer(timeout = false) {
  clearInterval(flagTimer);
  flagTimer = null;
  
  const countryInput = normalise($("countryInput").value);
  const capitalInput = normalise($("capitalInput").value);
  
  const correctCountry = LANG === "ru" 
    ? normalise(currentFlagData.country_ru)
    : normalise(currentFlagData.country_en);
  const correctCapital = LANG === "ru"
    ? normalise(currentFlagData.capital_ru)
    : normalise(currentFlagData.capital_en);
  
  const countryCorrect = countryInput === correctCountry;
  const capitalCorrect = capitalInput === correctCapital;
  
  let points = 0;
  let resultMsg = "";
  let resultClass = "";
  
  if (timeout) {
    resultMsg = LANG === "ru" ? "⏰ Время вышло!" : "⏰ Time's up!";
    resultClass = "incorrect";
  } else if (countryCorrect && capitalCorrect) {
    points = 2;
    flagScore += 2;
    resultMsg = LANG === "ru" ? "✅ Отлично! Оба правильно!" : "✅ Perfect! Both correct!";
    resultClass = "correct";
    
    const btn = $("capitalInput");
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    spawnParticles(cx, cy, 16);
    spawnScorePop(cx - 20, cy - 30, "+2 🎯");
  } else if (countryCorrect || capitalCorrect) {
    points = 1;
    flagScore += 1;
    const what = countryCorrect 
      ? (LANG === "ru" ? "страна" : "country")
      : (LANG === "ru" ? "столица" : "capital");
    resultMsg = LANG === "ru" 
      ? `⚠️ Только ${what} правильно`
      : `⚠️ Only ${what} correct`;
    resultClass = "partial";
    
    const btn = $("capitalInput");
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    spawnScorePop(cx - 20, cy - 30, "+1");
  } else {
    resultMsg = LANG === "ru" ? "❌ Неправильно" : "❌ Incorrect";
    resultClass = "incorrect";
  }
  
  // Show correct answer
  const correctMsg = LANG === "ru"
    ? `Правильно: ${currentFlagData.country_ru} - ${currentFlagData.capital_ru}`
    : `Correct: ${currentFlagData.country_en} - ${currentFlagData.capital_en}`;
  
  setFeedback(`${resultMsg} | ${correctMsg}`, resultClass);
  $("feedback").style.display = "block";
  
  // Move to next flag after delay
  setTimeout(() => {
    currentFlagIndex++;
    showNextFlag();
  }, 2500);
}

function endFlagRound() {
  const maxScore = flagsPool.length * 2;
  flagRoundScores.push({ round: currentRound, score: flagScore, max: maxScore });
  
  if (currentRound < 3) {
    // Show round summary and move to next round
    const percentage = Math.round((flagScore / maxScore) * 100);
    const msg = LANG === "ru"
      ? `Раунд ${currentRound} завершен! Счет: ${flagScore}/${maxScore} (${percentage}%)`
      : `Round ${currentRound} complete! Score: ${flagScore}/${maxScore} (${percentage}%)`;
    
    $("gameOverBanner").innerHTML = `
      <div class="game-over-banner">
        <div class="game-over-title">${msg}</div>
        <div class="muted" style="margin-top:4px">${LANG === "ru" ? "Готовы к следующему раунду?" : "Ready for the next round?"}</div>
      </div>`;
    
    setTimeout(() => {
      currentRound++;
      flagScore = 0;
      $("gameOverBanner").innerHTML = "";
      startFlagRound();
    }, 3000);
  } else {
    // Show final summary
    endFlagsQuiz();
  }
}

function endFlagsQuiz() {
  clearInterval(flagTimer);
  
  const totalScore = flagRoundScores.reduce((sum, r) => sum + r.score, 0);
  const totalMax = flagRoundScores.reduce((sum, r) => sum + r.max, 0);
  const percentage = Math.round((totalScore / totalMax) * 100);
  
  let emoji = "🏆";
  let msg = "";
  
  if (percentage >= 90) {
    emoji = "🏆";
    msg = LANG === "ru" ? "Невероятно!" : "Incredible!";
  } else if (percentage >= 70) {
    emoji = "🌟";
    msg = LANG === "ru" ? "Отличная работа!" : "Great job!";
  } else if (percentage >= 50) {
    emoji = "👍";
    msg = LANG === "ru" ? "Хорошо!" : "Good effort!";
  } else {
    emoji = "📚";
    msg = LANG === "ru" ? "Продолжайте практиковаться!" : "Keep practicing!";
  }
  
  const summaryLines = flagRoundScores.map(r => 
    `${LANG === "ru" ? "Раунд" : "Round"} ${r.round}: ${r.score}/${r.max}`
  ).join("<br>");
  
  $("gameOverBanner").innerHTML = `
    <div class="game-over-banner">
      <div class="game-over-title">${emoji} ${msg}</div>
      <div style="margin-top:12px; font-size:16px; font-weight:700; color:var(--cyan)">
        ${LANG === "ru" ? "Общий счет" : "Total Score"}: ${totalScore}/${totalMax} (${percentage}%)
      </div>
      <div style="margin-top:8px; font-size:14px; color:var(--muted)">
        ${summaryLines}
      </div>
    </div>`;
  
  // Reset UI
  $("flagsQuiz").style.display = "none";
  $("answerInput").parentElement.style.display = "flex";
  $("feedback").style.display = "block";
  flagsMode = false;
}

function onFlagsTab() {
  setActiveTabUI("tabFlags");
  
  // Hide other elements
  $("letters").style.display = "none";
  $("continents").style.display = "none";
  $("answerInput").parentElement.style.display = "none";
  
  // Show start button for flags
  $("startBtn").textContent = LANG === "ru" ? "▶ Начать викторину по флагам" : "▶ Start Flag Quiz";
  $("startBtn").onclick = startFlagsQuiz;
  
  // Update prompt
  $("promptText").textContent = LANG === "ru"
    ? "Викторина по флагам: 3 раунда"
    : "Flag Quiz: 3 rounds";
  $("hintText").textContent = LANG === "ru"
    ? "Раунд 1: 5 флагов, Раунд 2: 10 флагов, Раунд 3: 15 флагов. По 10 секунд на флаг!"
    : "Round 1: 5 flags, Round 2: 10 flags, Round 3: 15 flags. 10 seconds per flag!";
}


function updateUI() {
  const pool = getPool();
  const kind = mode === "countries" ? "country" : "capital";

  // Prompt text
  if (selectionType === "letter") {
    $("promptText").textContent =
      LANG === "ru"
        ? `Введите ${kind === "country" ? "страну" : "столицу"} на "${currentLetter}"`
        : `Type a ${kind} starting with "${currentLetter}"`;
  } else {
    $("promptText").textContent =
      LANG === "ru"
        ? `Введите ${kind === "country" ? "страну" : "столицу"} в регионе ${currentContinent}`
        : `Type a ${kind} in ${currentContinent}`;
  }

  // Hint
  if (!pool.length) {
    $("hintText").textContent = selectionType === "letter"
      ? (LANG === "ru" 
          ? `Нет ${kind === "country" ? "стран" : "столиц"} на "${currentLetter}" в файле данных.`
          : `No ${kind}s for "${currentLetter}" in the data file.`)
      : (LANG === "ru"
          ? `Нет ${kind === "country" ? "стран" : "столиц"} в регионе ${currentContinent} в файле данных.`
          : `No ${kind}s in ${currentContinent} in the data file.`);
  } else {
    const hintText = LANG === "ru" 
      ? `${pool.length} возможных${includeTerritories ? "" : " (только признанные ООН)"}`
      : `${pool.length} possible${includeTerritories ? "" : " (UN recognised only)"}`;
    $("hintText").textContent = hintText;
  }

  // Timer display
  const secs = calculateRoundTime();
  totalTime = secs; 
  timeLeft = secs;
  $("timeLeft").textContent = String(secs);
  $("startBtn").textContent = LANG === "ru" ? `▶ Старт (${secs}с)` : `▶ Start (${secs}s)`;

  buildAnswerSlots();
}

function setFeedback(text, cls) {
  const el = $("feedback");
  el.textContent = text;
  el.className   = `feedback ${cls || ""}`.trim();
}

function clearMissed() { $("missedList").innerHTML = ""; }

// ── Game logic ─────────────────────────────────────────
function startRound() {
  if (running) return;
  running   = true;
  totalTime = calculateRoundTime();
  timeLeft  = totalTime;

  $("timeLeft").textContent = String(timeLeft);
  $("startBtn").textContent = "⏱ Running…";
  $("startBtn").disabled    = true;
  $("answerInput").focus();
  clearMissed();
  $("gameOverBanner").innerHTML = "";
  resetTimerBar();

  timerId = setInterval(() => {
    timeLeft -= 1;
    $("timeLeft").textContent = String(timeLeft);
    updateTimerBar();
    if (timeLeft <= 0) endRound();
  }, 1000);
}

function endRound() {
  running = false;
  clearInterval(timerId); timerId = null;
  $("startBtn").textContent = LANG === "ru" ? `▶ Старт (${totalTime}с)` : `▶ Start (${totalTime}s)`;
  $("startBtn").disabled    = false;

  const bar = $("timerBar");
  if (bar) bar.style.transform = "scaleX(0)";

  const emoji = found.size >= 10 ? "🏆" : found.size >= 5 ? "🌟" : "⏰";
  const msg = LANG === "ru"
    ? (found.size >= 10 ? "Невероятно!" : found.size >= 5 ? "Отличная работа!" : "Время вышло!")
    : (found.size >= 10 ? "Incredible!" : found.size >= 5 ? "Great job!" : "Time's up!");
  
  const foundMsg = LANG === "ru" 
    ? `Вы нашли ${found.size}.`
    : `You found ${found.size}.`;
  
  const revealMsg = LANG === "ru"
    ? 'Нажмите "Показать пропущенные", чтобы увидеть оставшиеся.'
    : 'Click "Reveal missed" to see what was left.';

  $("gameOverBanner").innerHTML = `
    <div class="game-over-banner">
      <div class="game-over-title">${emoji} ${msg} ${foundMsg}</div>
      <div class="muted" style="margin-top:4px">${revealMsg}</div>
    </div>`;
}

function resetRound(resetScore = true) {
  running = false;
  if (timerId) { clearInterval(timerId); timerId = null; }
  $("gameOverBanner").innerHTML = "";
  $("startBtn").disabled = false;
  resetTimerBar();

  if (resetScore) { score = 0; $("score").textContent = "0"; }

  found = new Set();
  setFeedback("", "");
  clearMissed();
}

function submitAnswer() {
  const input = $("answerInput");
  const raw   = input.value;
  input.value = "";
  if (!raw.trim()) return;

  const n    = normalise(raw);
  const pool = getPool();
  const validSet = new Set(pool.map(x => x.n));

  if (!validSet.has(n)) {
    setFeedback("❌ Not in the list (or spelling differs).", "nope");
    shakeInput(); return;
  }
  if (found.has(n)) {
    setFeedback("⚠️ Already got that one — try another!", "warn");
    shakeInput(); return;
  }

  found.add(n);
  const display = (pool.find(x => x.n === n) || {}).display || raw.trim();

  const idx = answerIndexMap.get(n);
  if (idx !== undefined) {
    const li = $("foundList").children[idx];
    if (li) { li.textContent = display; li.classList.add("filled"); }
  }

  score += 1;
  $("score").textContent      = String(score);
  $("foundCount").textContent = String(found.size);

  const btn  = $("submitBtn");
  const rect = btn.getBoundingClientRect();
  const cx   = rect.left + rect.width / 2;
  const cy   = rect.top  + rect.height / 2;
  spawnParticles(cx, cy, 16);
  spawnScorePop(cx - 20, cy - 30, "+1 🌍");
  pulseStatEl("statScore");
  pulseStatEl("statFound");
  flashPanel();
  setFeedback("✅ Correct!", "ok");

  // Check if all items found
  if (found.size === pool.length) {
    completeRound();
  }
}

function completeRound() {
  running = false;
  clearInterval(timerId); timerId = null;
  
  const timeElapsed = totalTime - timeLeft;
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  const timeString = minutes > 0 
    ? `${minutes}m ${seconds}s` 
    : `${seconds}s`;

  const bar = $("timerBar");
  if (bar) bar.style.transition = "none";

  $("startBtn").textContent = LANG === "ru" ? `▶ Старт (${totalTime}с)` : `▶ Start (${totalTime}s)`;
  $("startBtn").disabled = false;

  const emoji = "🏆";
  const msg = LANG === "ru" 
    ? `Отлично! Вы нашли все ${found.size}!`
    : `Perfect! You found all ${found.size}!`;
  const timeMsg = LANG === "ru"
    ? `Время: ${timeString}`
    : `Time: ${timeString}`;
  
  $("gameOverBanner").innerHTML = `
    <div class="game-over-banner">
      <div class="game-over-title">${emoji} ${msg}</div>
      <div style="margin-top:8px; font-size:18px; font-weight:700; color:var(--cyan)">${timeMsg}</div>
      <div class="muted" style="margin-top:4px">${LANG === "ru" ? "Поздравляем!" : "Congratulations!"}</div>
    </div>`;
}

function revealMissed() {
  if (running) { setFeedback("Finish the round first, then reveal missed.", "warn"); return; }

  const missed = getPool()
    .map(x => x.display)
    .filter(d => !found.has(normalise(d)))
    .sort((a, b) => a.localeCompare(b));

  const ul = $("missedList");
  ul.innerHTML = "";
  missed.forEach(x => { const li = document.createElement("li"); li.textContent = x; ul.appendChild(li); });
  setFeedback(`Missed: ${missed.length}.`, "warn");
}

// ── Boot ───────────────────────────────────────────────
(async function init() {
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    const banner = $("gameOverBanner");
    if (banner) {
      banner.innerHTML = `
        <div class="game-over-banner">
          <div class="game-over-title">⚠️ Game could not start</div>
          <div class="muted" style="margin-top:8px">${error.message}</div>
          <div class="muted" style="margin-top:8px">On Windows, double-click <strong>start_game.bat</strong>.</div>
        </div>`;
    }
    const start = $("startBtn");
    if (start) start.disabled = true;
    return;
  }

  buildIndex();
  buildLetters();
  buildContinents();
  showLetterPicker();   // start on letter picker
  resetTimerBar();

  $("tabCountries").onclick = onCountriesTab;
  $("tabCapitals").onclick  = onCapitalsTab;
  $("tabContinent").onclick = onContinentTab;

  $("toggleTerritories").onchange = e => {
    includeTerritories = !!e.target.checked;
    resetRound(false);
    updateUI();
  };

  // Add language toggle handler here
  $("langToggle").onclick = () => {
    LANG = LANG === "en" ? "ru" : "en";

    // highlight active pill
    $("langEN").classList.toggle("active", LANG === "en");
    $("langRU").classList.toggle("active", LANG === "ru");

    // Reset to appropriate starting letter
    currentLetter = LANG === "ru" ? "А" : "A";
    
    // Update continent for continent mode
    if (selectionType === "continent") {
      const continentMap = {
        "Africa": "Африка",
        "Antarctica": "Антарктида",
        "Asia": "Азия",
        "Europe": "Европа",
        "North America": "Северная Америка",
        "Oceania": "Океания",
        "South America": "Южная Америка"
      };
      const reverseContinentMap = Object.fromEntries(
        Object.entries(continentMap).map(([k, v]) => [v, k])
      );
      
      currentContinent = LANG === "ru" 
        ? continentMap[currentContinent] 
        : reverseContinentMap[currentContinent];
    }

    buildIndex();
    buildLetters();
    buildContinents();
    resetRound(false);
    updateUI();
  };

  $("startBtn").onclick  = startRound;
  $("resetBtn").onclick  = () => { resetRound(true); updateUI(); };
  $("submitBtn").onclick = submitAnswer;
  $("revealBtn").onclick = revealMissed;

  $("answerInput").addEventListener("keydown", e => { if (e.key === "Enter") submitAnswer(); });

  updateUI();
})();

// ── PWA install and offline support ────────────────────
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = document.getElementById("installBtn");
  if (btn) btn.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById("installBtn");
  if (btn) btn.hidden = true;
});

document.addEventListener("click", async event => {
  if (event.target?.id !== "installBtn") return;
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  event.target.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
