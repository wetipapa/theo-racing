"use strict";
/* ============================================================
   웨티아빠의 구구단 레이싱 - 단순 2D 탑뷰 캔버스 레이싱 게임
   HTML/CSS/JS + Canvas만 사용, 외부 라이브러리 없음
   ============================================================ */

/* ---------- 캐릭터 정의 ----------
   ※ 곱셈 실력이 순위를 가르도록, 캐릭터 간 기본 속도(speedMul)는 전부 동일하게 두고
   코너링/충돌/아이템운/시간보너스 같은 "잔재주"만 다르게 준다. */
const CHARACTERS = [
  { id:"blaze",  name:"블레이즈", color:"#ff4d4d", desc:"특별한 강점·약점 없는 기본형",             speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:1.0, timeBonus:0 },
  { id:"nova",   name:"노바",     color:"#3aa0ff", desc:"코너링과 좌우 이동이 좋음",                 speedMul:1.00, turnMul:1.35, collisionMul:1.0, itemLuck:1.0, timeBonus:0 },
  { id:"bulldog",name:"불도그",   color:"#8a6d3b", desc:"무거워서 부딪혀도 덜 느려짐",               speedMul:1.00, turnMul:0.90, collisionMul:0.45,itemLuck:1.0, timeBonus:0 },
  { id:"comet",  name:"코멧",     color:"#3ecf5f", desc:"속도와 조작이 균형잡힌 기본형",             speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:1.0, timeBonus:0 },
  { id:"lucky",  name:"럭키",     color:"#a259ff", desc:"아이템 상자에서 좋은 아이템이 잘 나옴",     speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:2.2, timeBonus:0 },
  { id:"prof",   name:"교수",     color:"#ff9f1c", desc:"곱셈 문제 제한시간이 1초 더 김",            speedMul:1.00, turnMul:1.00, collisionMul:1.0, itemLuck:1.0, timeBonus:1 },
];

const DIFFICULTIES = [
  { id:"2-3", label:"2 · 3단", tables:[2,3] },
  { id:"4-5", label:"4 · 5단", tables:[4,5] },
  { id:"6-7", label:"6 · 7단", tables:[6,7] },
  { id:"8-9", label:"8 · 9단", tables:[8,9] },
  { id:"all", label:"전체(2~9단)", tables:[2,3,4,5,6,7,8,9] },
];

const MODES = [
  { id:"easy", label:"🐢 이지모드", desc:"곱셈 문제를 여유롭게 풀 수 있어요", timeLimited:false },
  { id:"hard", label:"🔥 하드모드", desc:"곱셈 문제 시간제한 있음 (기존 방식)", timeLimited:true },
];

/* ---------- 트랙 수학 (직선 2개 + 반원 커브 2개로 이어진 폐곡선 "타원형" 트랙) ----------
   좌/우 직선을 위/아래 반원 커브로 매끄럽게 이어붙인 완전한 폐곡선이다.
   s=0(출발선)과 s=L(결승선)이 물리적으로 정확히 같은 지점·같은 진행방향이라서
   한 바퀴를 다 돌아 다시 s=0으로 넘어갈 때 화면이 튀거나 끊기지 않고 매끄럽게 이어진다.
   (예전 버전은 완전한 직선이라 결승선→출발선이 순간이동이었고, 그래서 "길이 끊긴다"는
   문제가 있었다. 폐곡선으로 바꾸면서 커브도 자연스럽게 추가된다.)
   카메라는 항상 "플레이어의 진행방향"이 화면 위쪽을 향하도록 회전한다(운전자 시점). */
const TRACK = {
  cx: 320, cy: 450,
  straightLen: 420,   // 좌/우 직선 구간 길이
  radius: 150,         // 위/아래 반원 커브의 반지름
  halfWidth: 48,       // 도로 절반 폭 (그리기용, 이탈 판정에도 사용)
};
TRACK.halfCirc = Math.PI * TRACK.radius;              // 반원 커브 하나의 길이
TRACK.L = TRACK.straightLen * 2 + TRACK.halfCirc * 2; // 트랙(한 바퀴) 길이

