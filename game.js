"use strict";
/* ============================================================
   Theo의 구구단 레이싱 - 단순 2D 탑뷰 캔버스 레이싱 게임
   HTML/CSS/JS + Canvas만 사용, 외부 라이브러리 없음
   ============================================================ */

/* ---------- 캐릭터 정의 ---------- */
const CHARACTERS = [
  { id:"theo",   name:"Theo",   color:"#ff4d4d", desc:"최고 속도가 빠름 (충돌시 더 많이 느려짐)", speedMul:1.16, turnMul:1.00, collisionMul:1.6, itemLuck:1.0, timeBonus:0 },
  { id:"jj",     name:"JJ",     color:"#3aa0ff", desc:"코너링과 좌우 이동이 좋음",                 speedMul:1.00, turnMul:1.35, collisionMul:1.0, itemLuck:1.0, timeBonus:0 },
  { id:"stucob", name:"STUCOB", color:"#8a6d3b", desc:"무거워서 부딪혀도 덜 느려짐",               speedMul:0.96, turnMul:0.90, collisionMul:0.45,itemLuck:1.0, timeBonus:0 },
  { id:"mj",     name:"MJ",     color:"#3ecf5f", desc:"속도와 조작이 균형잡힌 기본형",             speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:1.0, timeBonus:0 },
  { id:"jayce",  name:"Jayce",  color:"#a259ff", desc:"아이템 상자에서 좋은 아이템이 잘 나옴",     speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:2.2, timeBonus:0 },
  { id:"cho",    name:"Cho",    color:"#ff9f1c", desc:"곱셈 문제 제한시간이 1초 더 김",            speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:1.0, timeBonus:1 },
];

const DIFFICULTIES = [
  { id:"2-3", label:"2 · 3단", tables:[2,3] },
  { id:"4-5", label:"4 · 5단", tables:[4,5] },
  { id:"6-7", label:"6 · 7단", tables:[6,7] },
  { id:"8-9", label:"8 · 9단", tables:[8,9] },
  { id:"all", label:"전체(2~9단)", tables:[2,3,4,5,6,7,8,9] },
];

/* ---------- 트랙 수학 (직선 - 아래에서 위로) ----------
   회전 코너 없이 완전히 곧은 세로 트랙. 진행방향이 항상 "위"로 고정되므로
   카메라도 절대 회전하지 않고, 오른쪽/왼쪽 키가 트랙 어디서든 항상
   화면의 오른쪽/왼쪽과 정확히 일치한다. 결승선(맨 위)을 통과하면
   다시 출발선(맨 아래)으로 이어지며 다음 바퀴가 시작된다. */
const TRACK = {
  cx: 320, cy: 450,
  L: 1600,              // 트랙(한 바퀴) 길이
  halfWidth: 48,         // 도로 절반 폭 (그리기용, 이탈 판정에도 사용)
};

function mod(x, m) { return ((x % m) + m) % m; }

// s(진행거리, 0~L) -> 트랙 중심선 좌표 {x,y}. s=0이 출발선(맨 아래), s=L이 결승선(맨 위).
function trackPos(s) {
  const T = TRACK;
  s = mod(s, T.L);
  return { x: T.cx, y: (T.cy + T.L / 2) - s };
}

// 진행방향은 항상 "위"로 고정 (직선 트랙이라 회전이 필요 없다)
function trackFrame() {
  return { dx: 0, dy: -1, nx: 1, ny: 0, heading: -Math.PI / 2 };
}

// s(거리), offset(좌우 오프셋) -> 월드 좌표 및 heading (카메라 적용 전, 트랙 기준 좌표)
function carWorldPos(s, offset) {
  const p = trackPos(s);
  const f = trackFrame();
  return { x: p.x + f.nx * offset, y: p.y + f.ny * offset, heading: f.heading };
}

/* ---------- 게임 상수 ---------- */
const BASE_SPEED = 62;          // 유닛/초
const STEER_SPEED = 75;         // 유닛/초 (좌우 이동 속도)
const OFFTRACK_LIMIT = 40;      // 이 값보다 오프셋이 크면 트랙 이탈
const OFFSET_CLAMP = 62;
const TOTAL_LAPS = 3;
const QUESTION_TIME = 5;
const BOOST_DURATION = 5;
const BOOST_SPEED_MUL = 1.4;

