"use strict";
/* ============================================================
   웨티 레이싱 - 단순 2D 탑뷰 캔버스 레이싱 게임
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

/* 구구단은 2~9단을 개별로 켜고 끈다. 아이마다 막히는 단이 달라서(3단은 되는데 7단만
   안 되는 식) 묶음만 고를 수 있으면 원하는 조합을 만들 수 없다.
   아래 목록은 자주 쓰는 조합을 한 번에 고르는 단축 버튼이다. */
const ALL_TABLES = [2,3,4,5,6,7,8,9];

const TABLE_PRESETS = [
  { id:"2-3", label:"2 · 3단", tables:[2,3] },
  { id:"4-5", label:"4 · 5단", tables:[4,5] },
  { id:"6-7", label:"6 · 7단", tables:[6,7] },
  { id:"8-9", label:"8 · 9단", tables:[8,9] },
  { id:"all", label:"전체", tables:[2,3,4,5,6,7,8,9] },
];

/* 고른 단을 요약 줄에 보여줄 짧은 문구로 만든다 */
function tablesLabel(tables) {
  const t = [...tables].sort((a,b) => a-b);
  if (t.length === 0) return "-";
  if (t.length === ALL_TABLES.length) return "전체";
  const preset = TABLE_PRESETS.find(p => p.tables.length === t.length && p.tables.every((x,i) => x === t[i]));
  if (preset) return preset.label;
  const isRun = t.every((x,i) => i === 0 || x === t[i-1] + 1);
  if (isRun && t.length >= 3) return `${t[0]}~${t[t.length-1]}단`;
  return t.join("·") + "단";
}

const MODES = [
  { id:"easy", label:"이지모드", short:"이지", desc:"곱셈 문제를 여유롭게 풀 수 있어요", timeLimited:false },
  { id:"hard", label:"하드모드", short:"하드", desc:"곱셈 문제를 정해진 시간 안에 풀어야 해요", timeLimited:true },
];

/* ---------- 맵(트랙) 정의 ----------
   맵마다 트랙 크기(track), 배경 테마(theme), 배경 장식(decorations),
   장애물(obstacles: 사탕 마을 전용), 낙하 구간(hazards: 우주 정거장 전용),
   안전 체크포인트(checkpoints: 우주 정거장 전용), 상자 배치(boxLayout)를 따로 갖는다.
   boxLayout은 기존과 동일하게 "이 지점에 상자 한 줄" 형태(type, frac)만 적어두면,
   실제 상자 4개(TRACK.boxRowOffsets)는 트랙 폭에 맞춰 자동으로 깔린다. 맵을 새로 추가할 때도
   이 배열에 항목 하나만 늘리면 된다(별도 클래스 불필요). */
const MAPS = [
  {
    id: "sunny", name: "햇살 공원", diffLabel: "쉬움", emoji: "🌻",
    track: { straightLen: 420, radius: 150, halfWidth: 48, wave: null },
    theme: { bg: "#7ec850", road: "#8d8d95", wrapBorder: "#4a934a" },
    boxLayout: [
      { type:"item", frac:0.06 },
      { type:"math", frac:0.16 },
      { type:"item", frac:0.30 },
      { type:"math", frac:0.46 },
      { type:"item", frac:0.60 },
      { type:"item", frac:0.72 },
      { type:"math", frac:0.86 },
    ],
    decorations: [
      { frac:0.02, offset:-100, emoji:"🌳" },
      { frac:0.02, offset: 100, emoji:"🌳" },
      { frac:0.20, offset: -95, emoji:"🌸" },
      { frac:0.20, offset:  95, emoji:"🌼" },
      { frac:0.40, offset:-100, emoji:"🌳" },
      { frac:0.40, offset: 100, emoji:"🐰" },
      { frac:0.55, offset: -95, emoji:"🐻" },
      { frac:0.55, offset:  95, emoji:"🌷" },
      { frac:0.75, offset:-100, emoji:"🌳" },
      { frac:0.75, offset: 100, emoji:"🦊" },
      { frac:0.92, offset: -90, emoji:"🌼" },
      { frac:0.92, offset:  90, emoji:"🌳" },
      { pond:true, x:320, y:450 },
      { frac:0.995, offset: -72, emoji:"🚩" },
      { frac:0.005, offset:  72, emoji:"🚩" },
    ],
  },
  {
    id: "candy", name: "사탕 마을", diffLabel: "보통", emoji: "🍭",
    track: { straightLen: 400, radius: 140, halfWidth: 40, wave: { amplitude: 24, k: 1 } },
    theme: { bg: "#ffe1f0", road: "#c9a0dc", wrapBorder: "#d15fb0" },
    boxLayout: [
      { type:"item", frac:0.06 },
      { type:"math", frac:0.14 },
      { type:"item", frac:0.24 },
      { type:"math", frac:0.36 },
      { type:"item", frac:0.50 },
      { type:"item", frac:0.62 },
      { type:"math", frac:0.90 },
    ],
    obstacles: {
      syrups: [
        { frac:0.18, offset:-10 },
        { frac:0.42, offset: 10 },
        { frac:0.68, offset:-10 },
      ],
      lollipops: [
        { frac:0.30, offset:  8 },
        { frac:0.80, offset: -8 },
      ],
    },
    decorations: [
      { frac:0.03, offset:-90, emoji:"🍩" },
      { frac:0.10, offset: 88, emoji:"🍭" },
      { frac:0.22, offset:-85, emoji:"🍬" },
      { frac:0.35, offset: 88, emoji:"🍩" },
      { frac:0.48, offset:-88, emoji:"🍫" },
      { frac:0.58, offset: 85, emoji:"🍬" },
      { frac:0.72, offset:-88, emoji:"🍭" },
      { frac:0.86, offset: 85, emoji:"🍩" },
      { frac:0.95, offset:-85, emoji:"🍬" },
    ],
  },
  {
    id: "space", name: "우주 정거장", diffLabel: "어려움", emoji: "🚀",
    track: { straightLen: 400, radius: 95, halfWidth: 44, wave: null },
    theme: { bg: "#0b1030", road: "#4a4a6a", wrapBorder: "#2a2f5c" },
    boxLayout: [
      { type:"item", frac:0.06 },
      { type:"math", frac:0.16 },
      { type:"item", frac:0.28 },
      { type:"math", frac:0.40 },
      { type:"item", frac:0.50 },
      { type:"item", frac:0.74 },
      { type:"math", frac:0.96 },
    ],
    hazards: [
      { fracStart:0.60, fracEnd:0.665, safeHalf:16, kind:"bridge" },
      { fracStart:0.84, fracEnd:0.90,  kind:"fork", laneCenter:22, laneHalf:11 },
    ],
    checkpoints: [0, 0.30, 0.55, 0.78],
    decorations: [
      { frac:0.05, offset:-100, emoji:"⭐" },
      { frac:0.08, offset: 100, emoji:"🪐" },
      { frac:0.18, offset: -95, emoji:"⭐" },
      { frac:0.25, offset:  95, emoji:"✨" },
      { frac:0.33, offset:-100, emoji:"🌟" },
      { frac:0.45, offset:  95, emoji:"⭐" },
      { frac:0.50, offset: -90, emoji:"🪐" },
      { frac:0.72, offset: 100, emoji:"⭐" },
      { frac:0.78, offset: -95, emoji:"✨" },
      { frac:0.92, offset:  90, emoji:"🌟" },
      { frac:0.97, offset:-100, emoji:"⭐" },
    ],
  },
];

/* ---------- 트랙 수학 (직선 2개 + 반원 커브 2개로 이어진 폐곡선 "타원형" 트랙) ----------
   좌/우 직선을 위/아래 반원 커브로 매끄럽게 이어붙인 완전한 폐곡선이다.
   s=0(출발선)과 s=L(결승선)이 물리적으로 정확히 같은 지점·같은 진행방향이라서
   한 바퀴를 다 돌아 다시 s=0으로 넘어갈 때 화면이 튀거나 끊기지 않고 매끄럽게 이어진다.
   (예전 버전은 완전한 직선이라 결승선→출발선이 순간이동이었고, 그래서 "길이 끊긴다"는
   문제가 있었다. 폐곡선으로 바꾸면서 커브도 자연스럽게 추가된다.)
   카메라는 항상 "플레이어의 진행방향"이 화면 위쪽을 향하도록 회전한다(운전자 시점).

   맵마다 트랙 크기가 다르므로 TRACK은 레이스 시작 시 선택한 맵으로 새로 만든다(applyMap).
   사탕 마을은 직선 구간에 좌우로 살짝 흔들리는 "물결(wave)"을 더해서 S자 커브를 만든다.
   물결 함수는 직선의 양 끝(u=0, u=straightLen)에서 값과 기울기가 모두 0이 되도록 설계해서
   반원 커브와 이어지는 지점에서 위치·진행방향이 매끄럽게 붙는다(카메라가 갑자기 꺾이지 않음). */
let TRACK = null;
let currentMap = MAPS[0];
let trackPath = null;

