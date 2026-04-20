const notes = [
  {
    id: "quarter",
    label: "\u0034 \u5206\u97f3\u7b26",
    beats: 1,
    graphic: `
      <span class="note-group note-group-single" aria-hidden="true">
        <span class="note-unit">
          <span class="note-stem"></span>
          <span class="notehead"></span>
        </span>
      </span>
    `
  },
  {
    id: "eighth",
    label: "\u0038 \u5206\u97f3\u7b26",
    beats: 0.5,
    graphic: `
      <span class="note-group note-group-double" aria-hidden="true">
        <span class="note-beam note-beam-top"></span>
        <span class="note-cluster note-cluster-2">
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
        </span>
      </span>
    `
  },
  {
    id: "sixteenth",
    label: "\u0031\u0036 \u5206\u97f3\u7b26",
    beats: 0.25,
    graphic: `
      <span class="note-group note-group-wide" aria-hidden="true">
        <span class="note-beam note-beam-top"></span>
        <span class="note-beam note-beam-lower"></span>
        <span class="note-cluster note-cluster-4">
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
        </span>
      </span>
    `
  },
  {
    id: "triplet",
    label: "\u0033 \u9023\u97f3",
    beats: 0.333,
    graphic: `
      <span class="triplet-graphic" aria-hidden="true">
        <span class="triplet-number">3</span>
        <span class="note-beam note-beam-top"></span>
        <span class="note-cluster note-cluster-3">
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
          <span class="note-unit">
            <span class="note-stem"></span>
            <span class="notehead"></span>
          </span>
        </span>
      </span>
    `
  },
  {
    id: "rest",
    label: "\u4f11\u6b62\u7b26",
    beats: 1,
    graphic: '<span class="note-glyph">&#119101;</span>'
  }
];

const defaultPattern = [
  "quarter", "eighth", "eighth", "quarter",
  "sixteenth", "sixteenth", "triplet", "quarter",
  "quarter", "rest", "eighth", "eighth",
  "quarter", "triplet", "sixteenth", "rest"
];

const grid = document.getElementById("rhythmGrid");
const palette = document.getElementById("palette");
const cellTemplate = document.getElementById("cellTemplate");
const paletteItemTemplate = document.getElementById("paletteItemTemplate");
const tempoRange = document.getElementById("tempoRange");
const tempoValue = document.getElementById("tempoValue");
const statusText = document.getElementById("statusText");
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const micButton = document.getElementById("micButton");
const micDot = document.getElementById("micDot");
const micText = document.getElementById("micText");
const randomizeButton = document.getElementById("randomizeButton");
const loopToggle = document.getElementById("loopToggle");
const scoreToggle = document.getElementById("scoreToggle");
const scoreValue = document.getElementById("scoreValue");
const comboValue = document.getElementById("comboValue");
const accuracyValue = document.getElementById("accuracyValue");
const judgeText = document.getElementById("judgeText");

let currentPattern = [...defaultPattern];
let activeIndex = -1;
let metronomeTimer = null;
let audioContext = null;
let metronomeStartPerf = null;
let metronomeIntervalMs = null;

const scoreState = {
  active: false,
  totalSteps: 0,
  expectHit: [],
  judged: [],
  finalizeTimeoutIds: [],
  expectedHitCount: 0,
  counts: {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    restMistake: 0
  },
  score: 0,
  combo: 0,
  maxCombo: 0
};

const micState = {
  stream: null,
  analyser: null,
  data: null,
  rafId: null,
  lastHitPerf: 0,
  hotTimeoutId: null,
  threshold: 0.085,
  minIntervalMs: 90
};

function noteById(id) {
  return notes.find((note) => note.id === id) ?? notes[0];
}

function renderNoteGraphic(target, note) {
  target.innerHTML = note.graphic;
  target.setAttribute("aria-label", note.label);
}

