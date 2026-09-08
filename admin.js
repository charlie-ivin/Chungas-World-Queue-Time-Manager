(() => {
  const CFG = window.PARK_CONFIG;
  let token = null;
  let data = { rides: [] };
  let nextTempId = 1;

  const repoLabel = document.getElementById("repoLabel");
  if (repoLabel) repoLabel.textContent = `${CFG.githubOwner}/${CFG.githubRepo}`;

  const dataPathLabel = document.getElementById("dataPathLabel");
  if (dataPathLabel) dataPathLabel.textContent = CFG.dataPath;

  const loginMsg = document.getElementById("loginMsg");
  const loginState = document.getElementById("loginState");
  const saveMsg = document.getElementById("saveMsg");

  function showMsg(el, text, ok) {
    el.innerHTML = `<div class="msg ${ok ? "ok" : "error"}">${text}</div>`;
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const val = document.getElementById("tokenInput").value.trim();
    if (!val) return;
    loginMsg.innerHTML = "";
    try {
      const url = `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${val}` } });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        showMsg(loginMsg, `Login failed (${res.status}): ${body.message || "Unknown error"}`, false);
        return;
      }
      if (!body.permissions || !body.permissions.push) {
        showMsg(loginMsg, "Token works but does not have write access.", false);
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
    const closedAllDayInput = document.getElementById("closedAllDayToggle");

    openInput.value = data.hours.open || "09:00";
    closeInput.value = data.hours.close || "20:00";
    extendedInput.checked = !!data.hours.extended;
    closedAllDayInput.checked = !!data.hours.closedAllDay;

    openInput.onchange = (e) => data.hours.open = e.target.value;
    closeInput.onchange = (e) => data.hours.close = e.target.value;
    extendedInput.onchange = (e) => data.hours.extended = e.target.checked;
    closedAllDayInput.onchange = (e) => data.hours.closedAllDay = e.target.checked;

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

    function updateCustom() {
      peCustomRow.style.display = peUseParkHours.checked ? "none" : "flex";
    }
    updateCustom();

    peEnabled.onchange = (e) => pe.enabled = e.target.checked;
    peUseParkHours.onchange = (e) => { pe.useParkHours = e.target.checked; updateCustom(); };
    peOpen.onchange = (e) => pe.open = e.target.value;
    peClose.onchange = (e) => pe.close = e.target.value;
  }

  function renderMap() {
    const canvas = document.getElementById("mapCanvas");
    canvas.innerHTML = "";
    if (CFG.mapImageUrl) {
      canvas.classList.add("has-image");
      canvas.style.backgroundImage = `url(${CFG.mapImageUrl})`;
      ParkCore.fitCanvasToImage(canvas, CFG.mapImageUrl);
    }

    canvas.onclick = (e) => {
      if (e.target !== canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      addRide(x, y);
    };

    data.rides.forEach(ride => renderPin(ride));
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
    pin.onmousedown = (e) => {
      dragging = true;
      pin.classList.add("dragging");
      e.stopPropagation();
    };
    document.onmousemove = (e) => {
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
    };
    document.onmouseup = () => {
      if (dragging) {
        dragging = false;
        pin.classList.remove("dragging");
      }
    };

    canvas.appendChild(pin);
  }

  function addRide(x, y) {
    const ride = {
      id: "tmp-" + nextTempId++,
      name: "New ride",
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      queue: 0,
      status: "open"
    };
    data.rides.push(ride);
    renderPin(ride);
    renderList();
  }

  function queueOptions(selected) {
    let opts = "";
    for (let v = CFG.queueMin; v <= CFG.queueMax; v += CFG.queueStep) {
      opts += `<option value="${v}" ${v === selected ? "selected" : ""}>${v} min</option>`;
    }
    return opts;
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

    data.rides.forEach(ride => {
      const row = document.createElement("div");
      row.className = "ride-row";
      row.innerHTML = `
        <div class="field"><label>Name</label><input type="text" value="${ride.name}" data-field="name"></div>
        <div class="field"><label>Queue time</label><select data-field="queue">${queueOptions(ride.queue)}</select></div>
        <div class="field"><label>Status</label><select data-field="status">${statusOptions(ride.status)}</select></div>
        <div class="field"><label><input type="checkbox" data-field="customEnabled" ${ride.customHours?.enabled ? "checked" : ""}> Custom hours</label></div>
        <div class="field" data-custom-fields style="display:${ride.customHours?.enabled ? "flex" : "none"}; gap:6px;">
          <div class="field"><label>Opens</label><input type="time" data-field="customOpen" value="${ride.customHours?.open || ""}"></div>
          <div class="field"><label>Closes</label><input type="time" data-field="customClose" value="${ride.customHours?.close || ""}"></div>
        </div>
        <button class="danger" data-action="delete">Remove</button>
      `;

      row.querySelector('[data-field="name"]').oninput = (e) => {
        ride.name = e.target.value;
        const pinLabel = document.querySelector(`.pin[data-id="${ride.id}"] .pin-label`);
        if (pinLabel) pinLabel.textContent = ride.name;
      };
      row.querySelector('[data-field="queue"]').onchange = (e) => ride.queue = parseInt(e.target.value);
      row.querySelector('[data-field="status"]').onchange = (e) => {
        ride.status = e.target.value;
        const marker = document.querySelector(`.pin[data-id="${ride.id}"] .pin-marker`);
        if (marker) marker.className = "pin-marker status-" + ride.status;
      };
      row.querySelector('[data-field="customEnabled"]').onchange = (e) => {
        if (!ride.customHours) ride.customHours = { enabled: false, open: "", close: "" };
        ride.customHours.enabled = e.target.checked;
        row.querySelector("[data-custom-fields]").style.display = e.target.checked ? "flex" : "none";
      };
      row.querySelector('[data-field="customOpen"]').onchange = (e) => {
        if (!ride.customHours) ride.customHours = { enabled: false, open: "", close: "" };
        ride.customHours.open = e.target.value;
      };
      row.querySelector('[data-field="customClose"]').onchange = (e) => {
        if (!ride.customHours) ride.customHours = { enabled: false, open: "", close: "" };
        ride.customHours.close = e.target.value;
      };
      row.querySelector('[data-action="delete"]').onclick = () => {
        data.rides = data.rides.filter(r => r.id !== ride.id);
        document.querySelector(`.pin[data-id="${ride.id}"]`)?.remove();
        renderList();
      };

      list.appendChild(row);
    });
  }

  document.getElementById("saveBtn").addEventListener("click", async () => {
    saveMsg.innerHTML = "";
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/${CFG.dataPath}?ref=${CFG.githubBranch}&_=${Date.now()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!getRes.ok) {
        showMsg(saveMsg, `Couldn't read file (${getRes.status})`, false);
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
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: "Update park data",
            content,
            sha: getJson.sha,
            branch: CFG.githubBranch
          })
        }
      );
      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        showMsg(saveMsg, `Save failed: ${err.message || putRes.status}`, false);
        return;
      }
      showMsg(saveMsg, "Saved successfully!", true);
    } catch (e) {
      showMsg(saveMsg, "Network error while saving.", false);
    }
  });
})();