// 기존 햇살 공원 수치(이탈선 40 / 클램프 62 / 상자열 -30,-10,10,30, 전부 halfWidth 48 기준)를
// 비율로 남겨서, 맵마다 도로 폭이 달라도 같은 "느낌"으로 자동 스케일되게 한다.
const OFFTRACK_RATIO = 40 / 48;
const OFFSET_CLAMP_RATIO = 62 / 48;
const BOX_ROW_RATIOS = [-30 / 48, -10 / 48, 10 / 48, 30 / 48];

function applyMap(map) {
  currentMap = map;
  TRACK = {
    cx: 320, cy: 450,
    straightLen: map.track.straightLen,
    radius: map.track.radius,
    halfWidth: map.track.halfWidth,
    wave: map.track.wave || null,
  };
  TRACK.halfCirc = Math.PI * TRACK.radius;
  TRACK.L = TRACK.straightLen * 2 + TRACK.halfCirc * 2;
  TRACK.offTrackLimit = TRACK.halfWidth * OFFTRACK_RATIO;
  TRACK.offsetClamp = TRACK.halfWidth * OFFSET_CLAMP_RATIO;
  TRACK.boxRowOffsets = BOX_ROW_RATIOS.map(r => r * TRACK.halfWidth);
  trackPath = null; // 트랙 모양이 바뀌었으니 캐시된 경로를 다시 만들게 한다
}
applyMap(MAPS[0]); // 모듈 로드 시점에도 TRACK이 항상 값을 갖도록 기본 맵으로 초기화

function mod(x, m) { return ((x % m) + m) % m; }

// 직선 구간용 좌우 물결(S자 커브) 오프셋과 그 미분값.
// wave가 없으면 항상 0을 돌려줘서 기존 직선 트랙과 완전히 동일하게 동작한다.
function waveOffset(u, L, wave) {
  if (!wave) return 0;
  return wave.amplitude * Math.sin(Math.PI * u / L) * Math.sin(wave.k * 2 * Math.PI * u / L);
}
function waveDeriv(u, L, wave) {
  if (!wave) return 0;
  const A = wave.amplitude, k = wave.k;
  const s1 = Math.sin(Math.PI * u / L), c1 = Math.cos(Math.PI * u / L);
  const s2 = Math.sin(k * 2 * Math.PI * u / L), c2 = Math.cos(k * 2 * Math.PI * u / L);
  return A * ((Math.PI / L) * c1 * s2 + s1 * (k * 2 * Math.PI / L) * c2);
}

// s(진행거리, 0~L) -> 트랙 중심선 좌표 {x,y}.
// 구간 순서: [우측 직선(상행)] -> [위쪽 반원] -> [좌측 직선(하행)] -> [아래쪽 반원] -> (한 바퀴 완료, s=0과 동일 지점으로 복귀)
function trackPos(s) {
  const T = TRACK;
  s = mod(s, T.L);
  const rightX = T.cx + T.radius, leftX = T.cx - T.radius;
  const topY = T.cy - T.straightLen / 2, bottomY = T.cy + T.straightLen / 2;

  if (s < T.straightLen) {
    return { x: rightX + waveOffset(s, T.straightLen, T.wave), y: bottomY - s };
  }
  s -= T.straightLen;
  if (s < T.halfCirc) {
    const angle = -(s / T.halfCirc) * Math.PI; // 0 -> -π (우측에서 위를 거쳐 좌측으로)
    return { x: T.cx + T.radius * Math.cos(angle), y: topY + T.radius * Math.sin(angle) };
  }
  s -= T.halfCirc;
  if (s < T.straightLen) {
    return { x: leftX + waveOffset(s, T.straightLen, T.wave), y: topY + s };
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
    dx = waveDeriv(s, T.straightLen, T.wave); dy = -1; // 우측 직선: 위로 (+물결)
  } else if ((s -= T.straightLen) < T.halfCirc) {
    const angle = -(s / T.halfCirc) * Math.PI;
    dx = Math.sin(angle); dy = -Math.cos(angle);
  } else if ((s -= T.halfCirc) < T.straightLen) {
    dx = waveDeriv(s, T.straightLen, T.wave); dy = 1; // 좌측 직선: 아래로 (+물결)
  } else {
    s -= T.straightLen;
    const angle = Math.PI - (s / T.halfCirc) * Math.PI;
    dx = Math.sin(angle); dy = -Math.cos(angle);
  }

  // 물결 때문에 (dx,dy)가 더 이상 단위벡터가 아닐 수 있으므로 정규화한다
  // (정규화하지 않으면 좌우 오프셋 거리 계산이 왜곡된다).
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

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

/* ---------- 게임 상수 ---------- */
const BASE_SPEED = 62;          // 유닛/초
const STEER_SPEED = 75;         // 유닛/초 (좌우 이동 속도)
// 이탈선/클램프는 맵마다 도로 폭이 달라서 TRACK.offTrackLimit / TRACK.offsetClamp로 대체됐다(applyMap 참고)
const TOTAL_LAPS = 3;
const QUESTION_TIME = 5;         // 하드모드 제한시간(초)
const EASY_QUESTION_TIME = 18;   // 이지모드는 여유롭게 고민하되, 무한정 멈춰있지 않도록 넉넉한 상한선을 둔다
const BOOST_DURATION = 2.4; // 정답 1개당 부스터 지속시간(초)
const BOOST_SPEED_MUL = 1.5;
// 오답 페널티: 정답 보상(부스터)에 밀리지 않도록 확실히 느껴지는 세기로 조정
const WRONG_SLOW_DURATION = 2.5;
const WRONG_SLOW_FACTOR = 0.32;
// 아이템은 칸에 모아둔다. 플레이어는 3칸까지 모을 수 있고, AI는 예전처럼 1개만 들고
// 바로 쓴다(AI까지 3개를 쟁이면 바나나·로켓이 한꺼번에 쏟아져 정신없어진다).
const PLAYER_ITEM_SLOTS = 3;
const SHIELD_DURATION = 5;  // 방패는 사용한 순간부터 5초가 지나면 사라진다
const ROCKET_FLIGHT_TIME = 0.35;  // 발사~명중까지 로켓이 날아가는 시간(초)
const ROCKET_STUN_DURATION = 1.0; // 맞은 차가 멈칫하는 시간(초)
const ROCKET_STUN_FACTOR = 0.08;  // 맞은 차의 속도 배율(거의 정지)
// 신규 아이템 상수
const LIGHTNING_SLOW_DURATION = 2.0, LIGHTNING_SLOW_FACTOR = 0.4;
const BOMB_RANGE_S = 55, BOMB_RANGE_OFFSET = 55;
const BOMB_STUN_DURATION = 1.0, BOMB_SLOW_FACTOR = 0.3;
const GIANT_SCALE = 1.55, BIGCANDY_DURATION = 4.0;
// 강한 공격이 한 차량에 연속으로 집중되지 않도록, 한 번 맞으면 잠깐은 다시 맞지 않는다(충돌도 무시).
// 우주 정거장에서 낙하 후 복귀했을 때의 "충돌 보호"도 이 타이머를 그대로 재사용한다.
const HIT_PROTECTION_DURATION = 1.0;
// 사탕 마을 장애물
const SYRUP_SLOW_DURATION = 1.1, SYRUP_SLOW_FACTOR = 0.5;
const LOLLIPOP_STUN_DURATION = 0.9, LOLLIPOP_SLOW_FACTOR = 0.4, LOLLIPOP_PUSH = 16;
// 우주 정거장 낙하
const FALL_ANIM_DURATION = 1.0;
// AI가 낙하 구간/회전 막대사탕을 미리 피하려고 하는 거리(값이 클수록 더 일찍 반응)
const AI_AVOID_LOOKAHEAD = 46;
// AI 속도 변주 폭을 좁혀서(예전보다 랜덤성 축소) 순위가 운보다 곱셈 실력에 더 좌우되게 한다
const AI_SPEED_MIN = 0.92, AI_SPEED_MAX = 1.03;
// 차량마다 고정된 좌우 "차선"을 배정해서 그 안에서만 살짝 흔들리며 달리게 한다.
// (예전엔 6대가 전부 같은 넓은 구간을 오가며 스쳐서, 위상이 비슷한 차끼리는 계속
// 서로 밀어내다가 다시 모여들며 그 자리에서 버벅이는 문제가 있었다. 차선을 나누면
// 서로 다른 차는 애초에 자주 겹치지 않아서 훨씬 자연스럽게 달린다.)
const LANE_SPACING = 13;   // 맨 바깥 차선 ±32.5. 이탈선을 넘는 건 pushOffset()이 막는다
const LANE_WOBBLE = 4;     // 차 폭(14)의 절반 이하로 흔들어야 옆 차선을 침범하지 않는다
// 출발선에서는 6대가 같은 s=0에 나란히 서므로 1프레임째부터 충돌 판정이 걸린다.
// 이 시간 동안은 차끼리 밀어내지 않아서, 출발하자마자 옆으로 밀려 손해 보는 일이 없다.
const START_GRACE = 0.5;   // 초

/* 한 지점에 상자를 가로로 한 줄 깔아서(마리오카트처럼) 어느 차선으로 달리든 반드시 하나는
   지나가게 한다. 예전에는 지점마다 상자가 하나뿐이라, 그 차선으로 달리지 않으면 아이템도
   곱셈 문제도 구경 못 하고 한 바퀴가 끝나는 일이 많았다.
   주행 가능 폭을 4칸으로 나눠서, 상자(20 x 20) 네 개가 도로를 꽉 채운다(TRACK.boxRowOffsets). */
const BOX_PICKUP_RANGE = 11;   // 상자 간격(20)의 절반보다 살짝 넉넉하게 — 어디로 지나도 한 칸은 잡힌다

/* ---------- 전역 상태 ---------- */
// 첫 방문 기본값: 햇살 공원 · 코멧 · 2·3단 · 이지모드 (한 번만 눌러도 바로 시작할 수 있게)
let selectedCharId = "comet";
let selectedTables = [2,3];
let selectedModeId = "easy";
let selectedMapId = "sunny";

/* ---------- 마지막 설정 저장(localStorage) ----------
   저장이 실패하거나 값이 이상해도 게임엔 영향 없게, 항상 try/catch로 감싸고
   읽어온 값은 실제 목록에 존재하는 id인지 검증한 뒤에만 반영한다. */
const SETTINGS_STORAGE_KEY = "wetipapaMultipleRace.settings.v1";

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && MAPS.some(m => m.id === saved.mapId)) selectedMapId = saved.mapId;
    if (saved && CHARACTERS.some(c => c.id === saved.charId)) selectedCharId = saved.charId;
    // 구구단: 예전 판은 묶음 id 하나(diffId)로 저장했다. 그 값이 남아 있으면 단 목록으로 바꿔 준다.
    if (saved && Array.isArray(saved.tables)) {
      const t = saved.tables.filter(x => ALL_TABLES.includes(x));
      if (t.length > 0) selectedTables = t;
    } else if (saved && saved.diffId) {
      const preset = TABLE_PRESETS.find(p => p.id === saved.diffId);
      if (preset) selectedTables = [...preset.tables];
    }
    if (saved && MODES.some(m => m.id === saved.modeId)) selectedModeId = saved.modeId;
  } catch (e) { /* localStorage를 못 쓰는 환경이면 그냥 기본값으로 진행 */ }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      mapId: selectedMapId, charId: selectedCharId, tables: selectedTables, modeId: selectedModeId,
    }));
  } catch (e) { /* 저장이 안 되도 플레이에는 지장 없게 무시 */ }
}