/* 트랙 위 상자 배치 (진행거리 비율, 좌우 오프셋) */
const BOX_LAYOUT = [
  { type:"item", frac:0.06,  offset:-14 },
  { type:"math", frac:0.16,  offset: 14 },
  { type:"item", frac:0.30,  offset: 14 },
  { type:"math", frac:0.46,  offset:-14 },
  { type:"item", frac:0.60,  offset:-14 },
  { type:"item", frac:0.72,  offset: 14 },
  { type:"math", frac:0.86,  offset:-14 },
];

/* ---------- 전역 상태 ---------- */
let selectedCharId = "mj";
let selectedDiffId = "2-3";
let cars = [];
let boxes = [];
let bananas = [];
let player = null;
let gauge = 0;
let raceStats = { total: 0, correct: 0, wrongList: [] };
let mathPopupActive = false;
let currentQuestion = null;
let questionAnswered = false;
let questionTimeLeft = 0;
let raceEnding = false;
let screenName = "start"; // start | race | result
let lastTime = 0;
let finishOrderCounter = 0;
let input = { left:false, right:false };
let muted = false;

/* ---------- 오디오 (Web Audio API, 외부 음원 없음) ---------- */
let audioCtx = null, masterGain = null;
function ensureAudio() {
  if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  } catch (e) { /* 오디오 미지원 브라우저는 무시 */ }
}
function tone(freq, dur, type, delay, vol) {
  if (!audioCtx || muted) return;
  type = type || "sine"; delay = delay || 0; vol = vol === undefined ? 0.2 : vol;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
function playSound(name) {
  if (name === "correct") { tone(880, 0.12, "sine", 0, 0.22); tone(1320, 0.16, "sine", 0.1, 0.2); }
  else if (name === "wrong") { tone(220, 0.18, "sawtooth", 0, 0.15); }
  else if (name === "item") { tone(660, 0.08, "square", 0, 0.15); tone(880, 0.08, "square", 0.08, 0.15); }
  else if (name === "boost") { tone(523, 0.1, "sine", 0, 0.2); tone(659, 0.1, "sine", 0.1, 0.2); tone(784, 0.12, "sine", 0.2, 0.2); tone(1046, 0.28, "sine", 0.32, 0.25); }
  else if (name === "finish") { tone(784, 0.15, "sine", 0, 0.2); tone(988, 0.15, "sine", 0.15, 0.2); tone(1175, 0.32, "sine", 0.3, 0.25); }
}

/* ============================================================
   시작 화면
   ============================================================ */
const charListEl = document.getElementById("charList");
const diffListEl = document.getElementById("diffList");

function buildStartScreen() {
  CHARACTERS.forEach(ch => {
    const card = document.createElement("div");
    card.className = "charCard" + (ch.id === selectedCharId ? " selected" : "");
    card.dataset.id = ch.id;
    card.innerHTML =
      `<div class="charSwatch" style="background:${ch.color}"></div>` +
      `<div class="charName">${ch.name}</div>` +
      `<div class="charDesc">${ch.desc}</div>`;
    card.addEventListener("click", () => {
      selectedCharId = ch.id;
      [...charListEl.children].forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    });
    charListEl.appendChild(card);
  });

  DIFFICULTIES.forEach(d => {
    const card = document.createElement("div");
    card.className = "diffCard" + (d.id === selectedDiffId ? " selected" : "");
    card.dataset.id = d.id;
    card.innerHTML = `<div class="charName">${d.label}</div>`;
    card.addEventListener("click", () => {
      selectedDiffId = d.id;
      [...diffListEl.children].forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    });
    diffListEl.appendChild(card);
  });

  document.getElementById("startBtn").addEventListener("click", () => {
    ensureAudio();
    startRace();
  });
}

/* ============================================================
   레이스 준비
   ============================================================ */
function makeAiPhase(i) { return i * 1.7 + Math.random() * 2; }

function createCar(char, isPlayer, startIndex) {
  return {
    char, isPlayer,
    distance: -startIndex * 24,   // 출발선에서 약간씩 다르게 배치(겹침 방지)
    offset: (startIndex - 2.5) * 9, // 트랙 중앙 근처에서 출발(이탈 방지)
    lap: 1,
    finished: false,
    finishOrder: -1,
    item: null,
    shielded: false,
    boosted: false, boostTimer: 0,
    hitTimer: 0, hitSlowFactor: 1,
    collideTimer: 0,
    mathSlowTimer: 0,
    aiPhase: makeAiPhase(startIndex),
    aiSpeedFactor: 0.92 + Math.random() * 0.14,
    aiSpeedTimer: 1 + Math.random() * 2,
    aiItemDelay: 0,
  };
}

function startRace() {
  const diff = DIFFICULTIES.find(d => d.id === selectedDiffId);
  const playerChar = CHARACTERS.find(c => c.id === selectedCharId);
  const aiChars = CHARACTERS.filter(c => c.id !== selectedCharId);

  cars = [];
  player = createCar(playerChar, true, 0);
  cars.push(player);
  aiChars.forEach((c, i) => cars.push(createCar(c, false, i + 1)));

  boxes = BOX_LAYOUT.map(b => ({
    type: b.type, s: b.frac * TRACK.L, offset: b.offset,
    active: true, respawnTimer: 0,
  }));
  bananas = [];

  gauge = 0;
  raceStats = { total: 0, correct: 0, wrongList: [] };
  mathPopupActive = false;
  raceEnding = false;
  finishOrderCounter = 0;
  currentDifficulty = diff;

  updateGaugeUI();
  updateItemUI();
  document.getElementById("boostBanner").classList.add("hidden");
  document.getElementById("finishBanner").classList.add("hidden");
  hideMathPopup(true);

  showScreen("race");
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

let currentDifficulty = DIFFICULTIES[0];

/* ============================================================
   화면 전환
   ============================================================ */
function showScreen(name) {
  screenName = name;
  document.getElementById("startScreen").classList.toggle("hidden", name !== "start");
  document.getElementById("raceScreen").classList.toggle("hidden", name !== "race");
  document.getElementById("resultScreen").classList.toggle("hidden", name !== "result");
}

/* ============================================================
   메인 루프
   ============================================================ */
function gameLoop(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  if (screenName === "race") {
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }
}

function circDist(a, b) {
  let d = Math.abs(a - b);
  return Math.min(d, TRACK.L - d);
}

function update(dt) {
  if (raceEnding) { render(); return; }

  // 곱셈 문제 타이머
  if (mathPopupActive && !questionAnswered) {
    questionTimeLeft -= dt;
    const pct = Math.max(0, questionTimeLeft / currentQuestion.timeLimit) * 100;
    document.getElementById("mathTimerFill").style.width = pct + "%";
    if (questionTimeLeft <= 0) resolveQuestion(null);
  }

  cars.forEach(car => updateCar(car, dt));
  handleCarCollisions();
  updateBoxRespawns(dt);

  // 플레이어가 결승선을 통과하면 결과 화면으로 전환
  if (player.finished && !raceEnding) {
    raceEnding = true;
    playSound("finish");
    const banner = document.getElementById("finishBanner");
    banner.textContent = "결승 도착! 🏁";
    banner.classList.remove("hidden");
    setTimeout(() => { finishRace(); }, 1400);
  }

  updateHUD();
}

function updateCar(car, dt) {
  const T = TRACK;

  // --- 좌우 조작 ---
  if (car.isPlayer) {
    if (mathPopupActive) {
      car.offset += (0 - car.offset) * Math.min(1, dt * 3);
    } else {
      const steer = STEER_SPEED * car.char.turnMul;
      if (input.left) car.offset -= steer * dt;
      if (input.right) car.offset += steer * dt;
    }
  } else if (!car.finished) {
    const target = Math.sin(car.distance * 0.008 + car.aiPhase) * 18;
    car.offset += (target - car.offset) * Math.min(1, dt * 2.2);
  }
  car.offset = Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, car.offset));

  const offTrack = Math.abs(car.offset) > OFFTRACK_LIMIT;

  // --- 타이머 감소 ---
  if (car.hitTimer > 0) car.hitTimer -= dt;
  if (car.collideTimer > 0) car.collideTimer -= dt;
  if (car.mathSlowTimer > 0) car.mathSlowTimer -= dt;
  if (car.boostTimer > 0) { car.boostTimer -= dt; if (car.boostTimer <= 0) car.boosted = false; }

  // --- AI 속도 변주 ---
  if (!car.isPlayer) {
    car.aiSpeedTimer -= dt;
    if (car.aiSpeedTimer <= 0) {
      car.aiSpeedFactor = 0.88 + Math.random() * 0.2;
      car.aiSpeedTimer = 1.5 + Math.random() * 2;
    }
  }

  // --- 속도 계산 ---
  let speed = BASE_SPEED * car.char.speedMul;
  if (!car.isPlayer) speed *= car.aiSpeedFactor;
  if (car.boosted) speed *= BOOST_SPEED_MUL;
  if (offTrack) speed *= 0.5;
  if (car.hitTimer > 0) speed *= car.hitSlowFactor;
  if (car.mathSlowTimer > 0) speed *= 0.5;
  if (car.collideTimer > 0) speed *= 0.6;
  speed = Math.max(speed, BASE_SPEED * 0.18);

  if (!car.finished) {
    car.distance += speed * dt;
    const totalDist = TOTAL_LAPS * T.L;
    if (car.distance >= totalDist) {
      car.distance = totalDist;
      car.finished = true;
      car.finishOrder = finishOrderCounter++;
    }
    car.lap = Math.min(TOTAL_LAPS, Math.floor(car.distance / T.L) + 1);
  }
  car.s = mod(car.distance, T.L);

  // 렌더링/카메라에서 재사용할 월드 좌표 & heading을 미리 계산해둔다
  const wp = carWorldPos(car.s, car.offset);
  car.worldX = wp.x; car.worldY = wp.y; car.heading = wp.heading;

  // --- 상자 충돌 ---
  boxes.forEach(box => {
    if (!box.active) return;
    if (box.type === "math" && (!car.isPlayer || mathPopupActive || car.finished)) return;
    const dS = circDist(car.s, box.s);
    const dO = Math.abs(car.offset - box.offset);
    if (dS < 11 && dO < 30) {
      if (box.type === "item") {
        if (!car.item) {
          car.item = rollItem(car.char);
          box.active = false; box.respawnTimer = 4.5;
          if (car.isPlayer) { playSound("item"); updateItemUI(); }
          if (!car.isPlayer) car.aiItemDelay = 0.5 + Math.random() * 1.2;
        }
      } else if (box.type === "math") {
        box.active = false; box.respawnTimer = 5.5;
        openMathPopup(car);
      }
    }
  });

  // --- 바나나 충돌 ---
  bananas.forEach(b => {
    if (!b.active) return;
    const dS = circDist(car.s, b.s);
    const dO = Math.abs(car.offset - b.offset);
    if (dS < 10 && dO < 26) {
      b.active = false;
      hitCar(car, "banana");
    }
  });

  // --- AI 아이템 자동 사용 ---
  if (!car.isPlayer && car.item) {
    car.aiItemDelay -= dt;
    if (car.aiItemDelay <= 0) useItem(car);
  }
}

