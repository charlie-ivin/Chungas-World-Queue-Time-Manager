(() => {
  const CFG = window.PARK_CONFIG;
  let token = null; // in-memory only, never persisted
  let data = { rides: [] };
  let nextTempId = 1;

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

  function addRide(x, y) {
    const ride = {
      id: "tmp-" + nextTempId++,
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
    const opts = [];
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
    data.rides.forEach((ride) => {
      const row = document.createElement("div");
      row.className = "ride-row";
      row.innerHTML = `
        <div class="field">
          <label>Name</label>
          <input type="text" value="${ride.name}" data-field="name" />
        </div>
        <div class="field">
          <label>Queue time</label>
          <select data-field="queue">${queueOptions(ride.queue)}</select>
        </div>
        <div class="field">
          <label>Status</label>
          <select data-field="status">${statusOptions(ride.status)}</select>
        </div>
        <button class="danger" data-action="delete">Remove</button>
      `;
      row.querySelector('[data-field="name"]').addEventListener("input", (e) => {
        ride.name = e.target.value;
        const pin = document.querySelector(`.pin[data-id="${ride.id}"] .pin-label`);
        if (pin) pin.textContent = ride.name;
      });
      row.querySelector('[data-field="queue"]').addEventListener("change", (e) => {
        ride.queue = parseInt(e.target.value, 10);
      });
      row.querySelector('[data-field="status"]').addEventListener("change", (e) => {
        ride.status = e.target.value;
        const marker = document.querySelector(`.pin[data-id="${ride.id}"] .pin-marker`);
        if (marker) marker.className = "pin-marker status-" + ride.status;
      });
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        data.rides = data.rides.filter((r) => r.id !== ride.id);
        const pin = document.querySelector(`.pin[data-id="${ride.id}"]`);
        if (pin) pin.remove();
        renderList();
      });
      list.appendChild(row);
    });
  }

  // ── Save (commit) to GitHub ─────────────────────────────
  document.getElementById("saveBtn").addEventListener("click", async () => {
    saveMsg.innerHTML = "";
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/${CFG.dataPath}?ref=${CFG.githubBranch}&_=${Date.now()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!getRes.ok) {
        showMsg(saveMsg, `Couldn't read current file (status ${getRes.status}).`, false);
        return;
      }
      const getJson = await getRes.json();
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

      const putRes = await fetch(
        `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/${CFG.dataPath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Update park data",
            content,
            sha: getJson.sha,
            branch: CFG.githubBranch,
          }),
        }
      );
      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        const hint =
          putRes.status === 409
            ? " This usually means the file changed elsewhere since you loaded this page — reload admin.html (your unsaved edits will be lost, so note them down first) and try again."
            : "";
        showMsg(saveMsg, `Save failed (status ${putRes.status}): ${errJson.message || "unknown error"}.${hint}`, false);
        return;
      }
      showMsg(saveMsg, "Saved. The public map will pick this up on its next refresh.", true);
    } catch (e) {
      showMsg(saveMsg, "Network error while saving.", false);
    }
  });
})();