/* ---------- 플레이 중 첫 안내(한 번만) ----------
   튜토리얼을 강제로 보여주지 않는 대신, 처음 겪는 순간에만 짧게 알려준다.
   한 번 본 안내는 localStorage에 표시해두고 다시는 띄우지 않는다. */
const HINTS_STORAGE_KEY = "wetipapaMultipleRace.hints.v1";
let seenHints = { item:false, math:false, fall:false };
(function loadSeenHints() {
  try {
    const raw = localStorage.getItem(HINTS_STORAGE_KEY);
    if (raw) Object.assign(seenHints, JSON.parse(raw));
  } catch (e) { /* 무시 */ }
})();
function markHintSeen(key) {
  seenHints[key] = true;
  try { localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify(seenHints)); } catch (e) { /* 무시 */ }
}
let cars = [];
let boxes = [];
let bananas = [];
let rockets = []; // 발사되어 날아가는 중인 로켓 { from:{x,y}, target, t, duration }
let bombFx = []; // 폭탄 폭발 파동 연출 { x, y, t, duration }
let hazards = []; // 현재 맵의 낙하 구간(우주 정거장 전용, s 단위로 환산된 값)
let obstacles = { syrups: [], lollipops: [] }; // 현재 맵의 장애물(사탕 마을 전용)
let decorations = []; // 현재 맵의 배경 장식
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
let raceTime = 0;   // 레이스 시작 후 경과 시간(초) — 출발 무적 판정에 쓴다
// 지금 서로 닿아 있는 차 쌍("i:j"). 감속 페널티를 '닿은 순간'에만 주기 위해 기억해둔다.
let contactPairs = new Set();
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
  else if (name === "zap") { tone(1400, 0.08, "square", 0, 0.18); tone(700, 0.12, "sawtooth", 0.05, 0.15); }
  else if (name === "boom") { tone(160, 0.22, "sawtooth", 0, 0.2); tone(90, 0.28, "sine", 0.05, 0.2); }
}

/* ============================================================
   시작 화면
   ============================================================ */
const mapListEl = document.getElementById("mapList");
const charListEl = document.getElementById("charList");
const diffListEl = document.getElementById("diffList");
const modeListEl = document.getElementById("modeList");

// 캐릭터 카드는 6명 설명을 한꺼번에 늘어놓지 않고, 선택된 캐릭터 하나의 특징만
// charDescLine 한 줄에 보여준다(모바일에서 설정 영역이 과도하게 길어지지 않게).
function updateCharDescLine() {
  const ch = CHARACTERS.find(c => c.id === selectedCharId);
  const line = document.getElementById("charDescLine");
  if (ch && line) line.textContent = ch.desc;
}

// 상단 "바로 시작" 버튼 옆 요약 줄: 현재 선택된 트랙·캐릭터·구구단·모드를 한눈에 보여준다.

/* 2~9단 개별 선택 + 자주 쓰는 조합 단축 버튼.
   전부 끄면 낼 문제가 없어지므로 마지막 하나는 꺼지지 않게 막는다. */
function buildTablePicker(container) {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "tableGrid";
  ALL_TABLES.forEach(t => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tableChip" + (selectedTables.includes(t) ? " selected" : "");
    btn.textContent = t + "단";
    btn.setAttribute("aria-pressed", selectedTables.includes(t) ? "true" : "false");
    btn.addEventListener("click", () => {
      const next = selectedTables.includes(t)
        ? selectedTables.filter(x => x !== t)
        : [...selectedTables, t];
      if (next.length === 0) return;
      selectedTables = next.sort((a,b) => a-b);
      buildTablePicker(container);
      saveSettings();
    });
    grid.appendChild(btn);
  });
  container.appendChild(grid);

  const presets = document.createElement("div");
  presets.className = "tablePresets";
  TABLE_PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tablePreset";
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      selectedTables = [...p.tables];
      buildTablePicker(container);
      saveSettings();
    });
    presets.appendChild(btn);
  });
  container.appendChild(presets);
}

function buildStartScreen() {
  MAPS.forEach(m => {
    const card = document.createElement("div");
    card.className = "diffCard" + (m.id === selectedMapId ? " selected" : "");
    card.dataset.id = m.id;
    card.innerHTML =
      `<div class="charName">${m.emoji} ${m.name}</div>` +
      `<div class="charDesc">난이도: ${m.diffLabel}</div>`;
    card.addEventListener("click", () => {
      selectedMapId = m.id;
      [...mapListEl.children].forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      saveSettings();
    });
    mapListEl.appendChild(card);
  });

  CHARACTERS.forEach(ch => {
    const card = document.createElement("div");
    card.className = "charCard" + (ch.id === selectedCharId ? " selected" : "");
    card.dataset.id = ch.id;
    card.innerHTML =
      `<div class="charSwatch" style="background:${ch.color}"></div>` +
      `<div class="charName">${ch.name}</div>`;
    card.addEventListener("click", () => {
      selectedCharId = ch.id;
      [...charListEl.children].forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      updateCharDescLine();
      saveSettings();
    });
    charListEl.appendChild(card);
  });
  updateCharDescLine();

  buildTablePicker(diffListEl);

  MODES.forEach(m => {
    const card = document.createElement("div");
    card.className = "diffCard" + (m.id === selectedModeId ? " selected" : "");
    card.dataset.id = m.id;
    card.innerHTML = `<div class="charName">${m.label}</div><div class="charDesc">${m.desc}</div>`;
    card.addEventListener("click", () => {
      selectedModeId = m.id;
      [...modeListEl.children].forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      saveSettings();
    });
    modeListEl.appendChild(card);
  });


  const startFromScreen = () => { ensureAudio(); startRace(); };
  document.getElementById("startBtn").addEventListener("click", startFromScreen);
  document.getElementById("startBtnInPanel").addEventListener("click", startFromScreen);

  // 설정과 게임 방법은 첫 화면 안에서 펼쳐지는 패널이다. 둘 다 접힌 채로 시작하고,
  // 하나를 열면 다른 하나는 닫는다 — 화면이 길어져 "바로 시작"이 밀려나지 않게.
  document.getElementById("settingsBtn").addEventListener("click", () => toggleStartPanel("settings"));
  document.getElementById("howtoBtn").addEventListener("click", () => toggleStartPanel("howto"));
}