// 상자 재생성 타이머 (모든 상자 공통, 매 프레임 별도 처리)
function updateBoxRespawns(dt) {
  boxes.forEach(b => {
    if (!b.active) {
      b.respawnTimer -= dt;
      if (b.respawnTimer <= 0) b.active = true;
    }
  });
  // 밟힌 바나나는 active=false로 남기고 매 레이스 시작 시 초기화(startRace)되므로 별도 정리 불필요
}

function handleCarCollisions() {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.finished || b.finished) continue;
      if (a.boosted || b.boosted) continue;
      if (circDist(a.s, b.s) < 18 && Math.abs(a.offset - b.offset) < 24) {
        const dir = a.offset <= b.offset ? -1 : 1;
        a.offset += dir * 3;
        b.offset -= dir * 3;
        a.offset = Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, a.offset));
        b.offset = Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, b.offset));
        a.collideTimer = Math.max(a.collideTimer, 0.3 * a.char.collisionMul);
        b.collideTimer = Math.max(b.collideTimer, 0.3 * b.char.collisionMul);
      }
    }
  }
}

/* ---------- 아이템 로직 ---------- */
function rollItem(char) {
  const w = { banana: 1, rocket: char.itemLuck, shield: char.itemLuck };
  const total = w.banana + w.rocket + w.shield;
  let r = Math.random() * total;
  if (r < w.banana) return "banana";
  r -= w.banana;
  if (r < w.rocket) return "rocket";
  return "shield";
}

