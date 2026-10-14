import {
  TEETH,
  initialState,
  validate,
  visibleFindings,
  summary,
  processPixels,
  csv,
} from "./model.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let state = initialState(),
  page = "Dashboard",
  selectedTooth = 36,
  mode = "original",
  contrast = 1,
  overlay = true,
  opacity = 0.7,
  zoom = 1,
  points = [],
  ruler = false,
  source = null,
  camera = null,
  patientQuery = "";
try {
  state = validate(JSON.parse(localStorage.getItem("toothassist-v1"))) || state;
} catch {}
const nav = [
  "Dashboard",
  "Patients",
  "Scan & Analyze",
  "Image Gallery",
  "AI Analysis",
  "Treatment Plans",
  "Reports",
  "Settings",
];
const symbols = ["⌂", "♧", "◎", "▧", "✧", "♙", "▤", "⚙"];
const toast = (m) => {
  $("#toast").textContent = m;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3500);
};
function save() {
  validate(state);
  try {
    localStorage.setItem("toothassist-v1", JSON.stringify(state));
  } catch {
    toast("Storage unavailable. Export a backup from Settings.");
  }
}
function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const patient = () =>
    state.patients.find((p) => p.id === state.selectedPatient),
  findings = () => visibleFindings(state),
  plans = () => state.plans.filter((p) => p.patient === state.selectedPatient),
  badge = (v, cls = "") =>
    `<span class="badge ${cls || v.toLowerCase()}">${esc(v)}</span>`;
const card = (title, body, cls = "") =>
  `<section class="card ${cls}"><h3>${title}</h3><div class="card-body">${body}</div></section>`;
const metric = (icon, title, value, sub, color = "blue") =>
  `<div class="metric"><span class="metric-icon ${color}">${icon}</span><div><small>${title}</small><strong>${value}</strong><span>${sub}</span></div></div>`;
const reference = (n = 3) =>
  `<img class="reference" src="docs/reference/screen-${n}.webp" alt="Supplied ToothAssist design reference ${n}" loading="lazy">`;
