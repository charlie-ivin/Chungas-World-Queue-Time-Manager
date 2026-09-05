// ── SHARED PARK LOGIC ─────────────────────────────────────────
// Used by both index.html (public map) and admin.html.

const ParkCore = (() => {
  const CFG = window.PARK_CONFIG;

  // ---- data.json (hours + rides + pins) --------------------------
  async function loadData() {
    const res = await fetch("./data.json?_=" + Date.now());
    if (!res.ok) throw new Error("Could not load data.json");
    const data = await res.json();
    if (!data.hours) {
      data.hours = { open: "09:00", close: "20:00", extended: false };
    }
    return data;
  }

  // ---- time helpers ------------------------------------------------
  function timeStringToMinutes(str) {
    if (!str) return null;
    const [h, m] = str.split(":").map((n) => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
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

  // ---- Decide park-level status right now ---------------------------
  function computeParkStatus(hours) {
    const open = timeStringToMinutes(hours.open);
    const close = timeStringToMinutes(hours.close);

    if (hours.extended) {
      return { isOpen: true, isOpeningSoon: false, reason: "Extended hours in effect" };
    }
    if (open === null || close === null) {
      return { isOpen: true, isOpeningSoon: false, reason: "Hours not set — showing rides as configured" };
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isOpen =
      close > open
        ? nowMinutes >= open && nowMinutes < close
        : nowMinutes >= open || nowMinutes < close; // overnight wrap

    // "Opening soon": it's after midnight but before today's opening time
    // (only meaningful when the schedule doesn't wrap overnight).
    const isOpeningSoon = !isOpen && close > open && nowMinutes < open;

    return {
      isOpen,
      isOpeningSoon,
      reason: isOpen
        ? "Within opening hours"
        : isOpeningSoon
        ? "Before today's opening time"
        : "Past closing time — all rides shown closed",
    };
  }

  const STATUS_LABELS = {
    open: "Open",
    engineering: "Closed — Engineering Work",
    closed: "Closed — All Day",
    temp_shut: "Temporarily Shut",
  };

  // ---- Match the map canvas aspect ratio to the real image ----------
  function fitCanvasToImage(canvasEl, imageUrl) {
    return new Promise((resolve) => {
      if (!imageUrl) {
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => {
        canvasEl.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        resolve();
      };
      img.onerror = () => resolve(); // fall back to default ratio if it fails to load
      img.src = imageUrl;
    });
  }

  return {
    CFG,
    loadData,
    timeStringToMinutes,
    computeParkStatus,
    formatMinutes,
    STATUS_LABELS,
    fitCanvasToImage,
  };
})();