function mod(x, m) { return ((x % m) + m) % m; }

// s(진행거리, 0~L) -> 트랙 중심선 좌표 {x,y}.
// 구간 순서: [우측 직선(상행)] -> [위쪽 반원] -> [좌측 직선(하행)] -> [아래쪽 반원] -> (한 바퀴 완료, s=0과 동일 지점으로 복귀)
function trackPos(s) {
  const T = TRACK;
  s = mod(s, T.L);
  const rightX = T.cx + T.radius, leftX = T.cx - T.radius;
  const topY = T.cy - T.straightLen / 2, bottomY = T.cy + T.straightLen / 2;

  if (s < T.straightLen) {
    return { x: rightX, y: bottomY - s };
  }
  s -= T.straightLen;
  if (s < T.halfCirc) {
    const angle = -(s / T.halfCirc) * Math.PI; // 0 -> -π (우측에서 위를 거쳐 좌측으로)
    return { x: T.cx + T.radius * Math.cos(angle), y: topY + T.radius * Math.sin(angle) };
  }
  s -= T.halfCirc;
  if (s < T.straightLen) {
    return { x: leftX, y: topY + s };
  }
  s -= T.straightLen;
  const angle = Math.PI - (s / T.halfCirc) * Math.PI; // π -> 0 (좌측에서 아래를 거쳐 우측으로)
  return { x: T.cx + T.radius * Math.cos(angle), y: bottomY + T.radius * Math.sin(angle) };
}

// s -> 그 지점의 진행방향(dx,dy: 단위 탄젠트)과 좌우 오프셋용 법선(nx,ny), heading(라디안)
// 직선/커브 어디서나 같은 공식이 적용되도록 접선벡터에서 법선을 유도한다.
function trackFrame(s) {
  const T = TRACK;
  s = mod(s, T.L);
  let dx, dy;

  if (s < T.straightLen) {
    dx = 0; dy = -1; // 우측 직선: 위로
  } else if ((s -= T.straightLen) < T.halfCirc) {
    const angle = -(s / T.halfCirc) * Math.PI;
    dx = Math.sin(angle); dy = -Math.cos(angle);
  } else if ((s -= T.halfCirc) < T.straightLen) {
    dx = 0; dy = 1; // 좌측 직선: 아래로
  } else {
    s -= T.straightLen;
    const angle = Math.PI - (s / T.halfCirc) * Math.PI;
    dx = Math.sin(angle); dy = -Math.cos(angle);
  }

  const heading = Math.atan2(dy, dx);
  const nx = -dy, ny = dx; // 진행방향 기준 "오른쪽"(입력의 right가 이 방향으로 이동)
  return { dx, dy, nx, ny, heading };
}

// s(거리), offset(좌우 오프셋) -> 월드 좌표 및 heading (카메라 적용 전, 트랙 기준 좌표)
function carWorldPos(s, offset) {
  const p = trackPos(s);
  const f = trackFrame(s);
  return { x: p.x + f.nx * offset, y: p.y + f.ny * offset, heading: f.heading };
}

// 트랙 중심선을 따라 촘촘히 샘플링한 폐곡선 경로(도로 그리기·중앙선 그리기에 재사용)
function buildTrackPath() {
  const steps = 240;
  const path = new Path2D();
  for (let i = 0; i <= steps; i++) {
    const p = trackPos((i / steps) * TRACK.L);
    if (i === 0) path.moveTo(p.x, p.y); else path.lineTo(p.x, p.y);
  }
  path.closePath();
  return path;
}
let trackPath = null;

