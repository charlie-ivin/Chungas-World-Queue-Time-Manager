(() => {
  const CFG = window.PARK_CONFIG;
  let token = null; // in-memory only, never persisted
  let data = { rides: [] };

  document.getElementById("repoLabel").textContent = `${CFG.githubOwner}/${CFG.githubRepo}`;
  document.getElementById("dataPathLabel").textContent = CFG.dataPath;

  const loginMsg = document.getElementById("loginMsg");
  const loginState = document.getElementById("loginState");
  const saveMsg = document.getElementById("saveMsg");

  function showMsg(el, text, ok) {
    el.innerHTML = `<div class="msg ${ok ? "ok" : "error"}">${text}</div>`;
  }

  // ── Login ──────────────────────────────────────────────
  document.getElementById("loginBtn").addEventListener("click", async () => {
    const val = document.getElementById("tokenInput").value.trim();
    if (!val) return;
    loginMsg.innerHTML = "";
    try {
      const url = `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${val}` } });
      const body = await res.json().catch(() => ({}));
      console.log("Admin login check:", url, res.status, body);

      if (!res.ok) {
        showMsg(
          loginMsg,
          `Request to ${url} failed (status ${res.status}): ${body.message || "no message from GitHub"}. Open the browser console (F12) for full details.`,
          false
        );
        return;
      }
      const repoInfo = body;
      if (!repoInfo.permissions || !repoInfo.permissions.push) {
        showMsg(loginMsg, "Token works and repo was found, but it doesn't have write (push) access — check the token's scope.", false);
        return;
      }
      token = val;
      document.getElementById("tokenInput").value = "";
      document.getElementById("loginPanel").style.display = "none";
      document.getElementById("adminMain").style.display = "block";
      loginState.textContent = "Logged in";
      loginState.classList.add("extended");
      await loadAndRender();
    } catch (e) {
      showMsg(loginMsg, "Network error contacting GitHub.", false);
    }
  });

  // ── Load data.json + render map & list ─────────────────
  async function loadAndRender() {
    data = await ParkCore.loadData();
    renderHours();
    renderMap();
    renderList();
  }

  function renderHours() {
    const openInput = document.getElementById("openTime");
    const closeInput = document.getElementById("closeTime");
    const extendedInput = document.getElementById("extendedToggle");

    openInput.value = data.hours.open || "09:00";
    closeInput.value = data.hours.close || "20:00";
    extendedInput.checked = !!data.hours.extended;

    openInput.addEventListener("change", (e) => { data.hours.open = e.target.value; });
    closeInput.addEventListener("change", (e) => { data.hours.close = e.target.value; });
    extendedInput.addEventListener("change", (e) => { data.hours.extended = e.target.checked; });

    const closedAllDayInput = document.getElementById("closedAllDayToggle");
    closedAllDayInput.checked = !!data.hours.closedAllDay;
    closedAllDayInput.addEventListener("change", (e) => { data.hours.closedAllDay = e.target.checked; });

    // ── Private event ──
    if (!data.hours.privateEvent) {
      data.hours.privateEvent = { enabled: false, useParkHours: true, open: "", close: "" };
    }
    const pe = data.hours.privateEvent;

    const peEnabled = document.getElementById("privateEventEnabled");
    const peUseParkHours = document.getElementById("privateEventUseParkHours");
    const peOpen = document.getElementById("privateEventOpen");
    const peClose = document.getElementById("privateEventClose");
    const peCustomRow = document.getElementById("privateEventCustomRow");

    peEnabled.checked = !!pe.enabled;
    peUseParkHours.checked = pe.useParkHours !== false;
    peOpen.value = pe.open || "";
    peClose.value = pe.close || "";

    function updateCustomRowVisibility() {
      peCustomRow.style.display = peUseParkHours.checked ? "none" : "flex";
    }
    updateCustomRowVisibility();

    peEnabled.addEventListener("change", (e) => { pe.enabled = e.target.checked; });
    peUseParkHours.addEventListener("change", (e) => {
      pe.useParkHours = e.target.checked;
      updateCustomRowVisibility();
    });
    peOpen.addEventListener("change", (e) => { pe.open = e.target.value; });
    peClose.addEventListener("change", (e) => { pe.close = e.target.value; });
  }

  function renderMap() {
    const canvas = document.getElementById("mapCanvas");
    canvas.innerHTML = "";
    if (CFG.mapImageUrl) {
      canvas.classList.add("has-image");
      canvas.style.backgroundImage = `url(${CFG.mapImageUrl})`;
      ParkCore.fitCanvasToImage(canvas, CFG.mapImageUrl);
    }

    canvas.addEventListener("click", (e) => {
      if (e.target !== canvas) return; // ignore clicks on existing pins
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      addRide(x, y);
    });

    data.rides.forEach((ride) => renderPin(ride));
  }

  function renderPin(ride) {
    const canvas = document.getElementById("mapCanvas");
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.style.left = ride.x + "%";
    pin.style.top = ride.y + "%";
    pin.dataset.id = ride.id;

    const marker = document.createElement("div");
    marker.className = "pin-marker status-" + ride.status;
    pin.appendChild(marker);

    const label = document.createElement("div");
    label.className = "pin-label";
    label.textContent = ride.name;
    pin.appendChild(label);

    let dragging = false;
    pin.addEventListener("mousedown", (e) => {
      dragging = true;
      pin.classList.add("dragging");
      e.stopPropagation();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      pin.style.left = x + "%";
      pin.style.top = y + "%";
      ride.x = Math.round(x * 10) / 10;
      ride.y = Math.round(y * 10) / 10;
    });
    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        pin.classList.remove("dragging");
      }
    });

    canvas.appendChild(pin);
  }

  function generateRideId() {
    return "ride-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function addRide(x, y) {
    const ride = {
      id: generateRideId(),
      name: "New ride",
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      queue: 0,
      status: "open",
    };
    data.rides.push(ride);
    renderPin(ride);
    renderList();
  }

  // ── Ride list editor ────────────────────────────────────
  function queueOptions(selected) {
    const opts = [`<option value="na" ${selected === "na" ? "selected" : ""}>N/A — just show Open</option>`];
    for (let v = CFG.queueMin; v <= CFG.queueMax; v += CFG.queueStep) {
      opts.push(`<option value="${v}" ${v === selected ? "selected" : ""}>${v} min</option>`);
    }
    return opts.join("");
  }

  function statusOptions(selected) {
    return Object.entries(ParkCore.STATUS_LABELS)
      .map(([val, label]) => `<option value="${val}" ${val === selected ? "selected" : ""}>${label}</option>`)
      .join("");
  }

  function renderList() {
    const list = document.getElementById("rideList");
    list.innerHTML = "";
    if (data.rides.length === 0) {
      list.innerHTML = "<p>No rides yet — click the map above to add one.</p>";
      return;
    }