function buildGrid() {
  grid.innerHTML = "";

  currentPattern.forEach((noteId, index) => {
    const fragment = cellTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".rhythm-cell");
    const indexEl = fragment.querySelector(".cell-index");
    const noteEl = fragment.querySelector(".cell-note");
    const labelEl = fragment.querySelector(".cell-label");
    const note = noteById(noteId);

    button.dataset.index = String(index);
    button.dataset.noteId = note.id;
    indexEl.textContent = String(index + 1).padStart(2, "0");
    renderNoteGraphic(noteEl, note);
    labelEl.textContent = note.label;

    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      button.classList.add("is-over");
    });

    button.addEventListener("dragleave", () => {
      button.classList.remove("is-over");
    });

    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("is-over");
      const noteIdFromDrop = event.dataTransfer.getData("text/plain");
      if (noteById(noteIdFromDrop)) {
        updateCell(index, noteIdFromDrop);
      }
    });

    button.addEventListener("click", () => {
      const nextIndex = (notes.findIndex((item) => item.id === button.dataset.noteId) + 1) % notes.length;
      updateCell(index, notes[nextIndex].id);
    });

    grid.appendChild(fragment);
  });
}

function buildPalette() {
  palette.innerHTML = "";

  notes.forEach((note) => {
    const fragment = paletteItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".palette-item");
    const noteEl = fragment.querySelector(".palette-note");
    const labelEl = fragment.querySelector(".palette-label");

    item.dataset.noteId = note.id;
    renderNoteGraphic(noteEl, note);
    labelEl.textContent = note.label;

    item.addEventListener("dragstart", (event) => {
      item.classList.add("dragging");
      event.dataTransfer.setData("text/plain", note.id);
      event.dataTransfer.effectAllowed = "copy";
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    palette.appendChild(fragment);
  });
}

function updateCell(index, noteId) {
  currentPattern[index] = noteId;
  const button = grid.children[index];
  const note = noteById(noteId);

  button.dataset.noteId = note.id;
  renderNoteGraphic(button.querySelector(".cell-note"), note);
  button.querySelector(".cell-label").textContent = note.label;
  statusText.textContent = `\u7b2c ${index + 1} \u683c\u5df2\u66f4\u65b0\u70ba ${note.label}\u3002`;
}

function updateTempoLabel() {
  tempoValue.textContent = tempoRange.value;
}

function resetScoreUI() {
  if (scoreValue) scoreValue.textContent = "0";
  if (comboValue) comboValue.textContent = "0";
  if (accuracyValue) accuracyValue.textContent = "0%";
  if (judgeText) judgeText.textContent = "\u2014";
}

function computeAccuracyPercent() {
  const hits = scoreState.counts.perfect + scoreState.counts.great + scoreState.counts.good;
  if (scoreState.expectedHitCount <= 0) return 100;
  return (hits / scoreState.expectedHitCount) * 100;
}

function updateScoreUI() {
  if (scoreValue) scoreValue.textContent = String(scoreState.score);
  if (comboValue) comboValue.textContent = String(scoreState.combo);
  if (accuracyValue) accuracyValue.textContent = `${Math.round(computeAccuracyPercent())}%`;
}

function setJudgeText(text) {
  if (judgeText) judgeText.textContent = text;
}

function clearFinalizeTimeouts() {
  scoreState.finalizeTimeoutIds.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });
  scoreState.finalizeTimeoutIds = [];
}

function applyMiss(stepIndex, suffix = "") {
  scoreState.counts.miss += 1;
  scoreState.combo = 0;
  scoreState.judged[stepIndex] = true;
  setJudgeText(`Miss${suffix}`);
  updateScoreUI();
}

function applyRestMistake(stepIndex) {
  scoreState.counts.restMistake += 1;
  scoreState.combo = 0;
  scoreState.judged[stepIndex] = true;
  setJudgeText("\u8AA4\u64CA");
  updateScoreUI();
}

function applyHit(stepIndex, tier, points, offsetMs) {
  scoreState.counts[tier] += 1;
  scoreState.score += points;
  scoreState.combo += 1;
  scoreState.maxCombo = Math.max(scoreState.maxCombo, scoreState.combo);
  scoreState.judged[stepIndex] = true;

  const rounded = Math.round(offsetMs);
  const signed = rounded >= 0 ? `+${rounded}` : `${rounded}`;
  setJudgeText(`${tier[0].toUpperCase()}${tier.slice(1)} ${signed}ms`);
  updateScoreUI();
}