// 첫 화면의 펼침 패널 두 개. key는 "settings" | "howto" | null
const START_PANELS = {
  settings: { panel: "settingsPanel", btn: "settingsBtn", open: "설정 접기 ▴", closed: "설정 바꾸기 ▾" },
  howto:    { panel: "howtoPanel",    btn: "howtoBtn",    open: "게임 방법 접기 ▴", closed: "게임 방법 ▾" },
};

function setStartPanel(key) {
  for (const [name, cfg] of Object.entries(START_PANELS)) {
    const isOpen = name === key;
    const panel = document.getElementById(cfg.panel);
    const btn = document.getElementById(cfg.btn);
    panel.classList.toggle("hidden", !isOpen);
    btn.classList.toggle("panelToggleOpen", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
    btn.textContent = isOpen ? cfg.open : cfg.closed;
  }
}

function toggleStartPanel(key) {
  const alreadyOpen = !document.getElementById(START_PANELS[key].panel).classList.contains("hidden");
  setStartPanel(alreadyOpen ? null : key);
}

function setSettingsPanelOpen(open) {
  setStartPanel(open ? "settings" : null);
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
    items: [],
    shielded: false, shieldTimer: 0,
    boosted: false, boostTimer: 0,
    hitTimer: 0, hitSlowFactor: 1, hitSource: null, impactFlashTimer: 0,
    hitProtTimer: 0,
    spinTimer: 0,
    collideTimer: 0,
    mathSlowTimer: 0,
    obstacleSlowTimer: 0, obstacleSlowFactor: 1,
    giant: false, giantTimer: 0,
    falling: false, fallTimer: 0, fallRespawnDistance: 0,
    autopilot: false,
    avoidRolls: {},
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
  const playerChar = CHARACTERS.find(c => c.id === selectedCharId);
  const map = MAPS.find(m => m.id === selectedMapId) || MAPS[0];
  applyMap(map);
  applyMapTheme(map);

  // 캐릭터 배열 순서대로 출발 위치를 고정하면 특정 캐릭터가 매번 같은 위치 이점을 갖게 되므로,
  // AI 출발 순서를 매 레이스마다 무작위로 섞어 공평하게 만든다.
  const aiChars = shuffled(CHARACTERS.filter(c => c.id !== selectedCharId));

  // 출발 차선도 매 레이스마다 무작위로 배정한다. 예전에는 플레이어가 항상 0번(맨 바깥) 차선이라
  // 출발선 충돌에 바깥으로 밀려 그대로 트랙을 이탈하고, 레이스 내내 감속된 채 달리는 문제가 있었다.
  const lanes = shuffled([0, 1, 2, 3, 4, 5]);
  cars = [];
  player = createCar(playerChar, true, lanes[0]);
  cars.push(player);
  aiChars.forEach((c, i) => cars.push(createCar(c, false, lanes[i + 1])));

  boxes = [];
  map.boxLayout.forEach((row, rowIndex) => {
    TRACK.boxRowOffsets.forEach(offset => {
      boxes.push({
        type: row.type, row: rowIndex, s: row.frac * TRACK.L, offset,
        active: true, respawnTimer: 0,
      });
    });
  });
  bananas = [];
  rockets = [];
  bombFx = [];

  hazards = (map.hazards || []).map(h => ({
    kind: h.kind, safeHalf: h.safeHalf,
    laneCenter: h.laneCenter, laneHalf: h.laneHalf,
    sStart: h.fracStart * TRACK.L, sEnd: h.fracEnd * TRACK.L,
  }));
  obstacles = {
    syrups: ((map.obstacles && map.obstacles.syrups) || []).map(o => ({ s: o.frac * TRACK.L, offset: o.offset })),
    lollipops: ((map.obstacles && map.obstacles.lollipops) || []).map(o => ({ s: o.frac * TRACK.L, offset: o.offset })),
  };
  decorations = (map.decorations || []).map(d => d.pond
    ? { pond: true, x: d.x, y: d.y }
    : { s: d.frac * TRACK.L, offset: d.offset, emoji: d.emoji, size: d.size || 24 });

  raceStats = { total: 0, correct: 0, wrongList: [] };
  raceTime = 0;
  contactPairs = new Set();
  mathPopupActive = false;
  raceEnding = false;
  finishOrderCounter = 0;
  currentTables = [...selectedTables];
  currentMode = MODES.find(m => m.id === selectedModeId);

  updateItemUI();
  document.getElementById("boostBanner").classList.add("hidden");
  document.getElementById("slowBanner").classList.add("hidden");
  document.getElementById("finishBanner").classList.add("hidden");
  document.getElementById("fallBanner").classList.add("hidden");
  document.getElementById("hintBanner").classList.add("hidden");
  hideMathPopup(true);

  showScreen("race");
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// 맵 테마(배경색·트랙 색·캔버스 테두리)를 화면에 반영한다
function applyMapTheme(map) {
  const wrap = document.getElementById("canvasWrap");
  wrap.style.background = map.theme.bg;
  wrap.style.borderColor = map.theme.wrapBorder;
}

let currentTables = [2,3];
let currentMode = MODES.find(m => m.id === selectedModeId);

/* ============================================================
   화면 전환
   ============================================================ */
function showScreen(name) {
  screenName = name;
  document.getElementById("startScreen").classList.toggle("hidden", name !== "start");
  document.getElementById("raceScreen").classList.toggle("hidden", name !== "race");
  document.getElementById("resultScreen").classList.toggle("hidden", name !== "result");
  // 화면을 바꿔도 스크롤 위치는 그대로 남아있어서, 이전 화면에서 아래로 스크롤한 채
  // 넘어오면 새 화면이 중간부터 보이는 문제가 있었다. 화면이 바뀔 때마다 맨 위로 되돌린다.
  window.scrollTo(0, 0);
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

  computeRanks(); // 아이템 확률/번개 대상 선정에 쓸 순위를 미리 갱신해둔다(1프레임 정도의 오차는 무시)

  raceTime += dt;
  cars.forEach(car => updateCar(car, dt));
  if (raceTime > START_GRACE) handleCarCollisions();
  updateBoxRespawns(dt);
  updateRockets(dt);
  updateBombFx(dt);

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
  car.autopilot = car.isPlayer && mathPopupActive; // 곱셈 문제를 푸는 동안은 안전하게 "자동주행" 취급

  // --- 타이머 감소 (낙하 중에도 계속 흐르게 조작보다 먼저 처리) ---
  if (car.hitTimer > 0) car.hitTimer -= dt;
  if (car.impactFlashTimer > 0) car.impactFlashTimer -= dt;
  if (car.hitProtTimer > 0) car.hitProtTimer -= dt;
  if (car.spinTimer > 0) car.spinTimer -= dt;
  if (car.collideTimer > 0) car.collideTimer -= dt;
  if (car.mathSlowTimer > 0) car.mathSlowTimer -= dt;
  if (car.obstacleSlowTimer > 0) car.obstacleSlowTimer -= dt;
  if (car.boostTimer > 0) { car.boostTimer -= dt; if (car.boostTimer <= 0) car.boosted = false; }
  if (car.giantTimer > 0) { car.giantTimer -= dt; if (car.giantTimer <= 0) car.giant = false; }
  if (car.shielded) { car.shieldTimer -= dt; if (car.shieldTimer <= 0) car.shielded = false; }

  // --- 우주 정거장 낙하 중: 회전하며 작아지는 연출만 하고 나머지 로직은 건너뛴다 ---
  if (car.falling) {
    car.fallTimer -= dt;
    if (car.fallTimer <= 0) {
      car.falling = false;
      car.distance = car.fallRespawnDistance;
      car.offset = 0;
      car.hitProtTimer = Math.max(car.hitProtTimer, HIT_PROTECTION_DURATION); // 복귀 직후 잠깐 충돌 보호
      car.s = mod(car.distance, T.L);
      car.lap = Math.min(TOTAL_LAPS, Math.floor(car.distance / T.L) + 1);
    }
    const wp = carWorldPos(car.s, car.offset);
    car.worldX = wp.x; car.worldY = wp.y; car.heading = wp.heading;
    return;
  }

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
    // 다른 차와 계속 겹칠 일이 적고, 자연스럽게 앞지르기 할 때만 스친다).
    // 낙하 구간·회전 막대사탕 앞에서는 대부분 중앙 쪽으로 피하되, 가끔은 실수해서
    // 그대로 자기 차선을 유지하며 지나간다(완벽하게 주행하지 않도록).
    let target = car.laneOffset + Math.sin(car.distance * 0.008 + car.aiPhase) * LANE_WOBBLE;
    const avoid = aiAvoidTarget(car);
    if (avoid !== null) target = avoid;
    car.offset += (target - car.offset) * Math.min(1, dt * 2.2);
  }
  car.offset = Math.max(-T.offsetClamp, Math.min(T.offsetClamp, car.offset));

  const offTrack = Math.abs(car.offset) > T.offTrackLimit;

  // --- AI 속도 변주 ---
  if (!car.isPlayer) {
    car.aiSpeedTimer -= dt;
    if (car.aiSpeedTimer <= 0) {
      car.aiSpeedFactor = AI_SPEED_MIN + Math.random() * (AI_SPEED_MAX - AI_SPEED_MIN);
      car.aiSpeedTimer = 1.5 + Math.random() * 2;
    }
  }

  // --- 사탕 마을 장애물 / 우주 정거장 낙하 판정 ---
  // 곱셈 문제를 푸는 동안(자동주행)과 부스터 중(장애물만 해당, 낙하는 예외)에는 안전하게 지나간다.
  checkSyrupHit(car);
  checkLollipopHit(car);
  checkHazardFall(car); // 부스터로도 낙하는 막지 못한다(요청사항). 낙하가 시작되면 car.falling이 true가 되고
  // 다음 프레임부터는 함수 맨 위의 낙하 처리 블록에서 조기 리턴되므로 여기서는 이번 프레임만 자연스럽게 마무리된다.

  // --- 속도 계산 ---
  let speed = BASE_SPEED * car.char.speedMul;
  if (!car.isPlayer) speed *= car.aiSpeedFactor;
  if (car.boosted) speed *= BOOST_SPEED_MUL;
  if (offTrack) speed *= 0.5;
  if (car.hitTimer > 0) speed *= car.hitSlowFactor;
  if (car.mathSlowTimer > 0) speed *= WRONG_SLOW_FACTOR;
  if (car.obstacleSlowTimer > 0) speed *= car.obstacleSlowFactor;
  if (car.collideTimer > 0) speed *= 0.6;
  if (car.falling) speed = 0;
  speed = Math.max(speed, car.falling ? 0 : BASE_SPEED * 0.18);
  // 이지모드(시간제한 없음)는 문제를 푸는 동안 모든 차를 완전히 멈춰서(레이스 자체를 일시정지) 여유롭게 고민할 수 있게 한다
  if (mathPopupActive && !currentMode.timeLimited) speed = 0;

  if (!car.finished && !car.falling) {
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
    if (dS < 11 && dO < BOX_PICKUP_RANGE) {
      if (box.type === "item") {
        const capacity = car.isPlayer ? PLAYER_ITEM_SLOTS : 1;
        if (car.items.length < capacity) {
          car.items.push(rollItem(car));
          box.active = false; box.respawnTimer = 4.5;
          if (car.isPlayer) {
            playSound("item"); updateItemUI();
            if (!seenHints.item) { showHintBanner("아래 아이템 칸을 눌러서 써봐요! 👇"); markHintSeen("item"); }
          }
          if (!car.isPlayer) car.aiItemDelay = 0.5 + Math.random() * 1.2;
        }
      } else if (box.type === "math") {
        // 곱셈은 한 줄이 곧 문제 하나다. 맞은 상자 하나만 닫으면, 두 칸에 걸쳐 지나갔을 때
        // 첫 문제를 푼 직후 제자리에서 옆 칸 상자에 다시 걸려 문제가 연달아 두 번 뜬다.
        boxes.forEach(other => {
          if (other.row === box.row) { other.active = false; other.respawnTimer = 5.5; }
        });
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
  // useItem()이 조건(대상 존재 여부 등)을 만족하지 못하면 아이템을 소비하지 않고 그냥 리턴하므로,
  // 아래 코드는 매 프레임 "조건이 될 때까지 계속 시도"하는 형태가 되어 별도의 복잡한 AI 판단 로직 없이도
  // 자연스럽게 "쓸 수 있을 때 쓴다"가 된다.
  if (!car.isPlayer && car.items.length) {
    car.aiItemDelay -= dt;
    if (car.aiItemDelay <= 0) useItem(car, 0);
  }
}

// 상자 재생성 타이머 (모든 상자 공통, 매 프레임 별도 처리)
function updateBoxRespawns(dt) {
  boxes.forEach(b => {
    if (b.active) return;
    b.respawnTimer -= dt;
    if (b.respawnTimer > 0) return;
    // 플레이어가 아직 그 상자 자리에 있으면 되살리지 않는다. 이지모드는 문제를 푸는 동안
    // 차가 완전히 멈추는데(제한시간 최대 18초), 재생성 시간 5.5초가 먼저 지나면 상자가
    // 발밑에서 되살아나 문제가 곧바로 또 뜬다.
    if (player && !player.finished &&
        circDist(player.s, b.s) < 11 && Math.abs(player.offset - b.offset) < BOX_PICKUP_RANGE) return;
    b.active = true;
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

function updateBombFx(dt) {
  bombFx = bombFx.filter(b => { b.t += dt; return b.t < b.duration; });
}

// 충돌 밀어내기 전용 오프셋 이동. 트랙 안에 있던 차가 밀려서 이탈선(±TRACK.offTrackLimit) 밖으로
// 나가지 않도록 막는다. 이미 밖에 나가 있는 차는 더 바깥으로 밀리지만 않게 하고, 스스로 조작해서
// 돌아오는 건 그대로 둔다.
function pushOffset(car, delta) {
  const before = car.offset;
  let next = Math.max(-TRACK.offsetClamp, Math.min(TRACK.offsetClamp, before + delta));
  if (Math.abs(next) > TRACK.offTrackLimit && Math.abs(next) > Math.abs(before)) {
    next = Math.sign(next) * Math.max(TRACK.offTrackLimit, Math.abs(before));
  }
  car.offset = next;
}

function handleCarCollisions() {
  const nextContacts = new Set();
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.finished || b.finished) continue;
      if (a.boosted || b.boosted) continue;
      if (a.falling || b.falling) continue;
      // 방금 다른 공격을 맞았거나(집중 공격 방지) 낙하에서 막 복귀한 차는 잠깐 충돌하지 않는다
      if (a.hitProtTimer > 0 || b.hitProtTimer > 0) continue;
      // AI끼리는 서로 부딪혀 밀어내지 않는다. 6대가 좁은 도로를 나눠 쓰다 보면 AI 두세 대가
      // 계속 서로 밀어내다 다시 모여들며 그 자리에서 버벅이는 문제가 있었는데, AI-AI 충돌을
      // 없애면 그 문제가 근본적으로 사라진다(플레이어가 낀 충돌은 게임성을 위해 그대로 둔다).
      if (!a.isPlayer && !b.isPlayer) continue;
      // 판정 크기는 drawCar()의 차 크기(길이 22 x 폭 14)에 맞춘다. 예전 폭 24는 차 폭의
      // 1.7배라 옆 차선 차와 화면상 닿지도 않았는데 계속 충돌로 처리됐다.
      // 거대 사탕으로 커진 차는 판정 범위가 넓어진다.
      const giantExtra = (a.giant ? 8 : 0) + (b.giant ? 8 : 0);
      const dSLimit = 18 + giantExtra * 0.6, dOLimit = 13 + giantExtra;
      const key = i + ":" + j;
      if (circDist(a.s, b.s) < dSLimit && Math.abs(a.offset - b.offset) < dOLimit) {
        nextContacts.add(key);
        const isNewContact = !contactPairs.has(key);
        const dir = a.offset <= b.offset ? -1 : 1;

        if (a.shielded !== b.shielded) {
          // 방패 든 차는 범퍼처럼 튼튼해서 안 밀리고, 부딪힌 상대 차만 옆으로 세게 튕겨나간다
          const bumped = a.shielded ? b : a;
          const bumpDir = a.shielded ? -dir : dir;
          pushOffset(bumped, bumpDir * 10);
          if (isNewContact) bumped.collideTimer = Math.max(bumped.collideTimer, 0.4);
        } else if (a.giant !== b.giant) {
          // 거대해진 차는 거의 밀리지 않고, 부딪힌 상대만 옆으로 크게 밀려난다
          const bumped = a.giant ? b : a;
          const giantCar = a.giant ? a : b;
          const bumpDir = a.giant ? -dir : dir;
          pushOffset(bumped, bumpDir * 13);
          if (isNewContact) bumped.collideTimer = Math.max(bumped.collideTimer, 0.4);
          pushOffset(giantCar, (a.giant ? dir : -dir) * 1.5);
        } else {
          pushOffset(a, dir * 3);
          pushOffset(b, -dir * 3);
          if (isNewContact) {
            a.collideTimer = Math.max(a.collideTimer, 0.3 * a.char.collisionMul);
            b.collideTimer = Math.max(b.collideTimer, 0.3 * b.char.collisionMul);
          }
        }
      }
    }
  }
  contactPairs = nextContacts;
}

/* ---------- 사탕 마을 장애물 ---------- */
// 시럽 웅덩이: 방패로도 못 막지만, 부스터 중이거나(구구단 파워 UP) 곱셈 문제를 푸는 자동주행 중에는 무시한다.
function checkSyrupHit(car) {
  if (car.boosted || car.autopilot) return;
  obstacles.syrups.forEach(syr => {
    if (car.obstacleSlowTimer > 0) return; // 이미 슬로우 중이면 웅덩이 안에 있어도 다시 늘리지 않는다(무한 감속 방지)
    const dS = circDist(car.s, syr.s);
    const dO = Math.abs(car.offset - syr.offset);
    if (dS < 11 && dO < 18) {
      car.obstacleSlowTimer = SYRUP_SLOW_DURATION;
      car.obstacleSlowFactor = SYRUP_SLOW_FACTOR;
    }
  });
}

// 회전하는 막대사탕: 방패로 한 번 막을 수 있고, 부딪히면 옆으로 살짝 밀리며 잠깐 빙글 돈다.
function checkLollipopHit(car) {
  if (car.boosted || car.autopilot || car.hitProtTimer > 0) return;
  obstacles.lollipops.forEach(lol => {
    if (car.hitProtTimer > 0) return; // 이번 프레임에 이미 다른 막대사탕에 맞았으면 중복 적용 방지
    const dS = circDist(car.s, lol.s);
    const dO = Math.abs(car.offset - lol.offset);
    if (dS < 12 && dO < 20) {
      const wasShielded = car.shielded;
      hitCar(car, "lollipop");
      if (!wasShielded) {
        const dir = car.offset < lol.offset ? -1 : 1;
        pushOffset(car, dir * LOLLIPOP_PUSH);
      }
    }
  });
}

/* ---------- 우주 정거장 낙하 ---------- */
/* hazard에서 "밟고 지나갈 수 있는 길"을 오프셋 구간 [min,max] 배열로 돌려준다(오름차순).
   그리기(drawHazardZones)와 낙하 판정(checkHazardFall)이 둘 다 이 함수 하나만 보게 해서
   화면에 보이는 길과 실제 판정이 절대 어긋나지 않게 한다.
   (예전에는 양쪽이 각자 폭을 계산해서, 길이 통째로 지워져 보이는 구간을 가운데로 지나가면
   멀쩡히 통과되는 문제가 있었다.)
   - bridge: 가운데 좁은 다리 하나
   - fork:   가운데를 비우고 좌우로 갈라지는 좁은 길 두 개 */
function hazardSafeBands(hz) {
  if (hz.kind === "fork") {
    const inner = hz.laneCenter - hz.laneHalf, outer = hz.laneCenter + hz.laneHalf;
    return [[-outer, -inner], [inner, outer]];
  }
  return [[-hz.safeHalf, hz.safeHalf]];
}

// 부스터로도 낙하는 막지 못한다. 자동주행(곱셈 문제 풀이) 중과 낙하 직후 보호시간 동안만 안전하다.
function checkHazardFall(car) {
  if (car.autopilot || car.falling || car.hitProtTimer > 0 || car.finished) return;
  hazards.forEach(hz => {
    if (car.falling) return;
    if (car.s >= hz.sStart && car.s < hz.sEnd) {
      const onRoad = hazardSafeBands(hz).some(([lo, hi]) => car.offset >= lo && car.offset <= hi);
      if (!onRoad) triggerFall(car);
    }
  });
}

function triggerFall(car) {
  if (car.falling) return;
  car.falling = true;
  car.fallTimer = FALL_ANIM_DURATION;

  // 낙하 시점의 바퀴 안에서 "가장 최근에 지난 안전 체크포인트"로 되돌아간다(바퀴 수는 유지)
  const T = TRACK;
  const laneS = mod(car.distance, T.L);
  const cps = (currentMap.checkpoints && currentMap.checkpoints.length) ? currentMap.checkpoints : [0];
  let bestFrac = 0;
  cps.forEach(f => { if (f * T.L <= laneS) bestFrac = Math.max(bestFrac, f); });
  const lapBase = Math.floor(car.distance / T.L) * T.L;
  car.fallRespawnDistance = lapBase + bestFrac * T.L;

  if (car.isPlayer) {
    playSound("wrong");
    const isFirstFall = !seenHints.fall;
    if (isFirstFall) markHintSeen("fall");
    const banner = document.getElementById("fallBanner");
    banner.textContent = isFirstFall
      ? "앗, 우주로 빠졌다! 체크포인트에서 다시 출발해요 🌌"
      : "앗, 우주로 빠졌다! 🌌";
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), isFirstFall ? 1700 : 1100);
  }
}

// 화면 위쪽에 잠깐 떴다 사라지는 짧은 안내 배너(처음 겪는 순간에만 한 번 씀)
function showHintBanner(text) {
  const el = document.getElementById("hintBanner");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(showHintBanner._timer);
  showHintBanner._timer = setTimeout(() => el.classList.add("hidden"), 2200);
}

/* ---------- AI 회피(낙하 구간 / 회전 막대사탕) ----------
   AI는 위험 구간이 가까워지면 대부분 안전한 길로 피하려 하지만, 매번 다가올 때마다 확률을 새로
   뽑아서 가끔은 그대로 지나가게 한다(완벽한 주행 방지). 지나가면 판정을 초기화해서 다음 바퀴에
   다시 시도하게 만든다. */
// hazard를 피할 때 노릴 오프셋. 안전 구간(hazardSafeBands) 중 지금 위치에서 가장 가까운 길의
// 한가운데를 고른다. 양갈래(fork)에서는 차마다 가까운 쪽 길로 갈라져서 자연스럽게 나뉜다.
// (가운데가 낭떠러지인 fork에서 예전처럼 0을 노리면 AI가 전부 떨어진다.)
function hazardAvoidOffset(hz, car) {
  let best = 0, bestDist = Infinity;
  hazardSafeBands(hz).forEach(([lo, hi]) => {
    const mid = (lo + hi) / 2, d = Math.abs(car.offset - mid);
    if (d < bestDist) { bestDist = d; best = mid; }
  });
  return best;
}
function aiAvoidTarget(car) {
  for (let i = 0; i < hazards.length; i++) {
    const hz = hazards[i], key = "hz" + i;
    if (car.s > hz.sStart - AI_AVOID_LOOKAHEAD && car.s < hz.sEnd) {
      if (car.avoidRolls[key] === undefined) car.avoidRolls[key] = Math.random() < 0.93;
      return car.avoidRolls[key] ? hazardAvoidOffset(hz, car) : car.laneOffset;
    } else if (car.avoidRolls[key] !== undefined) {
      delete car.avoidRolls[key];
    }
  }
  const lollipops = obstacles.lollipops;
  for (let i = 0; i < lollipops.length; i++) {
    const lol = lollipops[i], key = "lol" + i;
    if (car.s > lol.s - AI_AVOID_LOOKAHEAD && car.s < lol.s + 14) {
      if (car.avoidRolls[key] === undefined) car.avoidRolls[key] = Math.random() < 0.86;
      if (car.avoidRolls[key]) return lol.offset > 0 ? -18 : 18;
      return car.laneOffset;
    } else if (car.avoidRolls[key] !== undefined) {
      delete car.avoidRolls[key];
    }
  }
  return null;
}

/* ---------- 아이템 로직 ---------- */
/* 아이템은 순위와 상관없이 똑같은 확률로 나온다.
   예전에는 순위별로 가중치를 줘서(상위권=바나나·방패 위주) 뒤처진 쪽을 도왔는데,
   1등이 바나나+방패만 79% 확률로 받게 되어 "잘 달릴수록 아이템이 심심해지는" 문제가 있었다.
   곱셈 문제를 잘 풀어서 앞서 나간 쪽이 제일 재미없어지는 건 이 게임의 목적과 어긋나서,
   순위 보정을 걷어내고 전부 같은 확률로 돌린다.
   럭키 캐릭터의 itemLuck은 그대로 유지 — 바나나를 뺀 나머지에 곱해서 강한 아이템이 잘 나오게 한다. */
function rollItem(car) {
  const char = car.char;
  const w = { banana: 1, shield: 1, rocket: 1, bomb: 1, lightning: 1, bigcandy: 1 };
  Object.keys(w).forEach(k => { if (k !== "banana") w[k] *= char.itemLuck; });

  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const key of Object.keys(w)) {
    if (r < w[key]) return key;
    r -= w[key];
  }
  return "banana";
}

function useItem(car, slot) {
  const item = car.items[slot];
  if (!item) return;

  if (item === "lightning") {
    // "자기를 뺀 가장 앞선 차"에게 떨어진다. 2등 이하면 1등을, 1등이면 2등을 때린다.
    // (예전에는 1등만 노려서, 1등이 번개를 들면 대상이 없어 영원히 못 쓰고 아이템 칸만
    //  차지했다. 그래서 1등은 번개를 아예 못 뽑게 막아뒀는데, 이렇게 일반화하면
    //  대상이 항상 있으므로 그 예외 자체가 필요 없어진다.)
    const target = cars.reduce((best, c) =>
      (c === car || c.finished) ? best : (!best || c.rank < best.rank ? c : best), null);
    if (!target) return; // 남들이 전부 완주한 경우에만 해당
    car.items.splice(slot, 1);
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
    triggerScreenFlash();
    playSound("zap");
    hitCar(target, "lightning");
    return;
  }
  if (item === "bomb") {
    // 주변에 맞힐 상대가 있을 때만 사용한다(없으면 소비하지 않고 계속 들고 있는다).
    // AI는 이 성질을 조준 로직 대신 쓰지만(updateCar의 주석 참고), 플레이어는 버튼을 눌렀는데
    // 아무 반응이 없으면 고장난 것처럼 느껴지므로 왜 안 나갔는지 알려준다.
    const targets = cars.filter(o => o !== car && !o.finished &&
      circDist(car.s, o.s) < BOMB_RANGE_S && Math.abs(car.offset - o.offset) < BOMB_RANGE_OFFSET);
    if (targets.length === 0) {
      if (car.isPlayer) showHintBanner("💣 주변에 아무도 없어요! 가까이 붙어서 터뜨리세요");
      return;
    }
    car.items.splice(slot, 1);
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
    playSound("boom");
    bombFx.push({ x: car.worldX, y: car.worldY, t: 0, duration: 0.5 });
    targets.forEach(t => hitCar(t, "bomb"));
    return;
  }

  car.items.splice(slot, 1);   // 쓴 칸만 비우고 뒤 칸이 앞으로 당겨진다

  if (item === "shield") {
    car.shielded = true;
    car.shieldTimer = SHIELD_DURATION;
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
  } else if (item === "banana") {
    bananas.push({ s: mod(car.distance - 16, TRACK.L), offset: car.offset, active: true });
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
  } else if (item === "rocket") {
    // 앞차만 맞히던 예전 방식은 앞에 아무도 없으면 로켓을 계속 들고만 있어야 하는
    // 문제가 있었다. 이제는 앞/뒤 상관없이 트랙에서 가장 가까운 상대를 조준해서
    // 쏘는 즉시 무조건 발사(아이템 소비)되도록 바꿨다.
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
  } else if (item === "bigcandy") {
    car.giant = true;
    car.giantTimer = BIGCANDY_DURATION;
    if (car.isPlayer) { updateItemUI(); playSound("item"); }
  }
}

function hitCar(car, source) {
  if (car.hitProtTimer > 0) return; // 방금 다른 공격을 맞았으면(연속 집중 공격 방지) 이번 공격은 무효
  if (car.boosted) return;
  if (car.shielded) { car.shielded = false; car.hitProtTimer = HIT_PROTECTION_DURATION; return; }
  car.hitSource = source;
  car.impactFlashTimer = 0.25;
  car.hitProtTimer = HIT_PROTECTION_DURATION;
  if (source === "rocket") {
    car.hitTimer = ROCKET_STUN_DURATION;
    car.hitSlowFactor = ROCKET_STUN_FACTOR; // 거의 멈춰버릴 정도로 확실하게 느려짐
  } else if (source === "lightning") {
    car.hitTimer = LIGHTNING_SLOW_DURATION;
    car.hitSlowFactor = LIGHTNING_SLOW_FACTOR;
  } else if (source === "bomb") {
    car.hitTimer = BOMB_STUN_DURATION;
    car.hitSlowFactor = BOMB_SLOW_FACTOR;
    car.spinTimer = 0.9;
  } else if (source === "lollipop") {
    car.hitTimer = LOLLIPOP_STUN_DURATION;
    car.hitSlowFactor = LOLLIPOP_SLOW_FACTOR;
    car.spinTimer = 0.8;
  } else {
    car.hitTimer = 1.0;
    car.hitSlowFactor = 0.3; // 바나나는 미끄러지는 정도
  }
}

// 번개 사용 시 화면이 잠깐 번쩍이는 연출
function triggerScreenFlash() {
  const el = document.getElementById("screenFlash");
  if (!el) return;
  el.classList.remove("flashAnim");
  void el.offsetWidth; // 리플로우를 강제해서 애니메이션을 다시 재생시킨다
  el.classList.add("flashAnim");
}

// slot이 없으면(스페이스바) 맨 앞 칸부터 쓴다.
function useItemInput(slot) {
  if (screenName !== "race" || mathPopupActive || !player || player.finished) return;
  useItem(player, slot === undefined ? 0 : slot);
}

/* ---------- 곱셈 문제 ---------- */
function generateQuestion() {
  const tables = currentTables;
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

  // 처음 곱셈 문제를 만났을 때만, 맞히고 틀리면 무슨 일이 생기는지 한 줄로 짧게 알려준다.
  const mathHint = document.getElementById("mathHint");
  if (!seenHints.math) {
    mathHint.textContent = "정답이면 부스터, 틀리면 느려져요!";
    mathHint.classList.remove("hidden");
    markHintSeen("math");
  } else {
    mathHint.classList.add("hidden");
  }

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

const ITEM_NAMES = { banana: "바나나", rocket: "로켓", shield: "방패", lightning: "번개", bomb: "폭탄", bigcandy: "왕사탕" };
const ITEM_EMOJI = { banana: "🍌", rocket: "🚀", shield: "🛡️", lightning: "⚡", bomb: "💣", bigcandy: "🍬" };
// 아이템 칸은 좌우 버튼과 같은 줄에 둬서, 손가락이 있는 곳에서 바로 누를 수 있게 한다.
// 빈 칸도 계속 보여줘야 "몇 개 모았는지"가 눈에 들어온다.
function updateItemUI() {
  document.querySelectorAll(".itemSlot").forEach((btn, i) => {
    const item = player ? player.items[i] : null;
    btn.textContent = item ? ITEM_EMOJI[item] : "";
    btn.classList.toggle("filled", !!item);
    btn.setAttribute("aria-label", item ? ITEM_NAMES[item] + " 쓰기" : "빈 칸");
  });
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

// applyCameraTransform()이 화면 전체에 건 회전각. 상자처럼 "항상 화면에 똑바로 서 있어야
// 하는" 것들은 이 각도만큼 되돌려서 그린다.
let cameraRotation = 0;

function applyCameraTransform() {
  const focusX = canvas.width / 2;
  const focusY = canvas.height * CAMERA.focusYRatio;
  const centerPos = trackPos(player.s); // 오프셋 무시한 중심선 위치(좌우 흔들림 없이 부드럽게 스크롤)
  const heading = trackFrame(player.s).heading;

  cameraRotation = -(heading + Math.PI / 2);
  ctx.translate(focusX, focusY);
  ctx.rotate(cameraRotation); // 진행방향이 화면 위쪽(−y)을 향하도록 회전
  ctx.scale(CAMERA.zoom, CAMERA.zoom);
  ctx.translate(-centerPos.x, -centerPos.y);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 맵 테마 배경
  ctx.fillStyle = currentMap.theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  applyCameraTransform();

  drawDecorations();
  drawTrack();
  drawFinishLine();
  drawHazardZones();
  drawObstacles();
  drawBoxes();
  drawBananas();

  const ranked = [...cars].sort((a, b) => a.distance - b.distance); // 뒤에 있는 차부터 그려서 앞차가 위로
  ranked.forEach(car => drawCar(car));

  drawRockets();
  drawBombFx();

  ctx.restore();

  drawMinimap();
}

// 맵 배경 장식(나무·꽃·연못·응원 동물·별·행성·사탕 등). 게임 진행에는 전혀 영향을 주지 않는다.
function drawDecorations() {
  decorations.forEach(d => {
    if (d.pond) { drawPond(d); return; }
    const p = carWorldPos(d.s, d.offset);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-cameraRotation); // 상자와 같은 이유로 항상 똑바로 서 있게 카메라 회전을 되돌린다
    ctx.font = d.size + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(d.emoji, 0, 0);
    ctx.restore();
  });
}
function drawPond(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = "#4fa8e0";
  ctx.strokeStyle = "#2f7fb8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("🦆", -8, -2);
  ctx.restore();
}

// 사탕 마을 장애물: 시럽 웅덩이(밟으면 감속) + 회전하는 막대사탕(부딪히면 빙글 돌며 밀림)
function drawObstacles() {
  obstacles.syrups.forEach(syr => {
    const p = carWorldPos(syr.s, syr.offset);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(180,90,20,0.75)";
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(120,60,10,0.9)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  });
  obstacles.lollipops.forEach(lol => {
    const p = carWorldPos(lol.s, lol.offset);
    const spin = performance.now() / 300;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);
    ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 17); ctx.stroke();
    ctx.fillStyle = "#ff6fa8";
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c23d78"; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, 3 + k * 3, 0, Math.PI * 1.4); ctx.stroke(); }
    ctx.restore();
  });
}