/* ---------- 게임 상수 ---------- */
const BASE_SPEED = 62;          // 유닛/초
const STEER_SPEED = 75;         // 유닛/초 (좌우 이동 속도)
const OFFTRACK_LIMIT = 40;      // 이 값보다 오프셋이 크면 트랙 이탈
const OFFSET_CLAMP = 62;
const TOTAL_LAPS = 3;
const QUESTION_TIME = 5;         // 하드모드 제한시간(초)
const EASY_QUESTION_TIME = 18;   // 이지모드는 여유롭게 고민하되, 무한정 멈춰있지 않도록 넉넉한 상한선을 둔다
const BOOST_DURATION = 2.4; // 정답 1개당 부스터 지속시간(초)
const BOOST_SPEED_MUL = 1.5;
// 오답 페널티: 정답 보상(부스터)에 밀리지 않도록 확실히 느껴지는 세기로 조정
const WRONG_SLOW_DURATION = 2.5;
const WRONG_SLOW_FACTOR = 0.32;
const SHIELD_DURATION = 5;  // 방패는 사용한 순간부터 5초가 지나면 사라진다
const ROCKET_FLIGHT_TIME = 0.35;  // 발사~명중까지 로켓이 날아가는 시간(초)
const ROCKET_STUN_DURATION = 1.0; // 맞은 차가 멈칫하는 시간(초)
const ROCKET_STUN_FACTOR = 0.08;  // 맞은 차의 속도 배율(거의 정지)
// AI 속도 변주 폭을 좁혀서(예전보다 랜덤성 축소) 순위가 운보다 곱셈 실력에 더 좌우되게 한다
const AI_SPEED_MIN = 0.92, AI_SPEED_MAX = 1.03;
// 차량마다 고정된 좌우 "차선"을 배정해서 그 안에서만 살짝 흔들리며 달리게 한다.
// (예전엔 6대가 전부 같은 넓은 구간을 오가며 스쳐서, 위상이 비슷한 차끼리는 계속
// 서로 밀어내다가 다시 모여들며 그 자리에서 버벅이는 문제가 있었다. 차선을 나누면
// 서로 다른 차는 애초에 자주 겹치지 않아서 훨씬 자연스럽게 달린다.)
const LANE_SPACING = 13;
const LANE_WOBBLE = 7;

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
let selectedCharId = "comet";
let selectedDiffId = "2-3";
let selectedModeId = "hard";
let cars = [];
let boxes = [];
let bananas = [];
let rockets = []; // 발사되어 날아가는 중인 로켓 { from:{x,y}, target, t, duration }
let player = null;
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
const modeListEl = document.getElementById("modeList");

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

  MODES.forEach(m => {
    const card = document.createElement("div");
    card.className = "diffCard" + (m.id === selectedModeId ? " selected" : "");
    card.dataset.id = m.id;
    card.innerHTML = `<div class="charName">${m.label}</div><div class="charDesc">${m.desc}</div>`;
    card.addEventListener("click", () => {
      selectedModeId = m.id;
      [...modeListEl.children].forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
    });
    modeListEl.appendChild(card);
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
  const laneOffset = (startIndex - 2.5) * LANE_SPACING;
  return {
    char, isPlayer,
    distance: 0,        // 모든 차가 같은 출발선(s=0)에 나란히 선다
    offset: laneOffset, // 좌우로만 차선만큼 벌려서 배치(겹침 방지), 이후 AI는 이 차선을 유지하며 달린다
    laneOffset,
    lap: 1,
    finished: false,
    finishOrder: -1,
    item: null,
    shielded: false, shieldTimer: 0,
    boosted: false, boostTimer: 0,
    hitTimer: 0, hitSlowFactor: 1, hitSource: null, impactFlashTimer: 0,
    collideTimer: 0,
    mathSlowTimer: 0,
    aiPhase: makeAiPhase(startIndex),
    aiSpeedFactor: AI_SPEED_MIN + Math.random() * (AI_SPEED_MAX - AI_SPEED_MIN),
    aiSpeedTimer: 1 + Math.random() * 2,
    aiItemDelay: 0,
  };
}

// 배열을 무작위로 섞는다 (Fisher-Yates) — 특정 캐릭터가 항상 같은 출발 위치를 갖지 않도록
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startRace() {
  const diff = DIFFICULTIES.find(d => d.id === selectedDiffId);
  const playerChar = CHARACTERS.find(c => c.id === selectedCharId);
  // 캐릭터 배열 순서대로 출발 위치를 고정하면 특정 캐릭터가 매번 같은 위치 이점을 갖게 되므로,
  // AI 출발 순서를 매 레이스마다 무작위로 섞어 공평하게 만든다.
  const aiChars = shuffled(CHARACTERS.filter(c => c.id !== selectedCharId));

  cars = [];
  player = createCar(playerChar, true, 0);
  cars.push(player);
  aiChars.forEach((c, i) => cars.push(createCar(c, false, i + 1)));

  boxes = BOX_LAYOUT.map(b => ({
    type: b.type, s: b.frac * TRACK.L, offset: b.offset,
    active: true, respawnTimer: 0,
  }));
  bananas = [];
  rockets = [];

  raceStats = { total: 0, correct: 0, wrongList: [] };
  mathPopupActive = false;
  raceEnding = false;
  finishOrderCounter = 0;
  currentDifficulty = diff;
  currentMode = MODES.find(m => m.id === selectedModeId);

  updateItemUI();
  document.getElementById("boostBanner").classList.add("hidden");
  document.getElementById("slowBanner").classList.add("hidden");
  document.getElementById("finishBanner").classList.add("hidden");
  hideMathPopup(true);

  showScreen("race");
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

let currentDifficulty = DIFFICULTIES[0];
let currentMode = MODES.find(m => m.id === selectedModeId);

/* ============================================================
   화면 전환
   ============================================================ */
function showScreen(name) {
  screenName = name;
  document.getElementById("tutorialScreen").classList.toggle("hidden", name !== "tutorial");
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

  // 곱셈 문제 타이머. 이지모드도 "시간제한 없음"이 아니라 아주 넉넉한 상한선을 두어서,
  // 오래 고민하더라도 결국 레이싱 화면으로 돌아오도록 한다(무한정 멈춰있는 문제 방지).
  // 하드모드만 눈에 보이는 압박 타이머 바를 채워서 보여준다.
  if (mathPopupActive && !questionAnswered) {
    questionTimeLeft -= dt;
    if (currentMode.timeLimited) {
      const pct = Math.max(0, questionTimeLeft / currentQuestion.timeLimit) * 100;
      document.getElementById("mathTimerFill").style.width = pct + "%";
    }
    if (questionTimeLeft <= 0) resolveQuestion(null);
  }

  cars.forEach(car => updateCar(car, dt));
  handleCarCollisions();
  updateBoxRespawns(dt);
  updateRockets(dt);

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
    // 자기 차선(laneOffset)을 중심으로 살짝만 흔들며 달린다(차선 자체가 다르므로
    // 다른 차와 계속 겹칠 일이 적고, 자연스럽게 앞지르기 할 때만 스친다)
    const target = car.laneOffset + Math.sin(car.distance * 0.008 + car.aiPhase) * LANE_WOBBLE;
    car.offset += (target - car.offset) * Math.min(1, dt * 2.2);
  }
  car.offset = Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, car.offset));

  const offTrack = Math.abs(car.offset) > OFFTRACK_LIMIT;

  // --- 타이머 감소 ---
  if (car.hitTimer > 0) car.hitTimer -= dt;
  if (car.impactFlashTimer > 0) car.impactFlashTimer -= dt;
  if (car.collideTimer > 0) car.collideTimer -= dt;
  if (car.mathSlowTimer > 0) car.mathSlowTimer -= dt;
  if (car.boostTimer > 0) { car.boostTimer -= dt; if (car.boostTimer <= 0) car.boosted = false; }
  if (car.shielded) { car.shieldTimer -= dt; if (car.shieldTimer <= 0) car.shielded = false; }

  // --- AI 속도 변주 ---
  if (!car.isPlayer) {
    car.aiSpeedTimer -= dt;
    if (car.aiSpeedTimer <= 0) {
      car.aiSpeedFactor = AI_SPEED_MIN + Math.random() * (AI_SPEED_MAX - AI_SPEED_MIN);
      car.aiSpeedTimer = 1.5 + Math.random() * 2;
    }
  }

  // --- 속도 계산 ---
  let speed = BASE_SPEED * car.char.speedMul;
  if (!car.isPlayer) speed *= car.aiSpeedFactor;
  if (car.boosted) speed *= BOOST_SPEED_MUL;
  if (offTrack) speed *= 0.5;
  if (car.hitTimer > 0) speed *= car.hitSlowFactor;
  if (car.mathSlowTimer > 0) speed *= WRONG_SLOW_FACTOR;
  if (car.collideTimer > 0) speed *= 0.6;
  speed = Math.max(speed, BASE_SPEED * 0.18);
  // 이지모드(시간제한 없음)는 문제를 푸는 동안 모든 차를 완전히 멈춰서(레이스 자체를 일시정지) 여유롭게 고민할 수 있게 한다
  if (mathPopupActive && !currentMode.timeLimited) speed = 0;

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