function finalizeStep(stepIndex) {
  if (!scoreState.active) return;
  if (stepIndex < 0 || stepIndex >= scoreState.totalSteps) return;
  if (scoreState.judged[stepIndex]) return;
  if (!scoreState.expectHit[stepIndex]) return;
  applyMiss(stepIndex);
}

function startScoreSession() {
  scoreState.active = true;
  scoreState.totalSteps = currentPattern.length;
  scoreState.expectHit = currentPattern.map((noteId) => noteId !== "rest");
  scoreState.judged = Array.from({ length: scoreState.totalSteps }, () => false);
  scoreState.expectedHitCount = scoreState.expectHit.filter(Boolean).length;
  scoreState.counts = { perfect: 0, great: 0, good: 0, miss: 0, restMistake: 0 };
  scoreState.score = 0;
  scoreState.combo = 0;
  scoreState.maxCombo = 0;
  clearFinalizeTimeouts();
  resetScoreUI();
  updateScoreUI();
  setJudgeText("\u2014");
}

function endScoreSession() {
  if (!scoreState.active) return;
  scoreState.active = false;
  clearFinalizeTimeouts();

  const accuracy = Math.round(computeAccuracyPercent());
  statusText.textContent = `\u7D50\u7B97\uff1a\u5206\u6578 ${scoreState.score}\uff0c\u547D\u4E2D\u7387 ${accuracy}%\uff0c\u6700\u9AD8\u9023\u64CA ${scoreState.maxCombo}\u3002`;
  metronomeStartPerf = null;
  metronomeIntervalMs = null;
}

function cancelScoreSession() {
  scoreState.active = false;
  clearFinalizeTimeouts();
}

function randomizePattern() {
  const notePool = notes.map((note) => note.id);
  currentPattern = currentPattern.map(() => {
    const randomIndex = Math.floor(Math.random() * notePool.length);
    return notePool[randomIndex];
  });
  buildGrid();
  statusText.textContent = "\u5df2\u96A8\u6A5F\u751F\u6210 16 \u683C\u7BC0\u594F\u3002";
}