function useItem(car) {
  if (!car.item) return;
  const item = car.item;
  car.item = null;
  if (car.isPlayer) updateItemUI();

  if (item === "shield") {
    car.shielded = true;
    if (car.isPlayer) playSound("item");
  } else if (item === "banana") {
    bananas.push({ s: mod(car.distance - 16, TRACK.L), offset: car.offset, active: true });
    if (car.isPlayer) playSound("item");
  } else if (item === "rocket") {
    let target = null, best = Infinity;
    cars.forEach(other => {
      if (other === car || other.finished) return;
      const d = other.distance - car.distance; // 누적거리이므로 그대로 비교(양수면 앞차)
      if (d > 0 && d < best && d < 260) { best = d; target = other; }
    });
    if (target) hitCar(target, "rocket");
    if (car.isPlayer) playSound("item");
  }
}

function hitCar(car, source) {
  if (car.boosted) return;
  if (car.shielded) { car.shielded = false; return; }
  car.hitTimer = source === "banana" ? 1.0 : 0.9;
  car.hitSlowFactor = source === "banana" ? 0.3 : 0.45;
}

function useItemInput() {
  if (screenName !== "race" || mathPopupActive || !player || player.finished) return;
  if (player.item) useItem(player);
}

/* ---------- 곱셈 문제 ---------- */
function generateQuestion() {
  const tables = currentDifficulty.tables;
  const a = tables[Math.floor(Math.random() * tables.length)];
  const b = 1 + Math.floor(Math.random() * 9);
  const correct = a * b;
  const answers = new Set([correct]);
  while (answers.size < 3) {
    const delta = (1 + Math.floor(Math.random() * 5)) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = correct + delta;
    if (candidate > 0) answers.add(candidate);
  }
  const arr = [...answers];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { a, b, correct, choices: arr, text: `${a} × ${b}` };
}