// 발사된 로켓을 목표 차량 쪽으로 날아가게 하고, 도착하면 명중 효과를 적용한다
function updateRockets(dt) {
  rockets = rockets.filter(r => {
    r.t += dt;
    if (r.t >= r.duration) {
      if (!r.target.finished) hitCar(r.target, "rocket");
      return false;
    }
    return true;
  });
}

function handleCarCollisions() {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.finished || b.finished) continue;
      if (a.boosted || b.boosted) continue;
      // AI끼리는 서로 부딪혀 밀어내지 않는다. 6대가 좁은 도로를 나눠 쓰다 보면 AI 두세 대가
      // 계속 서로 밀어내다 다시 모여들며 그 자리에서 버벅이는 문제가 있었는데, AI-AI 충돌을
      // 없애면 그 문제가 근본적으로 사라진다(플레이어가 낀 충돌은 게임성을 위해 그대로 둔다).
      if (!a.isPlayer && !b.isPlayer) continue;
      if (circDist(a.s, b.s) < 18 && Math.abs(a.offset - b.offset) < 24) {
        const dir = a.offset <= b.offset ? -1 : 1;

        if (a.shielded !== b.shielded) {
          // 방패 든 차는 범퍼처럼 튼튼해서 안 밀리고, 부딪힌 상대 차만 옆으로 세게 튕겨나간다
          const bumped = a.shielded ? b : a;
          const bumpDir = a.shielded ? -dir : dir;
          bumped.offset += bumpDir * 10;
          bumped.offset = Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, bumped.offset));
          bumped.collideTimer = Math.max(bumped.collideTimer, 0.4);
        } else {
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

  if (item === "shield") {
    car.item = null;
    car.shielded = true;
    car.shieldTimer = SHIELD_DURATION;
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
  } else if (item === "banana") {
    car.item = null;
    bananas.push({ s: mod(car.distance - 16, TRACK.L), offset: car.offset, active: true });
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
  } else if (item === "rocket") {
    // 앞차만 맞히던 예전 방식은 앞에 아무도 없으면 로켓을 계속 들고만 있어야 하는
    // 문제가 있었다. 이제는 앞/뒤 상관없이 트랙에서 가장 가까운 상대를 조준해서
    // 쏘는 즉시 무조건 발사(아이템 소비)되도록 바꿨다.
    car.item = null;
    if (car.isPlayer) { updateItemUI(); playSound("item"); }

    let target = null, best = Infinity;
    cars.forEach(other => {
      if (other === car || other.finished) return;
      const d = circDist(car.s, other.s);
      if (d < best) { best = d; target = other; }
    });
    if (target) {
      rockets.push({ from: { x: car.worldX, y: car.worldY }, target, t: 0, duration: ROCKET_FLIGHT_TIME });
    }
    // 명중시킬 상대가 아예 없는 극단적인 경우(레이스 막판 혼자 남음)에는 그냥 허공으로 사라진다
  }
}

