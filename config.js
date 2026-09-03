// ── PARK CONFIG ───────────────────────────────────────────────
// Edit these values, then commit. This file is public — never put
// a GitHub token in here.

window.PARK_CONFIG = {
  // GitHub repo that hosts this site + data.json
  // (used by the admin page to save changes)
  githubOwner: "charlie-ivin",
  githubRepo: "Chungas-World-Queue-Time-Manager",
  githubBranch: "main",
  dataPath: "data.json",

  // Map background. Leave as null to use the placeholder grid
  // until you have a real screenshot/render of the park.
  mapImageUrl: null,

  // Ride queue-time dropdown range (multiples of 5)
  queueMin: 0,
  queueMax: 60,
  queueStep: 5,
};
