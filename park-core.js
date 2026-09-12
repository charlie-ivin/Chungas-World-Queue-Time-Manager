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
    if (!data.hours.privateEvent) {
      data.hours.privateEvent = { enabled: false, useParkHours: true, open: "", close: "" };
    }
    if (data.hours.privateEvent.useParkHours === undefined) {
      data.hours.privateEvent.useParkHours = true;
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
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Private event override — takes priority over everything else
    // when it's enabled and we're currently within its window.
    const pe = hours.privateEvent;
    if (pe && pe.enabled) {
      const peOpenStr = pe.useParkHours ? hours.open : pe.open;
      const peCloseStr = pe.useParkHours ? hours.close : pe.close;
      const peOpen = timeStringToMinutes(peOpenStr);
      const peClose = timeStringToMinutes(peCloseStr);
      if (peOpen !== null && peClose !== null) {
        const inWindow =
          peClose > peOpen
            ? nowMinutes >= peOpen && nowMinutes < peClose
            : nowMinutes >= peOpen || nowMinutes < peClose;
        if (inWindow) {
          return {
            isOpen: true,
            isOpeningSoon: false,
            isClosingSoon: false,
            isPrivateEvent: true,
            reason: "Private event in progress",
          };
        }
      }
    }
    if (hours.seasonalClosure && hours.seasonalClosure.enabled) {
      return {
        isOpen: false,
        isOpeningSoon: false,
        isClosingSoon: false,
        isPrivateEvent: false,
        isSeasonalClosure: true,
        seasonalMessage: hours.seasonalClosure.reopenText || "",
        reason: "Closed for the season",
      };
    }

    if (hours.closedAllDay) {
      return {
        isOpen: false,
        isOpeningSoon: false,
        isClosingSoon: false,
        isPrivateEvent: false,
        reason: "Park closed all day",
      };
    }

    if (hours.extended) {
      return {
        isOpen: true,
        isOpeningSoon: false,
        isClosingSoon: false,
        isPrivateEvent: false,
        reason: "Extended hours in effect",
      };
    }

    const open = timeStringToMinutes(hours.open);
    const close = timeStringToMinutes(hours.close);
    if (open === null || close === null) {
      return {
        isOpen: true,
        isOpeningSoon: false,
        isClosingSoon: false,
        isPrivateEvent: false,
        reason: "Hours not set — showing rides as configured",
      };
    }

    const isOpen =
      close > open
        ? nowMinutes >= open && nowMinutes < close
        : nowMinutes >= open || nowMinutes < close; // overnight wrap

    const isOpeningSoon = !isOpen && close > open && nowMinutes < open;

    let isClosingSoon = false;
    if (isOpen) {
      const remaining =
        close > open
          ? close - nowMinutes
          : nowMinutes < close
          ? close - nowMinutes
          : close + 1440 - nowMinutes;
      isClosingSoon = remaining > 0 && remaining <= 30;
    }

    return {
      isOpen,
      isOpeningSoon,
      isClosingSoon,
      isPrivateEvent: false,
      reason: isOpen
        ? isClosingSoon
          ? "Closing within 30 minutes"
          : "Within opening hours"
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
    private_event: "Private Event",
  };

  // ---- Per-ride custom hours (opens late / closes early) -------------
  function computeRideCustomStatus(custom) {
    const open = timeStringToMinutes(custom.open);
    const close = timeStringToMinutes(custom.close);
    if (open === null || close === null) {
      return { inWindow: true, before: false, after: false };
    }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const inWindow =
      close > open
        ? nowMinutes >= open && nowMinutes < close
        : nowMinutes >= open || nowMinutes < close;
    const before = !inWindow && close > open && nowMinutes < open;
    const after = !inWindow && !before;
    return { inWindow, before, after };
  }

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
      img.onerror = () => resolve();
      img.src = imageUrl;
    });
  }

  return {
    CFG,
    loadData,
    timeStringToMinutes,
    computeParkStatus,
    computeRideCustomStatus,
    formatMinutes,
    STATUS_LABELS,
    fitCanvasToImage,
  };
})();