function hitCar(car, source) {
  if (car.boosted) return;
  if (car.shielded) { car.shielded = false; return; }
  car.hitSource = source;
  car.impactFlashTimer = 0.25;
  if (source === "rocket") {
    car.hitTimer = ROCKET_STUN_DURATION;
    car.hitSlowFactor = ROCKET_STUN_FACTOR; // 거의 멈춰버릴 정도로 확실하게 느려짐
  } else {
    car.hitTimer = 1.0;
    car.hitSlowFactor = 0.3; // 바나나는 미끄러지는 정도
  }
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
  // 하드모드는 짧고 빡빡한 제한시간, 이지모드는 여유롭지만 그래도 유한한 상한선을 준다.
  const baseTime = currentMode.timeLimited ? QUESTION_TIME : EASY_QUESTION_TIME;
  currentQuestion.timeLimit = baseTime + car.char.timeBonus;
  questionTimeLeft = currentQuestion.timeLimit;

  document.getElementById("mathQuestion").textContent = `${currentQuestion.text} = ?`;
  const btns = document.querySelectorAll(".answerBtn");
  btns.forEach((btn, i) => {
    btn.textContent = currentQuestion.choices[i];
    btn.disabled = false;
  });
  document.getElementById("mathResult").classList.add("hidden");
  // 압박감 있는 타이머 바는 하드모드에서만 보여준다(이지모드는 여유롭게 고민하는 느낌 유지)
  document.getElementById("mathTimerBar").classList.toggle("hidden", !currentMode.timeLimited);
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

  // 차량 효과(부스터/감속)는 바로 적용해서 팝업이 닫히자마자 효과가 시작되게 하고,
  // 배너/효과음 같은 "확실히 보이는" 연출은 팝업이 닫힌 뒤(showRaceFeedback)로 미룬다.
  // 팝업이 열려있는 동안 배너를 띄우면 어두운 팝업 배경에 가려 안 보이기 때문.
  if (isCorrect) {
    playSound("correct");
    resultEl.textContent = `정답이에요! 🎉 정답은 ${currentQuestion.correct}`;
    activateBooster(player);
  } else {
    playSound("wrong");
    resultEl.textContent = `아깝다! 정답은 ${currentQuestion.correct}`;
    player.mathSlowTimer = WRONG_SLOW_DURATION;
  }

  document.querySelectorAll(".answerBtn").forEach(b => b.disabled = true);
  setTimeout(() => { hideMathPopup(); showRaceFeedback(isCorrect); }, 800);
}