function table() {
  return `<div class="table-wrap"><table><thead><tr><th>Tooth</th><th>Finding</th><th>Severity</th><th>Source</th><th></th></tr></thead><tbody>${
    findings()
      .map(
        (f) =>
          `<tr><td>#${f.tooth}</td><td>${esc(f.type)}</td><td>${badge(f.severity)}</td><td>Manual / sample</td><td><button data-remove="${esc(f.id)}" class="quiet">Remove</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5">No findings recorded for this patient.</td></tr>'
  }</tbody></table></div>`;
}
function viewer(kind = "xray") {
  return `<div class="viewer ${kind}"><canvas id="image-canvas" width="1100" height="540" aria-label="Dental image viewer"></canvas><div class="viewer-caption"><span>● Tooth boundary</span><span>● Schematic record markers</span><span>${source ? "Uploaded image" : "Sample image · pre-annotated reference"}</span></div></div>`;
}
function chart() {
  return `<svg viewBox="0 0 500 140" class="chart" role="img" aria-label="Illustrative scan history, sample data"><defs><linearGradient id="fill" x2="0" y2="1"><stop stop-color="#1769ff" stop-opacity=".26"/><stop offset="1" stop-color="#1769ff" stop-opacity="0"/></linearGradient></defs>${[20, 50, 80, 110].map((y) => `<path d="M20 ${y}H485" stroke="#e5edf8"/>`).join("")}<path d="M20 110L90 85L160 65L230 80L300 55L370 60L440 25L485 35V130H20Z" fill="url(#fill)"/><path d="M20 110L90 85L160 65L230 80L300 55L370 60L440 25L485 35" fill="none" stroke="#0762ff" stroke-width="3"/>${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => `<text x="${20 + i * 74}" y="140" font-size="10" fill="#687b98">${d}</text>`).join("")}</svg>`;
}
function dashboard() {
  const s = summary(state);
  return `<div class="metrics">${metric("♧", "Total patients", s.patients, "Local workspace")}${metric("▧", "Saved scans", s.scans, "Selected patient")}${metric("△", "Recorded findings", s.findings, "Sample and manual records", "red")}${metric("▦", "Scheduled treatments", s.scheduled, "Selected patient")}${metric("✓", "Completed treatments", s.completed, "Selected patient", "green")}</div><div class="dashboard-grid"><div class="wide"><div class="columns">${card("♧ Panoramic X-ray · Sample", `<div class="sample-crop xray-crop"></div>`)}${card("◎ Intraoral image · Sample", `<div class="sample-crop intra-crop"></div>`)}</div><div class="columns">${card("⌁ Scan History <small>Illustrative sample</small>", chart())}${card(
    "▥ Recorded findings by category",
    `<div class="bars">${["Cavity", "Plaque", "Wear", "Crack", "Gum issue"]
      .map((v, i) => {
        const n = findings().filter((f) => f.type === v).length;
        return `<div><b style="height:${12 + n * 40}px;background:${["#ff5056", "#ffcb34", "#3791ff", "#a578f7", "#2ace9a"][i]}">${n}</b><small>${v}</small></div>`;
      })
      .join("")}</div>`,
  )}</div>${card("▤ Current patient findings", table())}</div><aside>${card(
    "✧ Analysis summary",
    findings()
      .map(
        (f) =>
          `<button class="summary-item" data-tooth="${f.tooth}"><span class="tooth-icon">♧</span><span><b>${esc(f.type)}</b><small>Tooth #${f.tooth} · ${esc(f.severity)}</small></span><span>›</span></button>`,
      )
      .join("") || "<p>No findings yet. Open Scan & Analyze to add one.</p>",
  )}${card("✓ Workspace status", '<p class="notice">Demonstration workspace</p><p>Image processing runs locally. No diagnostic AI model is connected.</p><button data-page="Scan & Analyze">Open scan workspace →</button>')}${card("Current patient", `<div class="avatar">${esc(patient().name[0])}</div><h2>${esc(patient().name)}</h2><p>${esc(patient().id)} · ${patient().age} years</p>`)}</aside></div>`;
}
function scan() {
  return `<div class="columns scan-layout">${card(page === "AI Analysis" ? "♧ Panoramic image analysis" : "◎ Dental image workspace", `<div class="toolbar"><button data-action="upload">Upload image</button><button data-action="sample">Load sample</button><select id="image-mode" aria-label="Image processing"><option value="original">Original</option><option value="grayscale">Grayscale</option><option value="edges">Sobel edges</option><option value="threshold">Binary threshold</option></select><button data-action="ruler" aria-pressed="${ruler}">Pixel ruler</button><button data-action="zoom">Zoom +</button><button data-action="reset-view">Reset view</button></div>${viewer(page === "AI Analysis" ? "xray" : "intra")}<div class="toolbar"><label>Contrast <input id="contrast" type="range" min="0.5" max="2" step=".1" value="${contrast}"></label><label><input id="overlay" type="checkbox" ${overlay ? "checked" : ""}> Schematic record markers</label><label>Overlay <input id="opacity" type="range" min="0" max="1" step=".1" value="${opacity}"></label></div><p class="muted">Record boxes are illustrative markers, not localized detections. The supplied sample already contains annotations.</p><p id="measurement">Select Pixel ruler, then click two image points. Distances are uncalibrated pixels.</p>`)}<div>${card("⚙ Scan controls", `<div class="action-grid"><button data-action="camera">Start camera</button><button data-action="capture">Capture frame</button><button data-action="stop-camera">Stop camera</button><button class="primary" data-action="save-scan">Save scan</button></div><p class="muted">Camera requires localhost or HTTPS and permission. Upload supports PNG, JPEG and WebP, up to 10 MB / 24 MP.</p><video id="camera-video" autoplay muted playsinline hidden></video><h4>Computer vision pipeline</h4><div class="pipeline"><span>Image input</span><span>Contrast</span><span>Sobel / threshold</span><span>Manual review</span></div><div class="notice">No automated cavity detection or clinical confidence scores are generated.</div>`)}${card("✧ Recorded findings", `<button data-action="add-finding" class="primary">+ Add manual finding</button>${table()}<button data-action="annotations">Export annotations JSON</button>`)}</div></div>`;
}
function treatment() {
  return `<div class="dashboard-grid"><div class="wide">${card("♧ Dental chart & recorded issues", `<div class="dental-chart">${TEETH.map((t) => `<button class="tooth ${selectedTooth === t ? "selected" : ""} ${findings().some((f) => f.tooth === t) ? "marked" : ""}" data-tooth="${t}" aria-label="Tooth ${t}"><small>${t}</small><svg viewBox="0 0 40 65"><path d="M7 8Q13 2 20 8Q29 1 34 10Q39 20 31 42L26 60Q22 66 20 43Q17 65 13 60L7 40Q0 20 7 8Z" fill="currentColor" stroke="#6d99dc"/></svg></button>`).join("")}</div>`)}${card(
    "▤ Treatment planning",
    `<button class="primary" data-action="add-plan">+ Plan treatment for tooth #${selectedTooth}</button><div class="table-wrap"><table><thead><tr><th>Tooth</th><th>Treatment</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${
      plans()
        .map(
          (p) =>
            `<tr><td>#${p.tooth}</td><td>${esc(p.treatment)}</td><td>${esc(p.date)}</td><td>${badge(p.status)}</td><td><select data-plan="${esc(p.id)}" aria-label="Treatment status">${["Planned", "Scheduled", "Completed"].map((v) => `<option ${p.status === v ? "selected" : ""}>${v}</option>`).join("")}</select><button data-delete-plan="${esc(p.id)}">Delete</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="5">No treatments planned yet.</td></tr>'
    }</tbody></table></div>`,
  )}${card("Clinical notes", "<p>Plans are entered by the user. This prototype does not recommend treatments or predict outcomes.</p>")}</div><aside>${card(
    `Selected tooth: #${selectedTooth}`,
    `<div class="large-tooth">♧</div>${
      findings()
        .filter((f) => f.tooth === selectedTooth)
        .map(
          (f) =>
            `<p>${badge(f.type)} ${badge(f.severity)}<br>${esc(f.note)}</p>`,
        )
        .join("") || "<p>No recorded findings.</p>"
    }<button data-action="add-finding">Add finding</button>`,
  )}${card("Patient information", `<h2>${esc(patient().name)}</h2><p>${esc(patient().id)} · ${patient().age} years</p>`)}${card(
    "Treatment timeline",
    plans()
      .map(
        (p) =>
          `<p class="timeline"><b>${esc(p.date)}</b><br>${esc(p.treatment)} · #${p.tooth}<br>${badge(p.status)}</p>`,
      )
      .join("") || "<p>Your planned treatments appear here.</p>",
  )}</aside></div>`;
}
function report() {
  return `<div class="columns">${card(
    "▤ Patient report",
    `<div class="report"><div class="brand">♧ ToothAssist <em>CV</em></div><p>Patient workflow report · ${new Date().toLocaleDateString()}</p><hr><h2>${esc(patient().name)}</h2><p>${esc(patient().id)} · ${patient().age} years</p><h3>Recorded findings</h3>${table()}<h3>Treatment plan</h3>${
      plans()
        .map(
          (p) =>
            `<p>#${p.tooth} · ${esc(p.treatment)} · ${esc(p.date)} · ${esc(p.status)}</p>`,
        )
        .join("") || "<p>No treatments planned.</p>"
    }<p class="notice">Demonstration / manual records. Not a diagnostic report.</p></div>`,
  )}<div>${card("Report actions", '<div class="stack"><button class="primary" data-action="generate-report">Generate report record</button><button data-action="print">Print / Save as PDF</button><button data-action="csv">Export findings CSV</button><button data-action="annotations">Export annotations JSON</button></div>')}${card(
    "Report history",
    state.reports
      .filter((r) => r.patient === state.selectedPatient)
      .map(
        (r) =>
          `<p class="timeline"><b>${esc(r.id)}</b><br>${new Date(r.date).toLocaleString()}</p>`,
      )
      .join("") || "<p>No reports generated yet.</p>",
  )}${card(
    "Scan history",
    state.scans
      .filter((r) => r.patient === state.selectedPatient)
      .map(
        (r) =>
          `<p class="timeline">${esc(r.name)}<br>${new Date(r.date).toLocaleString()}</p>`,
      )
      .join("") || "<p>No scans saved yet.</p>",
  )}</div></div>`;
}
function patients() {
  return `${card("♧ Patient directory", `<div class="toolbar"><input id="patient-search" placeholder="Search patient name or ID" aria-label="Search patients" value="${esc(patientQuery)}"><button class="primary" data-action="add-patient">+ Add patient</button></div><div id="patient-list">${patientRows()}</div>`)}`;
}
function patientRows() {
  return `<table><thead><tr><th>Patient</th><th>ID</th><th>Age</th><th></th></tr></thead><tbody>${
    state.patients
      .filter((p) =>
        (p.name + " " + p.id)
          .toLowerCase()
          .includes(patientQuery.toLowerCase()),
      )
      .map(
        (p) =>
          `<tr><td>${esc(p.name)}</td><td>${esc(p.id)}</td><td>${p.age}</td><td><button data-patient="${esc(p.id)}">Open workspace</button></td></tr>`,
      )
      .join("") || "<tr><td>No matching patients.</td></tr>"
  }</tbody></table>`;
}
function settings() {
  return card(
    "⚙ Local workspace settings",
    `<p>Records are stored in this browser only. Uploaded image pixels are kept in memory and are not included in backups; scan history stores metadata only. Use synthetic or de-identified data in this prototype.</p><div class="stack"><button data-action="backup">Download workspace JSON</button><button data-action="restore">Restore workspace JSON</button><button class="danger" data-action="reset-data">Reset demo workspace</button></div><h4>Implementation</h4><p>Native Canvas image processing · Sobel edges · grayscale · threshold · manual annotations · no external services.</p>`,
  );
}
function render() {
  const descriptions = {
    Dashboard: "A clear view of your dental imaging workspace",
    Patients: "Patient records and linked imaging workflows",
    "Scan & Analyze": "Local image processing and clinician annotation",
    "Image Gallery": "Design references and session scan history",
    "AI Analysis":
      "Image tools and manual review · no diagnostic model connected",
    "Treatment Plans": "Interactive dental chart and treatment scheduling",
    Reports: "Patient findings, treatment progress and export",
    Settings: "Backups, data controls and workspace information",
  };
  $("#app").innerHTML =
    `<header><a class="brand" href="#Dashboard">♧ ToothAssist <em>CV</em></a><div class="header-right"><span class="demo">DEMO WORKSPACE</span><select id="patient-select" aria-label="Current patient">${state.patients.map((p) => `<option value="${esc(p.id)}" ${p.id === state.selectedPatient ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select><span class="doctor">MC</span><span>Dr. Michael Chen<small>Dental practitioner · Demo</small></span></div></header><nav>${nav.map((v, i) => `<button data-page="${v}" class="${page === v ? "active" : ""}"><span>${symbols[i]}</span>${v}</button>`).join("")}<div class="engine"><b><i></i> Local image engine</b><p>Canvas processing</p><small>Diagnostic AI: not connected<br>Storage: this browser</small></div></nav><main><div class="page-heading"><div><h1>${page}</h1><p>${descriptions[page]}</p></div><button class="primary" data-action="new-scan">▧ New Scan</button></div>${page === "Dashboard" ? dashboard() : page === "Patients" ? patients() : ["Scan & Analyze", "AI Analysis"].includes(page) ? scan() : page === "Treatment Plans" ? treatment() : page === "Reports" ? report() : page === "Settings" ? settings() : card("▧ Image gallery", `<p>Supplied visual references. These contain illustrative annotations, not results produced by this application.</p><div class="gallery">${[1, 2, 3, 4, 5].map((i) => `<a href="docs/reference/screen-${i}.webp" target="_blank" rel="noopener">${reference(i)}<span>Reference ${i} ↗</span></a>`).join("")}</div>`)}</main>`;
  if ($("#image-canvas")) {
    $("#image-mode").value = mode;
    draw();
  }
}
async function draw() {
  const canvas = $("#image-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = source || (await sampleImage());
  if (!$("#image-canvas") || canvas !== $("#image-canvas")) return;
  ctx.fillStyle = "#101a29";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const crop = source
    ? [0, 0, img.width, img.height]
    : page === "Scan & Analyze"
      ? [265, 224, 708, 420]
      : [264, 278, 872, 420];
  const ratio =
      Math.min(canvas.width / crop[2], canvas.height / crop[3]) * zoom,
    w = crop[2] * ratio,
    h = crop[3] * ratio;
  ctx.drawImage(
    img,
    ...crop,
    (canvas.width - w) / 2,
    (canvas.height - h) / 2,
    w,
    h,
  );
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(
    processPixels(pixels.data, canvas.width, canvas.height, mode, contrast),
  );
  ctx.putImageData(pixels, 0, 0);
  if (overlay) {
    ctx.globalAlpha = opacity;
    findings().forEach((f, i) => {
      const x = 140 + i * 220,
        y = 155 + (i % 2) * 110;
      ctx.strokeStyle = f.type === "Cavity" ? "#ff5353" : "#ffdd24";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 95, 120);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(x, y - 25, 142, 25);
      ctx.fillStyle = "#091a30";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(`#${f.tooth} ${f.type}`, x + 5, y - 7);
    });
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = "#00ddff";
  ctx.fillStyle = "#00ddff";
  points.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    ctx.lineTo(...points[1]);
    ctx.stroke();
    $("#measurement").textContent =
      `Distance: ${(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) / ratio).toFixed(1)} image pixels · uncalibrated`;
  }
}
const samplePromises = {};
function sampleImage() {
  const n = page === "Scan & Analyze" ? 2 : 3;
  return (samplePromises[n] ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("Sample image unavailable"));
    img.src = `docs/reference/screen-${n}.webp`;
  }));
}
function dialog(title, fields, submit) {
  const d = $("#modal");
  d.innerHTML = `<form><h2>${title}</h2>${fields}<div class="toolbar"><button type="button" id="cancel-modal">Cancel</button><button class="primary" type="submit">Save</button></div><p id="form-error" role="alert"></p></form>`;
  $("#cancel-modal").onclick = () => d.close();
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    try {
      submit(new FormData(e.target));
      save();
      d.close();
      render();
    } catch (err) {
      $("#form-error").textContent = err.message;
    }
  };
  d.showModal();
}
const field = (label, name, type = "text", value = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" required ${type === "text" ? 'maxlength="100"' : ""}></label>`;
const actions = {
  "new-scan": () => {
    page = "Scan & Analyze";
    render();
  },
  upload: () => $("#image-upload").click(),
  sample: () => {
    source = null;
    points = [];
    zoom = 1;
    render();
  },
  ruler: () => {
    ruler = !ruler;
    points = [];
    render();
  },
  zoom: () => {
    zoom = Math.min(3, zoom + 0.25);
    draw();
  },
  "reset-view": () => {
    zoom = 1;
    mode = "original";
    contrast = 1;
    points = [];
    render();
  },
  "add-patient": () =>
    dialog(
      "Add patient",
      field("Name", "name") + field("Age", "age", "number", "30"),
      (d) => {
        const p = {
          id: "PT-" + crypto.randomUUID(),
          name: d.get("name").trim(),
          age: Number(d.get("age")),
        };
        validate({ ...state, patients: [...state.patients, p] });
        state.patients.push(p);
        state.selectedPatient = p.id;
      },
    ),
  "add-finding": () =>
    dialog(
      "Record manual finding",
      `<label class="field">Tooth<select name="tooth">${TEETH.map((t) => `<option ${t === selectedTooth ? "selected" : ""}>${t}</option>`).join("")}</select></label><label class="field">Finding<select name="type">${["Cavity", "Plaque", "Wear", "Crack", "Gum issue"].map((v) => `<option>${v}</option>`).join("")}</select></label><label class="field">Severity<select name="severity"><option>High</option><option>Moderate</option><option>Low</option></select></label><label class="field">Notes<textarea name="note" maxlength="500"></textarea></label>`,
      (d) => {
        state.findings.push({
          id: crypto.randomUUID(),
          patient: state.selectedPatient,
          tooth: Number(d.get("tooth")),
          type: d.get("type"),
          severity: d.get("severity"),
          note: d.get("note"),
        });
      },
    ),
  "add-plan": () =>
    dialog(
      `Plan treatment · #${selectedTooth}`,
      field("Treatment", "treatment") +
        field("Date", "date", "date", new Date().toISOString().slice(0, 10)),
      (d) => {
        const p = {
          id: crypto.randomUUID(),
          patient: state.selectedPatient,
          tooth: selectedTooth,
          treatment: d.get("treatment").trim(),
          date: d.get("date"),
          status: "Planned",
        };
        validate({ ...state, plans: [...state.plans, p] });
        state.plans.push(p);
      },
    ),
  "save-scan": () => {
    state.scans.push({
      id: crypto.randomUUID(),
      patient: state.selectedPatient,
      date: new Date().toISOString(),
      name: source ? "Uploaded image" : "Sample reference",
      mode,
    });
    save();
    toast("Scan metadata saved. Image pixels remain in this session.");
  },
  annotations: () =>
    download(
      "toothassist-annotations.json",
      JSON.stringify(
        {
          patient: patient(),
          findings: findings(),
          source: "manual-or-sample",
          diagnosticModel: null,
        },
        null,
        2,
      ),
    ),
  "generate-report": () => {
    state.reports.push({
      id: "RPT-" + crypto.randomUUID().slice(0, 8),
      patient: state.selectedPatient,
      date: new Date().toISOString(),
    });
    save();
    render();
    toast("Report record generated");
  },
  print: () => window.print(),
  csv: () =>
    download(
      "toothassist-findings.csv",
      csv([
        ["Patient", "Tooth", "Finding", "Severity", "Note"],
        ...findings().map((f) => [
          patient().name,
          f.tooth,
          f.type,
          f.severity,
          f.note,
        ]),
      ]),
      "text/csv",
    ),
  backup: () =>
    download("toothassist-workspace.json", JSON.stringify(state, null, 2)),
  restore: () => $("#data-upload").click(),
  "reset-data": () =>
    dialog(
      "Reset local workspace",
      field("Type RESET to confirm", "confirmation"),
      (d) => {
        if (d.get("confirmation") !== "RESET")
          throw Error("Enter RESET to confirm");
        state = initialState();
        source = null;
      },
    ),
  camera: async () => {
    try {
      stopCamera();
      camera = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const v = $("#camera-video");
      if (!v) {
        stopCamera();
        return;
      }
      v.hidden = false;
      v.srcObject = camera;
      await v.play();
      toast("Camera active. Capture a frame to process it.");
    } catch {
      stopCamera();
      toast(
        "Camera unavailable or permission denied. Upload an image instead.",
      );
    }
  },
  capture: () => {
    const v = $("#camera-video");
    if (!camera || !v?.videoWidth) return toast("Start the camera first");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    source = c;
    points = [];
    draw();
    toast("Frame captured for local processing");
  },
  "stop-camera": () => {
    stopCamera();
    toast("Camera stopped");
  },
};
function stopCamera() {
  camera?.getTracks().forEach((t) => t.stop());
  camera = null;
  const v = $("#camera-video");
  if (v) {
    v.srcObject = null;
    v.hidden = true;
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.page) {
      stopCamera();
      page = b.dataset.page;
      points = [];
      render();
    } else if (b.dataset.action) await actions[b.dataset.action]?.();
    else if (b.dataset.tooth) {
      selectedTooth = Number(b.dataset.tooth);
      stopCamera();
      page = "Treatment Plans";
      render();
    } else if (b.dataset.patient) {
      state.selectedPatient = b.dataset.patient;
      source = null;
      points = [];
      save();
      page = "Dashboard";
      render();
    } else if (b.dataset.remove) {
      state.findings = state.findings.filter((f) => f.id !== b.dataset.remove);
      save();
      render();
    } else if (b.dataset.deletePlan) {
      state.plans = state.plans.filter((p) => p.id !== b.dataset.deletePlan);
      save();
      render();
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "patient-select") {
    stopCamera();
    state.selectedPatient = t.value;
    source = null;
    points = [];
    save();
    render();
  }
  if (t.id === "image-mode") {
    mode = t.value;
    draw();
  }
  if (t.id === "overlay") {
    overlay = t.checked;
    draw();
  }
  if (t.dataset.plan) {
    state.plans.find((p) => p.id === t.dataset.plan).status = t.value;
    save();
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "contrast") {
    contrast = Number(e.target.value);
    draw();
  }
  if (e.target.id === "opacity") {
    opacity = Number(e.target.value);
    draw();
  }
  if (e.target.id === "patient-search") {
    patientQuery = e.target.value;
    $("#patient-list").innerHTML = patientRows();
  }
});
document.addEventListener("click", (e) => {
  if (e.target.id === "image-canvas" && ruler) {
    const r = e.target.getBoundingClientRect();
    if (points.length === 2) points = [];
    points.push([
      ((e.clientX - r.left) * e.target.width) / r.width,
      ((e.clientY - r.top) * e.target.height) / r.height,
    ]);
    draw();
  }
});
$("#image-upload").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    )
      throw Error("Choose PNG, JPEG or WebP up to 10 MB");
    const img = await createImageBitmap(file);
    if (img.width * img.height > 24000000) {
      img.close();
      throw Error("Image exceeds 24 megapixels");
    }
    source?.close?.();
    source = img;
    points = [];
    zoom = 1;
    render();
    toast("Image loaded locally");
  } catch (err) {
    toast(err.message);
  }
};
$("#data-upload").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 2000000) throw Error("Backup exceeds 2 MB");
    const next = validate(JSON.parse(await file.text()));
    state = next;
    stopCamera();
    source = null;
    save();
    render();
    toast("Workspace restored");
  } catch (err) {
    toast("Restore rejected: " + err.message);
  }
};
window.addEventListener("beforeunload", stopCamera);
window.addEventListener("hashchange", () => {
  const v = decodeURIComponent(location.hash.slice(1));
  if (nav.includes(v)) {
    stopCamera();
    page = v;
    render();
  }
});
if (nav.includes(decodeURIComponent(location.hash.slice(1))))
  page = decodeURIComponent(location.hash.slice(1));
render();