/* 우주 정거장의 좁은 다리/양갈래 구간을 도로 위에 "잘려나간" 것처럼 표현한다.
   hazardSafeBands()가 돌려준 안전 구간만 남기고 나머지를 전부 배경색으로 덮는 방식이라,
   길 모양을 바꾸려면 hazardSafeBands()만 고치면 그리기와 판정이 함께 따라온다. */
function drawHazardZones() {
  const edge = TRACK.halfWidth + 6; // 도로 폭보다 살짝 넓게 덮어서 가장자리가 남지 않게 한다
  hazards.forEach(hz => {
    const bg = currentMap.theme.bg;
    let cursor = -edge;
    hazardSafeBands(hz).forEach(([lo, hi]) => {
      if (lo > cursor) drawZoneCutaway(hz.sStart, hz.sEnd, cursor, lo, bg);
      cursor = Math.max(cursor, hi);
    });
    if (cursor < edge) drawZoneCutaway(hz.sStart, hz.sEnd, cursor, edge, bg);
  });
}
function drawZoneCutaway(sStart, sEnd, offA, offB, color) {
  const steps = 10;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const s = sStart + (sEnd - sStart) * i / steps;
    const p = carWorldPos(s, offA);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const s = sStart + (sEnd - sStart) * i / steps;
    const p = carWorldPos(s, offB);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// 폭탄이 터질 때의 원형 파동 연출
function drawBombFx() {
  bombFx.forEach(b => {
    const t = b.t / b.duration;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = `rgba(255,120,60,${1 - t})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + t * 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

// 화면 우측 상단에 실제 트랙 모양을 그대로 축소해서 보여주는 미니맵.
// 각 차량 점은 실제 월드 좌표(worldX/worldY)를 그대로 축소해서 찍기 때문에
// 커브를 돌 때 미니맵 위의 점도 똑같이 커브를 돌며, 항상 레이스와 정확히 연동된다.
function drawMinimap() {
  const boxW = 96, boxH = 208, pad = 12;
  const px = canvas.width - boxW - 10, py = 10;
  const T = TRACK;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = "#4a934a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px, py, boxW, boxH, 10); else ctx.rect(px, py, boxW, boxH);
  ctx.fill(); ctx.stroke();

  // 트랙 전체(도로 폭까지 포함)를 감싸는 실제 범위를 구해서, 미니맵 박스 안에 꼭 맞게
  // 축소하는 배율과 오프셋을 계산한다.
  const margin = T.halfWidth + 6;
  const trackLeft = T.cx - T.radius - margin, trackRight = T.cx + T.radius + margin;
  const trackTop = T.cy - T.straightLen / 2 - T.radius - margin, trackBottom = T.cy + T.straightLen / 2 + T.radius + margin;
  const scale = Math.min((boxW - pad * 2) / (trackRight - trackLeft), (boxH - pad * 2) / (trackBottom - trackTop));
  const offX = px + boxW / 2 - (trackLeft + trackRight) / 2 * scale;
  const offY = py + boxH / 2 - (trackTop + trackBottom) / 2 * scale;
  const toMini = (x, y) => ({ x: x * scale + offX, y: y * scale + offY });

  // 실제 트랙 중심선을 그대로 축소해서 그린다(직선·커브 모양이 실제 레이스와 동일)
  ctx.beginPath();
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const p = trackPos((i / steps) * T.L);
    const m = toMini(p.x, p.y);
    if (i === 0) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y);
  }
  ctx.closePath();
  ctx.strokeStyle = "#8d8d95";
  ctx.lineWidth = Math.max(3, T.halfWidth * 2 * scale);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.stroke();

  // 출발선=결승선 표시
  const fin = toMini(T.cx + T.radius, T.cy + T.straightLen / 2);
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("🏁", fin.x, fin.y - 12);

  // 각 차량을 실제 위치 그대로(오프셋 포함) 미니맵에 축소해서 찍는다
  cars.forEach(car => {
    const m = toMini(car.worldX, car.worldY);
    ctx.beginPath();
    ctx.fillStyle = car.char.color;
    ctx.arc(m.x, m.y, car.isPlayer ? 4.5 : 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (car.isPlayer) { ctx.strokeStyle = "#222"; ctx.lineWidth = 1.3; ctx.stroke(); }
  });

  ctx.restore();
}

function drawTrack() {
  if (!trackPath) trackPath = buildTrackPath();

  // 트랙 중심선을 따라 일정한 폭으로 선을 그려서 직선·커브가 하나로 매끄럽게 이어진
  // 폐곡선 도로를 만든다(구간마다 따로 그리지 않으므로 이어붙는 자국이 없다).
  ctx.save();
  ctx.strokeStyle = currentMap.theme.road;
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
    // 카메라 회전을 되돌린다. 안 그러면 반대편 직선(카메라가 180° 돌아간 구간)에서
    // "?"와 "×"가 뒤집혀 보이고, 커브에서는 상자가 마름모처럼 기울어 보인다.
    ctx.rotate(-cameraRotation);
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
    // 예전엔 기울인 타원이라 바나나로 안 보였다. 바깥/안쪽 호를 이어붙여 초승달 모양을
    // 만들고 양 끝에 짙은 꼭지를 찍어서 한눈에 바나나로 보이게 한다.
    ctx.rotate(-0.5);
    const R = 11, r = 6.5, a0 = Math.PI * 0.08, a1 = Math.PI * 0.92;
    ctx.fillStyle = "#ffd93d";
    ctx.strokeStyle = "#a67c00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, R, a0, a1);           // 바깥쪽(볼록한) 곡선
    ctx.arc(0, -2, r, a1, a0, true);     // 안쪽(오목한) 곡선
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#7a5c1e";           // 양 끝 꼭지
    [a0, a1].forEach(a => {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (R + r) / 2, -2 + Math.sin(a) * (R + r) / 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
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
  if (car.spinTimer > 0) ctx.rotate(car.spinTimer * 16); // 폭탄/막대사탕에 맞아 빙글 도는 연출
  if (car.giant && car.giantTimer > 0) ctx.scale(GIANT_SCALE, GIANT_SCALE);

  // 부스터 발광 효과 (밝고 화려한 무지개색 - 정답 보상)
  if (car.boosted) {
    const glowR = 22 + Math.sin(performance.now() / 60) * 4;
    const hue = (performance.now() / 5) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.45)`;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }
  // 감속 효과 (칙칙한 회색 연기 - 오답 페널티나 바나나/시럽에 미끄러진 경우, 부스터와 확실히 구분)
  if (car.mathSlowTimer > 0 || car.obstacleSlowTimer > 0 || (car.hitTimer > 0 && car.hitSource === "banana")) {
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
  // 번개 피격 표시
  if (car.hitTimer > 0 && car.hitSource === "lightning") {
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⚡", 0, -18);
  }
  // 폭탄 피격 표시
  if (car.hitTimer > 0 && car.hitSource === "bomb") {
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("💥", 0, -16);
  }
  // 회전 막대사탕 피격 표시
  if (car.hitTimer > 0 && car.hitSource === "lollipop") {
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🌀", 0, -16);
  }
  // 피격 직후 짧은 하얀 충격 플래시
  if (car.impactFlashTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(car.impactFlashTimer / 0.25) * 0.8})`;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  // 거대 사탕 효과(분홍 테두리)
  if (car.giant && car.giantTimer > 0) {
    ctx.strokeStyle = "rgba(255,105,180,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
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

  // 낙하 연출(회전하며 작아짐)은 차체와 별개로, 원래 크기 기준 축소 비율을 직접 계산해 그린다
  if (car.falling) {
    const t = 1 - Math.max(0, car.fallTimer) / FALL_ANIM_DURATION; // 0 -> 1
    const scale = Math.max(0.05, 1 - t);
    ctx.save();
    ctx.translate(car.worldX, car.worldY);
    ctx.rotate(car.heading + t * Math.PI * 6);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = car.char.color;
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, 4); else ctx.rect(-w/2,-h/2,w,h);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
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

// 같은 설정으로 곧바로 다시 하기 — 마지막으로 고른 설정을 그대로 재사용한다.
document.getElementById("retryBtn").addEventListener("click", () => {
  ensureAudio();
  startRace();
});
// 설정을 바꾸고 다시 하기 — 처음 화면으로 돌아가되 설정 영역을 바로 펼쳐준다.
document.getElementById("retrySettingsBtn").addEventListener("click", () => {
  showScreen("start");
  setSettingsPanelOpen(true);
  document.getElementById("settingsPanel").scrollIntoView({ block: "start" });
});
// 처음 화면으로 — 마지막 설정과 요약은 그대로 유지된 채 첫 화면으로 돌아간다.
document.getElementById("homeBtn").addEventListener("click", () => {
  showScreen("start");
  setSettingsPanelOpen(false);
});

/* ============================================================
   입력 처리 (키보드 + 모바일 버튼)
   ============================================================ */
window.addEventListener("keydown", e => {
  // 게임 방법 오버레이가 열려있을 때는 Esc로 바로 닫을 수 있게 한다.
  if (e.key === "Escape") {
    setStartPanel(null);
    return;
  }
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
// 아이템 칸은 각각 자기 칸의 아이템을 쓴다 — 어떤 아이템이 나갈지 눈으로 보고 누른다.
document.querySelectorAll(".itemSlot").forEach(btn => {
  btn.addEventListener("pointerdown", e => {
    e.preventDefault(); ensureAudio();
    useItemInput(Number(btn.dataset.slot));
  });
});

document.getElementById("muteBtn").addEventListener("click", () => {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  document.getElementById("muteBtn").textContent = muted ? "🔇" : "🔊";
});

/* ============================================================
   초기화
   ============================================================ */
loadSavedSettings(); // 마지막으로 저장된 설정이 있으면 불러오고, 없거나 잘못됐으면 기본값 유지
buildStartScreen();
showScreen("start"); // 설명 화면을 거치지 않고 바로 시작 화면부터 보여준다