function hideMathPopup(instant) {
  mathPopupActive = false;
  document.getElementById("mathPopup").classList.add("hidden");
}

// 팝업이 닫힌 직후 레이싱 화면에서 부스터/감속을 눈에 띄게 알려주는 배너
function showRaceFeedback(isCorrect) {
  if (isCorrect) {
    playSound("boost");
    const banner = document.getElementById("boostBanner");
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), BOOST_DURATION * 1000);
  } else {
    const banner = document.getElementById("slowBanner");
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), 1500);
  }
}

function activateBooster(car) {
  car.boosted = true;
  car.boostTimer = BOOST_DURATION;
  car.shielded = false;
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

const ITEM_NAMES = { banana: "🍌 바나나", rocket: "🚀 로켓", shield: "🛡️ 방패" };
function updateItemUI() {
  document.getElementById("itemText").textContent = player.item ? ITEM_NAMES[player.item] : "없음";
}

/* ============================================================
   렌더링
   ============================================================ */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 카메라 설정: 트랙에 커브가 생겼으므로, 플레이어의 진행방향이 항상 화면 위쪽을
// 향하도록 카메라를 회전시킨다(운전자 시점의 회전 추적 카메라). 이렇게 하면
// 좌/우 조작이 트랙 어디서든(직선이든 커브든) 항상 화면의 좌/우와 일치한다.
const CAMERA = { focusYRatio: 0.68, zoom: 1.2 };

function applyCameraTransform() {
  const focusX = canvas.width / 2;
  const focusY = canvas.height * CAMERA.focusYRatio;
  const centerPos = trackPos(player.s); // 오프셋 무시한 중심선 위치(좌우 흔들림 없이 부드럽게 스크롤)
  const heading = trackFrame(player.s).heading;

  ctx.translate(focusX, focusY);
  ctx.rotate(-(heading + Math.PI / 2)); // 진행방향이 화면 위쪽(−y)을 향하도록 회전
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

  drawRockets();

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
  if (!trackPath) trackPath = buildTrackPath();

  // 트랙 중심선을 따라 일정한 폭으로 선을 그려서 직선·커브가 하나로 매끄럽게 이어진
  // 폐곡선 도로를 만든다(구간마다 따로 그리지 않으므로 이어붙는 자국이 없다).
  ctx.save();
  ctx.strokeStyle = "#8d8d95";
  ctx.lineWidth = TRACK.halfWidth * 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(trackPath);

  // 중앙 점선
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke(trackPath);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawFinishLine() {
  const T = TRACK;
  // 폐곡선 트랙이라 출발선=결승선이 물리적으로 같은 한 지점(s=0)뿐이다.
  const p = trackPos(0);
  const f = trackFrame(0);
  const h = 10, cols = 4;
  const colW = (T.halfWidth * 2) / cols;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(f.heading + Math.PI / 2); // 로컬 x축을 진행방향과 수직(도로를 가로지르는 방향)으로 맞춘다
  for (let c = 0; c < cols; c++) {
    ctx.fillStyle = (c % 2 === 0) ? "#222" : "#fff";
    ctx.fillRect(-T.halfWidth + c * colW, -h / 2, colW, h);
  }
  ctx.restore();
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

// 발사되어 목표를 향해 날아가는 중인 로켓을 그린다
function drawRockets() {
  rockets.forEach(r => {
    const t = Math.min(1, r.t / r.duration);
    const x = r.from.x + (r.target.worldX - r.from.x) * t;
    const y = r.from.y + (r.target.worldY - r.from.y) * t;
    const heading = Math.atan2(r.target.worldY - r.from.y, r.target.worldX - r.from.x);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚀", 0, 0);
    ctx.restore();
  });
}

function drawCar(car) {
  const w = 22, h = 14;

  ctx.save();
  ctx.translate(car.worldX, car.worldY);
  ctx.rotate(car.heading);

  // 부스터 발광 효과 (밝고 화려한 무지개색 - 정답 보상)
  if (car.boosted) {
    const glowR = 22 + Math.sin(performance.now() / 60) * 4;
    const hue = (performance.now() / 5) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.45)`;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }
  // 감속 효과 (칙칙한 회색 연기 - 오답 페널티나 바나나에 미끄러진 경우, 부스터와 확실히 구분)
  if (car.mathSlowTimer > 0 || (car.hitTimer > 0 && car.hitSource === "banana")) {
    const wobble = Math.sin(performance.now() / 90) * 3;
    ctx.fillStyle = "rgba(120,120,120,0.5)";
    ctx.beginPath();
    ctx.arc(-w / 2 - 4 + wobble, 0, 8, 0, Math.PI * 2);
    ctx.arc(-w / 2 - 12 - wobble, -4, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // 로켓 피격 효과 (머리 위에서 빙글빙글 도는 별 - 잠깐 멈칫하는 느낌)
  if (car.hitTimer > 0 && car.hitSource === "rocket") {
    const spin = performance.now() / 140;
    ctx.fillStyle = "#ffd166";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let k = 0; k < 3; k++) {
      const ang = spin + k * (Math.PI * 2 / 3);
      ctx.fillText("★", Math.cos(ang) * 12, -16 + Math.sin(ang) * 4);
    }
  }
  // 피격 직후 짧은 하얀 충격 플래시
  if (car.impactFlashTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(car.impactFlashTimer / 0.25) * 0.8})`;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
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

document.getElementById("tutorialNextBtn").addEventListener("click", () => {
  ensureAudio();
  showScreen("start");
});
document.getElementById("tutorialAgainBtn").addEventListener("click", () => {
  showScreen("tutorial");
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
showScreen("tutorial"); // 처음엔 게임 설명 화면부터 보여준다
