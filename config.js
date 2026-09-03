// ── PARK CONFIG ───────────────────────────────────────────────
// Edit these values, then commit. This file is public — never put
// a GitHub token in here. The Google API key below is safe to
// expose as long as you restrict it (see README) to the Calendar
// API + your site's URL in the Google Cloud Console.

window.PARK_CONFIG = {
  // Google Calendar
  // Calendar must be shared as "Make available to public" (Settings
  // → Access permissions) so the API can read it without login.
  calendarId: "72758bd116cd1e17d385efc0726424bf904ec0347b78ffc5200b7068196d3afe@group.calendar.google.com",
googleApiKey: "YOUR_GOOGLE_API_KEY",   // still needs your real key when you're ready

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