function setActiveCell(index) {
  [...grid.children].forEach((cell, cellIndex) => {
    cell.classList.toggle("is-active", cellIndex === index);
  });
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function flashMicDot() {
  if (!micDot) return;
  micDot.classList.add("is-hot");
  window.clearTimeout(micState.hotTimeoutId);
  micState.hotTimeoutId = window.setTimeout(() => {
    micDot.classList.remove("is-hot");
  }, 140);
}

function classifyHitOffset(offsetMs) {
  const abs = Math.abs(offsetMs);
  const rounded = Math.round(offsetMs);
  if (abs <= 80) return { label: "\u6E96", detail: `${rounded >= 0 ? "+" : ""}${rounded}ms` };
  if (offsetMs < 0) return { label: "\u504F\u5FEB", detail: `${rounded}ms` };
  return { label: "\u504F\u6162", detail: `+${rounded}ms` };
}

function registerHit(hitPerf) {
  if (!scoreState.active) return;
  if (!metronomeStartPerf || !metronomeIntervalMs) return;

  const elapsed = hitPerf - metronomeStartPerf;
  const nearestIndex = Math.round(elapsed / metronomeIntervalMs);
  if (nearestIndex < 0 || nearestIndex >= scoreState.totalSteps) return;
  if (scoreState.judged[nearestIndex]) return;

  const tickPerf = metronomeStartPerf + nearestIndex * metronomeIntervalMs;
  const offsetMs = hitPerf - tickPerf;
  const abs = Math.abs(offsetMs);

  if (!scoreState.expectHit[nearestIndex]) {
    applyRestMistake(nearestIndex);
    return;
  }

  if (abs <= 40) {
    applyHit(nearestIndex, "perfect", 100, offsetMs);
    return;
  }
  if (abs <= 80) {
    applyHit(nearestIndex, "great", 70, offsetMs);
    return;
  }
  if (abs <= 120) {
    applyHit(nearestIndex, "good", 40, offsetMs);
    return;
  }

  const rounded = Math.round(offsetMs);
  const signed = rounded >= 0 ? ` +${rounded}ms` : ` ${rounded}ms`;
  applyMiss(nearestIndex, signed);
}

function handleDetectedHit(hitPerf) {
  flashMicDot();

  if (scoreState.active) {
    registerHit(hitPerf);
  }

  if (!micText) return;

  if (!metronomeStartPerf || !metronomeIntervalMs) {
    micText.textContent = "\u6536\u5230\u8072\u97F3";
    return;
  }

  const elapsed = hitPerf - metronomeStartPerf;
  const nearestIndex = Math.round(elapsed / metronomeIntervalMs);
  const nearestTick = metronomeStartPerf + nearestIndex * metronomeIntervalMs;
  const offsetMs = hitPerf - nearestTick;
  const verdict = classifyHitOffset(offsetMs);

  micText.textContent = `${verdict.label} ${verdict.detail}`;
}

async function startMic() {
  if (micState.stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "\u6B64\u700F\u89BD\u5668\u4E0D\u652F\u63F4\u9EA5\u514B\u98A8\u6536\u97F3\u3002";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    ensureAudio();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.1;
    source.connect(analyser);

    micState.stream = stream;
    micState.analyser = analyser;
    micState.data = new Uint8Array(analyser.fftSize);
    micState.lastHitPerf = 0;

    if (micButton) micButton.textContent = "\u95DC\u9589\u9EA5\u514B\u98A8";
    if (micText) micText.textContent = "\u6536\u97F3\u4E2D";
    statusText.textContent = "\u9EA5\u514B\u98A8\u5DF2\u555F\u7528\uFF0C\u6572\u64CA\u6642\u6703\u505A\u5075\u6E2C\u3002";

    const loop = () => {
      micState.rafId = window.requestAnimationFrame(loop);
      analyser.getByteTimeDomainData(micState.data);

      let sum = 0;
      for (let i = 0; i < micState.data.length; i += 1) {
        const centered = (micState.data[i] - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / micState.data.length);
      const now = performance.now();

      if (rms >= micState.threshold && now - micState.lastHitPerf >= micState.minIntervalMs) {
        micState.lastHitPerf = now;
        handleDetectedHit(now);
      }
    };

    loop();
  } catch (error) {
    statusText.textContent = "\u9EA5\u514B\u98A8\u555F\u7528\u5931\u6557\uFF0C\u8ACB\u78BA\u8A8D\u5DF2\u6388\u6B0A\u3002";
  }
}

function stopMic() {
  if (micState.rafId) {
    window.cancelAnimationFrame(micState.rafId);
    micState.rafId = null;
  }
  if (micState.stream) {
    micState.stream.getTracks().forEach((track) => track.stop());
    micState.stream = null;
  }
  micState.analyser = null;
  micState.data = null;
  window.clearTimeout(micState.hotTimeoutId);
  if (micDot) micDot.classList.remove("is-hot");
  if (micButton) micButton.textContent = "\u555F\u7528\u9EA5\u514B\u98A8";
  if (micText) micText.textContent = "\u672A\u555F\u7528";
}

function tickSound(strong = false) {
  ensureAudio();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.value = strong ? 1240 : 880;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

function stopMetronomeTimer() {
  if (metronomeTimer) {
    window.clearInterval(metronomeTimer);
    metronomeTimer = null;
  }
}

function endPlayback() {
  stopMetronomeTimer();
  playButton.textContent = "\u958b\u59cb\u64ad\u653e";
  metronomeStartPerf = null;
  metronomeIntervalMs = null;
}

function scoringEnabled() {
  return Boolean(scoreToggle?.checked);
}

function syncScoreModeUI() {
  if (!loopToggle) return;
  if (scoringEnabled()) {
    loopToggle.checked = false;
    loopToggle.disabled = true;
  } else {
    loopToggle.disabled = false;
  }
}

function startPlayback() {
  stopPlayback();
  syncScoreModeUI();

  if (scoringEnabled() && !micState.stream) {
    statusText.textContent = "\u8ACB\u5148\u555F\u7528\u9EA5\u514B\u98A8\u4EE5\u9032\u884C\u8A55\u5206\u3002";
    setJudgeText("\u2014");
    return;
  }

  const bpm = Number(tempoRange.value);
  const intervalMs = (60 / bpm) * 1000;
  metronomeStartPerf = performance.now();
  metronomeIntervalMs = intervalMs;
  const totalSteps = currentPattern.length;
  let step = 0;
  const loopEnabled = () => {
    if (scoringEnabled()) return false;
    return loopToggle ? loopToggle.checked : true;
  };

  if (scoringEnabled()) {
    startScoreSession();
    setJudgeText("\u2014");
  }

  statusText.textContent = `\u64ad\u653e\u4e2d\uff0c\u6bcf\u62cd ${Math.round(intervalMs)} ms\u3002`;
  playButton.textContent = "\u64ad\u653e\u4e2d";

  const runStep = () => {
    activeIndex = step;
    setActiveCell(activeIndex);
    tickSound(activeIndex % 4 === 0);

    const note = noteById(currentPattern[activeIndex]);
    statusText.textContent = `\u7b2c ${activeIndex + 1} \u683c\uff1a${note.label}\uff0c\u901f\u5ea6 ${bpm} BPM\u3002`;

    if (scoreState.active) {
      scoreState.finalizeTimeoutIds.push(window.setTimeout(() => finalizeStep(activeIndex), 120));
    }
    step += 1;

    if (!loopEnabled() && step >= totalSteps) {
      if (scoreState.active) {
        stopMetronomeTimer();
        playButton.textContent = "\u958b\u59cb\u64ad\u653e";
      } else {
        endPlayback();
      }
      statusText.textContent = `\u5df2\u64ad\u653e\u5b8c\u4e00\u8f2a\uff0c\u901f\u5ea6 ${bpm} BPM\u3002`;

      if (scoreState.active) {
        window.setTimeout(() => {
          for (let i = 0; i < scoreState.totalSteps; i += 1) {
            finalizeStep(i);
          }
          endScoreSession();
        }, 140);
      }
      return;
    }

    if (step >= totalSteps) {
      step = 0;
    }
  };

  runStep();
  metronomeTimer = window.setInterval(runStep, intervalMs);
}

function stopPlayback() {
  endPlayback();

  activeIndex = -1;
  setActiveCell(activeIndex);
  statusText.textContent = "\u5df2\u505c\u6b62\uff0c\u53ef\u7e7c\u7e8c\u62d6\u66f3\u97f3\u7b26\u6216\u91cd\u65b0\u64ad\u653e\u3002";

  cancelScoreSession();
}

tempoRange.addEventListener("input", () => {
  updateTempoLabel();
  if (metronomeTimer) {
    startPlayback();
  }
});

playButton.addEventListener("click", startPlayback);
stopButton.addEventListener("click", stopPlayback);

if (micButton) {
  micButton.addEventListener("click", async () => {
    if (micState.stream) {
      stopMic();
      statusText.textContent = "\u9EA5\u514B\u98A8\u5DF2\u95DC\u9589\u3002";
      return;
    }
    await startMic();
  });
}

if (randomizeButton) {
  randomizeButton.addEventListener("click", () => {
    stopPlayback();
    randomizePattern();
    statusText.textContent = "\u5df2\u96a8\u6a5f\u751f\u6210\u7bc0\u594f\u3002";
  });
}

if (scoreToggle) {
  scoreToggle.addEventListener("change", () => {
    syncScoreModeUI();
    cancelScoreSession();
    resetScoreUI();
    setJudgeText("\u2014");
    if (metronomeTimer) {
      stopPlayback();
    }
  });
}

buildGrid();
buildPalette();
updateTempoLabel();
resetScoreUI();
syncScoreModeUI();
