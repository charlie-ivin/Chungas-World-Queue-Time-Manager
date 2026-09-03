// ── SHARED PARK LOGIC ─────────────────────────────────────────
// Used by both index.html (public map) and admin.html.

const ParkCore = (() => {
  const CFG = window.PARK_CONFIG;

  // ---- data.json (rides + pins) -------------------------------
  async function loadData() {
    const res = await fetch("./data.json?_=" + Date.now());
    if (!res.ok) throw new Error("Could not load data.json");
    return res.json();
  }

  // ---- Google Calendar: fetch today's single event title -------
  async function fetchTodayEventTitle() {
    const { calendarId, googleApiKey } = CFG;
    if (!calendarId || !googleApiKey || googleApiKey === "YOUR_GOOGLE_API_KEY") {
      return { title: null, error: "Calendar not configured yet" };
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      `?key=${encodeURIComponent(googleApiKey)}` +
      `&timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}` +
      `&singleEvents=true&orderBy=startTime`;

    try {
      const res = await fetch(url);
      if (!res.ok) return { title: null, error: `Calendar API error (${res.status})` };
      const json = await res.json();
      const items = json.items || [];
      if (items.length === 0) return { title: null, error: "No event found for today" };
      // "There's only one event per day" — take the first.
      return { title: items[0].summary || "", error: null };
    } catch (e) {
      return { title: null, error: "Network error reaching Google Calendar" };
    }
  }

  // ---- Parse "Open between 9am and 8pm [extended hours]" --------
  function parseTimeToken(token) {
    token = token.trim().toLowerCase();
    let match = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!match) return null;
    let [, h, m, ap] = match;
    h = parseInt(h, 10);
    m = m ? parseInt(m, 10) : 0;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h * 60 + m; // minutes since midnight
  }

  function parseEventTitle(title) {
    if (!title) {
      return { open: null, close: null, extended: false, raw: title };
    }
    const extended = /\[\s*extended\s*hours\s*\]/i.test(title);
    const between = title.match(
      /between\s+([\d:apm\s]+?)\s+and\s+([\d:apm\s]+?)(?:\s*\[|\s*$)/i
    );
    let open = null,
      close = null;
    if (between) {
      open = parseTimeToken(between[1]);
      close = parseTimeToken(between[2]);
    }
    return { open, close, extended, raw: title };
  }

  // ---- Decide park-level status right now ------------------------
  function computeParkStatus(parsed) {
    if (!parsed || parsed.open === null || parsed.close === null) {
      return { isOpen: true, reason: "Hours not set — showing rides as configured" };
    }
    if (parsed.extended) {
      return { isOpen: true, reason: "Extended hours in effect" };
    }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    // Handle overnight ranges (close < open) by wrapping past midnight.
    const pastClose =
      parsed.close > parsed.open
        ? nowMinutes >= parsed.close || nowMinutes < parsed.open && false
        : false;
    const isOpen =
      parsed.close > parsed.open
        ? nowMinutes >= parsed.open && nowMinutes < parsed.close
        : nowMinutes >= parsed.open || nowMinutes < parsed.close;
    return {
      isOpen,
      reason: isOpen ? "Within opening hours" : "Past closing time — all rides shown closed",
    };
  }

  function formatMinutes(mins) {
    if (mins === null || mins === undefined) return "—";
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ap = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
  }

  const STATUS_LABELS = {
    open: "Open",
    engineering: "Closed — Engineering Work",
    closed: "Closed — All Day",
    temp_shut: "Temporarily Shut",
  };

  return {
    CFG,
    loadData,
    fetchTodayEventTitle,
    parseEventTitle,
    computeParkStatus,
    formatMinutes,
    STATUS_LABELS,
  };
})();
