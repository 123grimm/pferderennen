const racerPalette = [
  { name: "Reynolds", color: "#ef476f" },
  { name: "Cotta", color: "#3a86ff" },
  { name: "Matilda", color: "#06d6a0" },
  { name: "Blacky", color: "#ffd166" },
  { name: "Morton", color: "#ff8c42" }
];

const RACE_DURATION_SECONDS = 30;
const RACER_WIDTH_PX = 54;
const FINISH_OFFSET_RATIO = 0.02;
const HEAD_CONTACT_RATIO = 0.82;

const startButton = document.getElementById("startButton");
const winnerBanner = document.getElementById("winnerBanner");
const track = document.getElementById("track");
const laneTemplate = document.getElementById("laneTemplate");

let racers = [];
let animationFrameId = null;
let raceStartedAt = 0;
let raceState = "idle";

createLanes();
startButton.addEventListener("click", handlePrimaryButton);
window.addEventListener("resize", renderRace);

function createLanes() {
  const fragment = document.createDocumentFragment();

  racerPalette.forEach((racerData, index) => {
    const laneNode = laneTemplate.content.firstElementChild.cloneNode(true);
    const label = laneNode.querySelector(".lane-label");
    const racerElement = laneNode.querySelector(".racer");
    const horseElement = laneNode.querySelector(".racer-horse");

    label.textContent = `Bahn ${index + 1}`;
    racerElement.dataset.name = racerData.name;
    horseElement.style.color = racerData.color;
    horseElement.style.textShadow = `0 0 18px ${shadeColor(racerData.color, 12)}`;

    fragment.appendChild(laneNode);

    racers.push({
      ...racerData,
      element: racerElement,
      position: 0,
      targetProgress: 0,
      laneIndex: index,
      skill: 0,
      earlyPatience: 0,
      phaseOffset: 0,
      surgeCenter: 0,
      surgeStrength: 0,
      fatigueCenter: 0,
      fatigueStrength: 0
    });
  });

  track.replaceChildren(fragment);
  resetRace();
}

function handlePrimaryButton() {
  if (raceState === "running") {
    return;
  }

  if (raceState === "finished") {
    resetRace();
    return;
  }

  startRace();
}

function startRace() {
  raceStartedAt = performance.now();
  raceState = "running";
  startButton.disabled = true;
  startButton.textContent = "Rennen laeuft";
  winnerBanner.classList.remove("is-visible");
  winnerBanner.classList.add("hidden");
  winnerBanner.textContent = "Gewinner: -";

  racers.forEach((racer) => {
    racer.position = 0;
    racer.targetProgress = 0;
    racer.skill = randomBetween(0.86, 1.12);
    racer.earlyPatience = randomBetween(0.03, 0.11);
    racer.phaseOffset = randomBetween(0, Math.PI * 2);
    racer.surgeCenter = randomBetween(0.55, 0.88);
    racer.surgeStrength = randomBetween(0.015, 0.05);
    racer.fatigueCenter = randomBetween(0.38, 0.72);
    racer.fatigueStrength = randomBetween(0.01, 0.035);
  });

  animationFrameId = requestAnimationFrame(updateRace);
}

function updateRace(timestamp) {
  const elapsed = (timestamp - raceStartedAt) / 1000;
  const normalizedTime = clamp(elapsed / RACE_DURATION_SECONDS, 0, 1);

  let winner = null;

  racers.forEach((racer) => {
    const progress = computeProgress(racer, normalizedTime);
    racer.targetProgress = Math.max(racer.targetProgress, progress);
    racer.position = racer.targetProgress;

    if (!winner && racer.position >= 1) {
      winner = racer;
    }
  });

  renderRace();

  if (winner) {
    finishRace(winner);
    return;
  }

  if (elapsed >= RACE_DURATION_SECONDS) {
    const fallbackWinner = [...racers].sort((left, right) => right.position - left.position)[0];
    finishRace(fallbackWinner);
    return;
  }

  animationFrameId = requestAnimationFrame(updateRace);
}

function finishRace(winner) {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = null;
  raceState = "finished";

  winner.position = Math.max(winner.position, 1.01);

  renderRace();

  startButton.disabled = false;
  startButton.textContent = "Nochmal spielen";
  winnerBanner.textContent = `Gewinner: ${winner.name}`;
  winnerBanner.classList.remove("hidden");
  winnerBanner.classList.remove("is-visible");
  void winnerBanner.offsetWidth;
  winnerBanner.classList.add("is-visible");
}

function resetRace() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  raceState = "idle";
  startButton.disabled = false;
  startButton.textContent = "Rennen starten";
  winnerBanner.classList.remove("is-visible");
  winnerBanner.classList.add("hidden");
  winnerBanner.textContent = "Gewinner: -";

  racers.forEach((racer) => {
    racer.position = 0;
    racer.targetProgress = 0;
  });

  renderRace();
}

function renderRace() {
  const laneTrack = track.querySelector(".lane-track");
  if (!laneTrack) {
    return;
  }

  const laneWidth = laneTrack.clientWidth;
  const finishOffset = laneWidth * FINISH_OFFSET_RATIO;
  const finishX = laneWidth - finishOffset - RACER_WIDTH_PX * HEAD_CONTACT_RATIO;

  racers.forEach((racer) => {
    const distance = racer.position * finishX;
    racer.element.style.transform = `translate3d(${distance}px, -50%, 0)`;
  });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeProgress(racer, normalizedTime) {
  const smoothStart = Math.pow(normalizedTime, 1.25);
  const forwardCurve = smoothBlend(easeOutCubic(smoothStart), normalizedTime, 0.28);
  const baseMovement = forwardCurve * (0.9 + racer.skill * 0.09);
  const rhythm = oscillation(normalizedTime, 3.2, racer.phaseOffset) * 0.012;
  const surge = gaussian(normalizedTime, racer.surgeCenter, 0.14) * racer.surgeStrength;
  const fatigue = gaussian(normalizedTime, racer.fatigueCenter, 0.15) * racer.fatigueStrength;
  const lateKick = Math.max(0, normalizedTime - 0.78) * 0.18;
  const patiencePenalty = (1 - normalizedTime) * racer.earlyPatience * 0.05;
  const target = baseMovement + rhythm + surge - fatigue + lateKick - patiencePenalty;

  return clamp(target, 0, 1.06);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function smoothBlend(left, right, ratio) {
  return left * (1 - ratio) + right * ratio;
}

function oscillation(value, frequency, offset) {
  return Math.sin(value * Math.PI * frequency + offset) * (1 - value * 0.35);
}

function gaussian(value, center, width) {
  const distance = value - center;
  return Math.exp(-((distance * distance) / (2 * width * width)));
}

function shadeColor(hex, percent) {
  const value = parseInt(hex.replace("#", ""), 16);
  const adjustment = Math.round(2.55 * percent);
  const red = (value >> 16) + adjustment;
  const green = ((value >> 8) & 0x00ff) + adjustment;
  const blue = (value & 0x0000ff) + adjustment;

  return `#${(
    0x1000000 +
    clampChannel(red) * 0x10000 +
    clampChannel(green) * 0x100 +
    clampChannel(blue)
  )
    .toString(16)
    .slice(1)}`;
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, value));
}