function openMathPopup(car) {
  mathPopupActive = true;
  questionAnswered = false;
  currentQuestion = generateQuestion();
  currentQuestion.timeLimit = QUESTION_TIME + car.char.timeBonus;
  questionTimeLeft = currentQuestion.timeLimit;

  document.getElementById("mathQuestion").textContent = `${currentQuestion.text} = ?`;
  const btns = document.querySelectorAll(".answerBtn");
  btns.forEach((btn, i) => {
    btn.textContent = currentQuestion.choices[i];
    btn.disabled = false;
  });
  document.getElementById("mathResult").classList.add("hidden");
  document.getElementById("mathTimerFill").style.width = "100%";
  document.getElementById("mathPopup").classList.remove("hidden");
}

function resolveQuestion(answer) {
  if (questionAnswered) return;
  questionAnswered = true;
  const isCorrect = answer === currentQuestion.correct;

  raceStats.total++;
  if (isCorrect) raceStats.correct++;
  else raceStats.wrongList.push({ text: currentQuestion.text, correct: currentQuestion.correct, chosen: answer });

  const resultEl = document.getElementById("mathResult");
  resultEl.classList.remove("hidden");

  if (isCorrect) {
    playSound("correct");
    resultEl.textContent = "정답이에요! 🎉";
    gauge++;
    updateGaugeUI();
    if (gauge >= 5) {
      gauge = 0;
      updateGaugeUI();
      activateBooster(player);
    }
  } else {
    playSound("wrong");
    resultEl.textContent = `아깝다! 정답은 ${currentQuestion.correct}`;
    player.mathSlowTimer = 1.5;
  }

  document.querySelectorAll(".answerBtn").forEach(b => b.disabled = true);
  setTimeout(() => { hideMathPopup(); }, 1300);
}

function hideMathPopup(instant) {
  mathPopupActive = false;
  document.getElementById("mathPopup").classList.add("hidden");
}

function activateBooster(car) {
  car.boosted = true;
  car.boostTimer = BOOST_DURATION;
  car.shielded = false;
  if (car.isPlayer) {
    playSound("boost");
    const banner = document.getElementById("boostBanner");
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), 1500);
  }
}

document.querySelectorAll(".answerBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    resolveQuestion(Number(btn.textContent));
  });
});

/* ============================================================
   HUD / UI 업데이트
   ============================================================ */
function computeRanks() {
  const sorted = [...cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.distance - a.distance;
  });
  sorted.forEach((c, i) => c.rank = i + 1);
  return sorted;
}

function updateHUD() {
  computeRanks();
  document.getElementById("hudRank").textContent = `순위 ${player.rank}/${cars.length}`;
  document.getElementById("hudLap").textContent = `바퀴 ${player.lap}/${TOTAL_LAPS}`;
}

function updateGaugeUI() {
  document.getElementById("gaugeText").textContent = `${gauge}/5`;
  document.getElementById("gaugeBar").style.width = (gauge / 5 * 100) + "%";
}

