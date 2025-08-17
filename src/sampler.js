// src/sampler.js

window.sampler = (a, b, c) => {
  // Dummy to make sure this is always valid
};

window.calculatePanFromPosition = (
  thing,
  player,
  displayWidth,
  maxPan = 0.8,
) => {
  const { x } = thing;
  const wmin = player.x - displayWidth / 2;
  const wmax = player.x + displayWidth / 2;

  if (wmax <= wmin) {
    return 0;
  }

  const width = wmax - wmin;
  const clampedX = Math.max(wmin, Math.min(wmax, x));
  const normalizedPos = (clampedX - wmin) / width; // 0 to 1
  const panValue = normalizedPos * 2 * maxPan - maxPan; // -maxPan to +maxPan

  return Math.max(-maxPan, Math.min(maxPan, panValue));
};

// Mapping from sound names to musical notes
const soundMap = {
  "revolver-shot-1": "C1",
  "revolver-shot-2": "C2",
  "revolver-shot-3": "C3",
  "hit-rock": "E1",
  /*"shotgun": "C",
  "hit-flesh": "D#1",
  
  ricochet: "F1",
  reload: "F#1",
  duck: "G1",
  stand: "G#1",
  pickup: "A1",
  eat: "A#1",
  "ui-open": "B1",
  "ui-close": "C2",
  scream: "C#2",
  talk: "D2",
  spot: "D#2",
  misfire: "E2",
  empty: "F2",*/
};

// Create the sampler configuration from the sound map
const samplerUrls = {};
for (const [name, note] of Object.entries(soundMap)) {
  samplerUrls[note] = `${name.replace(/ /g, "-")}.mp3`;
}

const panner = new Tone.Panner(0).toDestination();

const sampler = new Tone.Sampler({
  attack: 0,
  urls: samplerUrls,
  baseUrl: "audio/",
  curve: "exponential",
  release: 1,
  volume: -10,
  onload: () => {
    console.log("Tone.js sampler loaded.");
  },
}).connect(panner);

window.sampler = (soundName, duration, settings = {}) => {
  const note = soundMap[soundName];
  if (!note) {
    console.info(`Could not find ${soundName}`);
    return;
  }

  try {
    console.info(`Playing ${soundName}`);
    const velocity = settings.velocity ?? 1;
    const pan = settings.pan ?? 0;
    const delay = settings.delay ?? 0;
    const now = Tone.now();
    const startTime = now + delay;
    panner.pan.setValueAtTime(pan, startTime);
    sampler.triggerAttackRelease(note, duration, startTime, velocity);
  } catch (err) {
    // This can be noisy if tone.js is not present.
  }
};
