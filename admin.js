(() => {
  const CFG = window.PARK_CONFIG;

  let token = null;
  let data = { rides: [], hours: {} };

  const canvas = document.getElementById("mapCanvas");
  const loginMsg = document.getElementById("loginMsg");
  const loginState = document.getElementById("loginState");
  const saveMsg = document.getElementById("saveMsg");

  let draggedRide = null;

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function showMsg(el, text, ok) {
    el.innerHTML = `<div class="msg ${ok ? "ok" : "error"}">${text}</div>`;
  }

  /*
   * Generate a completely unique ride ID.
   *
   * This checks EVERY existing ride before creating the ID.
   * It therefore works even if the admin page has been reloaded.
   */
  function generateRideId() {
    const existingIds = new Set(
      data.rides
        .map((ride) => String(ride.id || ""))
        .filter(Boolean)
    );

    let number = 1;

    while (existingIds.has(`ride-${number}`)) {
      number++;
    }

    return `ride-${number}`;
  }

  /*
   * Make sure every existing ride has a unique ID.
   *
   * This automatically fixes the old tmp-2 duplicates when
   * the admin page loads.
   */
  function normaliseRideIds() {
    const usedIds = new Set();

    data.rides.forEach((ride) => {
      let id = String(ride.id || "").trim();

      // Missing ID
      if (!id) {
        id = generateUnusedId(usedIds);
      }

      // Duplicate ID
      if (usedIds.has(id)) {
        id = generateUnusedId(usedIds);
      }

      ride.id = id;
      usedIds.add(id);
    });
  }

  function generateUnusedId(usedIds) {
    let number = 1;
    let id = `ride-${number}`;

    while (usedIds.has(id)) {
      number++;
      id = `ride-${number}`;
    }

    return id;
  }

  // ------------------------------------------------------------
  // Labels
  // ------------------------------------------------------------

  document.getElementById("repoLabel").textContent =
    `${CFG.githubOwner}/${CFG.githubRepo}`;

  document.getElementById("dataPathLabel").textContent =
    CFG.dataPath;

  // ------------------------------------------------------------
  // Login
  // ------------------------------------------------------------

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const val = document.getElementById("tokenInput").value.trim();

    if (!val) return;

    loginMsg.innerHTML = "";

    try {
      const url =
        `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${val}`
        }
      });

      const body = await res.json().catch(() => ({}));

      console.log(
        "Admin login check:",
        url,
        res.status,
        body
      );

      if (!res.ok) {
        showMsg(
          loginMsg,
          `Request to ${url} failed (status ${res.status}): ${
            body.message || "no message from GitHub"
          }. Open the browser console (F12) for full details.`,
          false
        );

        return;
      }

      const repoInfo = body;

      if (
        !repoInfo.permissions ||
        !repoInfo.permissions.push
      ) {
        showMsg(
          loginMsg,
          "Token works and repo was found, but it doesn't have write (push) access — check the token's scope.",
          false
        );

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
      console.error(e);

      showMsg(
        loginMsg,
        "Network error contacting GitHub.",
        false
      );
    }
  });

  // ------------------------------------------------------------
  // Load data
  // ------------------------------------------------------------

  async function loadAndRender() {
    data = await ParkCore.loadData();

    // Safety in case hours is missing
    if (!data.hours) {
      data.hours = {
        open: "10:00",
        close: "19:00",
        extended: false
      };
    }

    if (!Array.isArray(data.rides)) {
      data.rides = [];
    }

    /*
     * IMPORTANT:
     * Fix duplicate / missing IDs immediately.
     *
     * When the user presses Save, these corrected IDs will
     * be written back to data.json permanently.
     */
    normaliseRideIds();

    renderHours();
    renderMap();
    renderList();
  }

  // ------------------------------------------------------------
  // Park opening hours
  // ------------------------------------------------------------

  function renderHours() {
    const openInput =
      document.getElementById("openTime");

    const closeInput =
      document.getElementById("closeTime");

    const extendedInput =
      document.getElementById("extendedToggle");

    openInput.value =
      data.hours.open || "09:00";

    closeInput.value =
      data.hours.close || "20:00";

    extendedInput.checked =
      !!data.hours.extended;

    /*
     * Use onchange properties rather than adding new
     * event listeners every time this function runs.
     */
    openInput.onchange = (e) => {
      data.hours.open = e.target.value;
    };

    closeInput.onchange = (e) => {
      data.hours.close = e.target.value;
    };

    extendedInput.onchange = (e) => {
      data.hours.extended = e.target.checked;
    };
  }

  // ------------------------------------------------------------
  // Map
  // ------------------------------------------------------------

  function renderMap() {
    canvas.innerHTML = "";

    if (CFG.mapImageUrl) {
      canvas.classList.add("has-image");

      canvas.style.backgroundImage =
        `url(${CFG.mapImageUrl})`;

      ParkCore.fitCanvasToImage(
        canvas,
        CFG.mapImageUrl
      );
    }

    /*
     * Do NOT add the click listener here.
     *
     * It is installed once below instead.
     */

    data.rides.forEach((ride) => {
      renderPin(ride);
    });
  }

  /*
   * One map click handler only.
   *
   * Clicking an empty part of the map creates a new ride.
   */
  canvas.addEventListener("click", (e) => {
    if (e.target !== canvas) return;

    const rect =
      canvas.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left) / rect.width) * 100;

    const y =
      ((e.clientY - rect.top) / rect.height) * 100;

    addRide(x, y);
  });

  // ------------------------------------------------------------
  // Render individual pin
  // ------------------------------------------------------------

  function renderPin(ride) {
    const pin =
      document.createElement("div");

    pin.className = "pin";

    pin.style.left =
      `${ride.x}%`;

    pin.style.top =
      `${ride.y}%`;

    /*
     * Keep the actual ID on the element.
     */
    pin.dataset.id = ride.id;

    const marker =
      document.createElement("div");

    marker.className =
      "pin-marker status-" +
      ride.status;

    pin.appendChild(marker);

    const label =
      document.createElement("div");

    label.className =
      "pin-label";

    label.textContent =
      ride.name;

    pin.appendChild(label);

    // --------------------------------------------------------
    // Dragging
    // --------------------------------------------------------

    pin.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      draggedRide = {
        ride,
        pin
      };

      pin.classList.add("dragging");
    });

    canvas.appendChild(pin);
  }

  // ------------------------------------------------------------
  // Global dragging
  // ------------------------------------------------------------

  document.addEventListener("mousemove", (e) => {
    if (!draggedRide) return;

    const {
      ride,
      pin
    } = draggedRide;

    const rect =
      canvas.getBoundingClientRect();

    let x =
      ((e.clientX - rect.left) / rect.width) * 100;

    let y =
      ((e.clientY - rect.top) / rect.height) * 100;

    x = Math.max(
      0,
      Math.min(100, x)
    );

    y = Math.max(
      0,
      Math.min(100, y)
    );

    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;

    pin.style.left =
      `${x}%`;

    pin.style.top =
      `${y}%`;

    ride.x = x;
    ride.y = y;
  });

  document.addEventListener("mouseup", () => {
    if (!draggedRide) return;

    draggedRide.pin.classList.remove(
      "dragging"
    );

    draggedRide = null;
  });

  // ------------------------------------------------------------
  // Add ride
  // ------------------------------------------------------------

  function addRide(x, y) {
    const ride = {
      id: generateRideId(),

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

  // ------------------------------------------------------------
  // Queue options
  // ------------------------------------------------------------

  function queueOptions(selected) {
    const opts = [];

    for (
      let v = CFG.queueMin;
      v <= CFG.queueMax;
      v += CFG.queueStep
    ) {
      opts.push(
        `<option value="${v}" ${
          v === selected ? "selected" : ""
        }>${v} min</option>`
      );
    }

    return opts.join("");
  }

  // ------------------------------------------------------------
  // Status options
  // ------------------------------------------------------------

  function statusOptions(selected) {
    return Object.entries(
      ParkCore.STATUS_LABELS
    )
      .map(
        ([val, label]) =>
          `<option value="${val}" ${
            val === selected ? "selected" : ""
          }>${label}</option>`
      )
      .join("");
  }

  // ------------------------------------------------------------
  // Find pin safely
  // ------------------------------------------------------------

  function getPinForRide(ride) {
    /*
     * Find the actual pin by comparing the element's
     * data-id with the ride ID.
     *
     * IDs are now unique, so this is safe.
     */
    return Array.from(
      canvas.querySelectorAll(".pin")
    ).find(
      (pin) =>
        pin.dataset.id === String(ride.id)
    );
  }

  // ------------------------------------------------------------
  // Ride list
  // ------------------------------------------------------------

  function renderList() {
    const list =
      document.getElementById("rideList");

    list.innerHTML = "";

    if (data.rides.length === 0) {
      list.innerHTML =
        "<p>No rides yet — click the map above to add one.</p>";

      return;
    }

    data.rides.forEach((ride) => {
      const row =
        document.createElement("div");

      row.className =
        "ride-row";

      /*
       * Build the fields using DOM rather than inserting
       * the ride name directly into innerHTML.
       *
       * This prevents special characters in ride names
       * from breaking the HTML.
       */

      const nameField =
        document.createElement("div");

      nameField.className =
        "field";

      const nameLabel =
        document.createElement("label");

      nameLabel.textContent =
        "Name";

      const nameInput =
        document.createElement("input");

      nameInput.type = "text";
      nameInput.value = ride.name || "";

      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);

      // ------------------------------------------------------
      // Queue
      // ------------------------------------------------------

      const queueField =
        document.createElement("div");

      queueField.className =
        "field";

      const queueLabel =
        document.createElement("label");

      queueLabel.textContent =
        "Queue time";

      const queueSelect =
        document.createElement("select");

      queueSelect.innerHTML =
        queueOptions(ride.queue);

      queueField.appendChild(queueLabel);
      queueField.appendChild(queueSelect);

      // ------------------------------------------------------
      // Status
      // ------------------------------------------------------

      const statusField =
        document.createElement("div");

      statusField.className =
        "field";

      const statusLabel =
        document.createElement("label");

      statusLabel.textContent =
        "Status";

      const statusSelect =
        document.createElement("select");

      statusSelect.innerHTML =
        statusOptions(ride.status);

      statusField.appendChild(statusLabel);
      statusField.appendChild(statusSelect);

      // ------------------------------------------------------
      // Delete button
      // ------------------------------------------------------

      const deleteButton =
        document.createElement("button");

      deleteButton.className =
        "danger";

      deleteButton.textContent =
        "Remove";

      // ------------------------------------------------------
      // Add everything
      // ------------------------------------------------------

      row.appendChild(nameField);
      row.appendChild(queueField);
      row.appendChild(statusField);
      row.appendChild(deleteButton);

      // ------------------------------------------------------
      // Name changed
      // ------------------------------------------------------

      nameInput.addEventListener(
        "input",
        (e) => {
          ride.name =
            e.target.value;

          const pin =
            getPinForRide(ride);

          if (pin) {
            const label =
              pin.querySelector(
                ".pin-label"
              );

            if (label) {
              label.textContent =
                ride.name;
            }
          }
        }
      );

      // ------------------------------------------------------
      // Queue changed
      // ------------------------------------------------------

      queueSelect.addEventListener(
        "change",
        (e) => {
          ride.queue =
            parseInt(
              e.target.value,
              10
            );
        }
      );

      // ------------------------------------------------------
      // Status changed
      // ------------------------------------------------------

      statusSelect.addEventListener(
        "change",
        (e) => {
          ride.status =
            e.target.value;

          const pin =
            getPinForRide(ride);

          if (pin) {
            const marker =
              pin.querySelector(
                ".pin-marker"
              );

            if (marker) {
              marker.className =
                "pin-marker status-" +
                ride.status;
            }
          }
        }
      );

      // ------------------------------------------------------
      // Delete
      // ------------------------------------------------------

      deleteButton.addEventListener(
        "click",
        () => {
          /*
           * Delete by object identity rather than just ID.
           *
           * This gives us an extra layer of protection against
           * old duplicate IDs.
           */
          const index =
            data.rides.indexOf(ride);

          if (index !== -1) {
            data.rides.splice(
              index,
              1
            );
          }

          const pin =
            getPinForRide(ride);

          if (pin) {
            pin.remove();
          }

          renderList();
        }
      );

      list.appendChild(row);
    });
  }

  // ------------------------------------------------------------
  // Save to GitHub
  // ------------------------------------------------------------

  document
    .getElementById("saveBtn")
    .addEventListener(
      "click",
      async () => {
        saveMsg.innerHTML = "";

        try {
          /*
           * Final safety check before saving.
           *
           * This guarantees that data.json cannot be saved
           * with duplicate IDs.
           */
          normaliseRideIds();

          const getRes =
            await fetch(
              `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/${CFG.dataPath}?ref=${CFG.githubBranch}&_=${Date.now()}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`
                },

                cache: "no-store"
              }
            );

          if (!getRes.ok) {
            showMsg(
              saveMsg,
              `Couldn't read current file (status ${getRes.status}).`,
              false
            );

            return;
          }

          const getJson =
            await getRes.json();

          const content =
            btoa(
              unescape(
                encodeURIComponent(
                  JSON.stringify(
                    data,
                    null,
                    2
                  )
                )
              )
            );

          const putRes =
            await fetch(
              `https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/${CFG.dataPath}`,
              {
                method: "PUT",

                headers: {
                  Authorization:
                    `Bearer ${token}`,

                  "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                  message:
                    "Update park data",

                  content,

                  sha:
                    getJson.sha,

                  branch:
                    CFG.githubBranch
                })
              }
            );

          if (!putRes.ok) {
            const errJson =
              await putRes
                .json()
                .catch(
                  () => ({})
                );

            const hint =
              putRes.status === 409
                ? " This usually means the file changed elsewhere since you loaded this page — reload admin.html and try again."
                : "";

            showMsg(
              saveMsg,
              `Save failed (status ${putRes.status}): ${
                errJson.message ||
                "unknown error"
              }.${hint}`,
              false
            );

            return;
          }

          showMsg(
            saveMsg,
            "Saved. The public map will pick this up on its next refresh.",
            true
          );

        } catch (e) {
          console.error(e);

          showMsg(
            saveMsg,
            "Network error while saving.",
            false
          );
        }
      }
    );
})();