const ITEM_NAMES = { banana: "🍌 바나나", rocket: "🚀 로켓", shield: "🛡️ 방패" };
function updateItemUI() {
  document.getElementById("itemText").textContent = player.item ? ITEM_NAMES[player.item] : "없음";
}

/* ============================================================
   렌더링
   ============================================================ */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 카메라 설정: 회전은 절대 하지 않고, 플레이어를 따라 화면만 위/아래·좌/우로
// 이동시킨다(운전자 시점). 트랙이 완전히 곧은 세로선이라 회전이 필요 없고,
// 그 덕분에 오른쪽/왼쪽 키가 트랙 어디서든 항상 화면 오른쪽/왼쪽과 일치한다.
const CAMERA = { focusYRatio: 0.72, zoom: 1.35 };

function applyCameraTransform() {
  const focusX = canvas.width / 2;
  const focusY = canvas.height * CAMERA.focusYRatio;
  const centerPos = trackPos(player.s); // 오프셋 무시한 중심선 위치(좌우 흔들림 없이 부드럽게 스크롤)

  ctx.translate(focusX, focusY);
  ctx.scale(CAMERA.zoom, CAMERA.zoom);
  ctx.translate(-centerPos.x, -centerPos.y);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 잔디 배경
  ctx.fillStyle = "#7ec850";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  applyCameraTransform();

  drawTrack();
  drawFinishLine();
  drawBoxes();
  drawBananas();

  const ranked = [...cars].sort((a, b) => a.distance - b.distance); // 뒤에 있는 차부터 그려서 앞차가 위로
  ranked.forEach(car => drawCar(car));

  ctx.restore();

  drawMinimap();
}

// 화면 우측 상단에 전체 순위를 세로 막대로 보여주는 미니 순위표.
// 트랙이 곧은 직선이라 모양을 그대로 보여주는 미니맵보다, 각 차량의
// 전체 진행률(바퀴 포함)을 세로 막대 위 점으로 보여주는 편이 더 직관적이다.
function drawMinimap() {
  const boxW = 54, boxH = 190, pad = 12;
  const px = canvas.width - boxW - 10, py = 10;
  const lineX = px + boxW / 2;
  const top = py + pad, bottom = py + boxH - pad;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = "#4a934a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px, py, boxW, boxH, 10); else ctx.rect(px, py, boxW, boxH);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#222";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🏁", lineX, top - 2);

  ctx.strokeStyle = "#8d8d95";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lineX, bottom);
  ctx.lineTo(lineX, top);
  ctx.stroke();

  const totalDist = TOTAL_LAPS * TRACK.L;
  cars.forEach((car, i) => {
    const progress = Math.min(1, car.distance / totalDist);
    const y = bottom - progress * (bottom - top);
    const x = lineX + (i - (cars.length - 1) / 2) * 5; // 겹치지 않게 살짝 펼침
    ctx.beginPath();
    ctx.fillStyle = car.char.color;
    ctx.arc(x, y, car.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (car.isPlayer) { ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5; ctx.stroke(); }
  });

  ctx.restore();
}

function drawTrack() {
  const T = TRACK;
  const top = T.cy - T.L / 2, bottom = T.cy + T.L / 2;

  // 완전히 곧은 도로 한 줄
  ctx.fillStyle = "#8d8d95";
  ctx.fillRect(T.cx - T.halfWidth, top, T.halfWidth * 2, T.L);

  // 중앙 점선
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(T.cx, bottom);
  ctx.lineTo(T.cx, top);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFinishLine() {
  const T = TRACK;
  const xLeft = T.cx - T.halfWidth, xRight = T.cx + T.halfWidth;
  const h = 10, cols = 4;
  const colW = (xRight - xLeft) / cols;

  // 출발선(맨 아래, s=0)과 결승선(맨 위, 한 바퀴를 다 돈 지점)에 모두 체커무늬를 그린다
  [T.cy + T.L / 2, T.cy - T.L / 2].forEach(y => {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (c % 2 === 0) ? "#222" : "#fff";
      ctx.fillRect(xLeft + c * colW, y - h / 2, colW, h);
    }
  });
}

function drawBoxes() {
  boxes.forEach(box => {
    if (!box.active) return;
    const p = carWorldPos(box.s, box.offset);
    ctx.save();
    ctx.translate(p.x, p.y);
    const size = 20;
    if (box.type === "item") {
      ctx.fillStyle = "#ffd166";
      ctx.strokeStyle = "#b3800a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-size/2, -size/2, size, size, 5) : ctx.rect(-size/2,-size/2,size,size);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#8a5a00";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 1);
    } else {
      ctx.fillStyle = "#ff5e57";
      ctx.strokeStyle = "#a12a26";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-size/2, -size/2, size, size, 5) : ctx.rect(-size/2,-size/2,size,size);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("×", 0, 1);
    }
    ctx.restore();
  });
}

function drawBananas() {
  bananas.forEach(b => {
    if (!b.active) return;
    const p = carWorldPos(b.s, b.offset);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#f4d03f";
    ctx.strokeStyle = "#a67c00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  });
}

function drawCar(car) {
  const w = 22, h = 14;

  ctx.save();
  ctx.translate(car.worldX, car.worldY);
  ctx.rotate(car.heading);

  // 부스터 발광 효과
  if (car.boosted) {
    const glowR = 22 + Math.sin(performance.now() / 60) * 4;
    const hue = (performance.now() / 5) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.45)`;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }
  // 방패 효과
  if (car.shielded) {
    ctx.strokeStyle = "rgba(100,200,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = car.char.color;
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, 4); else ctx.rect(-w/2,-h/2,w,h);
  ctx.fill(); ctx.stroke();

  // 앞유리(진행방향 표시)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(w/2 - 8, -h/2 + 2, 6, h - 4, 2) : ctx.rect(w/2-8,-h/2+2,6,h-4);
  ctx.fill();

  // 플레이어 표시 (차량 자체 회전 좌표계 안에서 그려서 카메라가 돌아가도 항상 차 뒤쪽에 붙어 보임)
  if (car.isPlayer) {
    ctx.fillStyle = "#222";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", -w / 2 - 10, 0);
  }

  ctx.restore();
}

/* ============================================================
   결과 화면
   ============================================================ */
function finishRace() {
  computeRanks();
  showScreen("result");

  document.getElementById("resultRank").textContent = `최종 순위: ${player.rank}등 / ${cars.length}명`;
  const acc = raceStats.total > 0 ? Math.round((raceStats.correct / raceStats.total) * 100) : 0;
  document.getElementById("resultScore").textContent =
    `맞힌 문제: ${raceStats.correct} / ${raceStats.total} (정답률 ${acc}%)`;

  const wrongTitle = document.getElementById("wrongTitle");
  const wrongList = document.getElementById("wrongList");
  wrongList.innerHTML = "";
  if (raceStats.wrongList.length > 0) {
    wrongTitle.classList.remove("hidden");
    raceStats.wrongList.forEach(w => {
      const div = document.createElement("div");
      div.className = "wrongItem";
      const chosenText = (w.chosen === null || w.chosen === undefined) ? "시간초과" : w.chosen;
      div.textContent = `${w.text} = ${w.correct}  (내가 고른 답: ${chosenText})`;
      wrongList.appendChild(div);
    });
  } else {
    wrongTitle.classList.add("hidden");
  }
}

document.getElementById("retryBtn").addEventListener("click", () => {
  ensureAudio();
  startRace();
});
document.getElementById("homeBtn").addEventListener("click", () => {
  showScreen("start");
});

/* ============================================================
   입력 처리 (키보드 + 모바일 버튼)
   ============================================================ */
window.addEventListener("keydown", e => {
  ensureAudio();
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") input.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") input.right = true;
  if (e.key === " ") { e.preventDefault(); useItemInput(); }
  if (["ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
});
window.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") input.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") input.right = false;
});

function bindHold(el, onDown, onUp) {
  el.addEventListener("pointerdown", e => { e.preventDefault(); ensureAudio(); onDown(); });
  el.addEventListener("pointerup", e => { e.preventDefault(); onUp(); });
  el.addEventListener("pointerleave", () => onUp());
  el.addEventListener("pointercancel", () => onUp());
}
bindHold(document.getElementById("btnLeft"), () => input.left = true, () => input.left = false);
bindHold(document.getElementById("btnRight"), () => input.right = true, () => input.right = false);
document.getElementById("btnItem").addEventListener("pointerdown", e => { e.preventDefault(); ensureAudio(); useItemInput(); });

document.getElementById("muteBtn").addEventListener("click", () => {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  document.getElementById("muteBtn").textContent = muted ? "🔇" : "🔊";
});

/* ============================================================
   초기화
   ============================================================ */
buildStartScreen();
showScreen("start");
