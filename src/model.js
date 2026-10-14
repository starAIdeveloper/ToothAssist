export const TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46,
  45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];
export function initialState() {
  return {
    version: 1,
    patients: [
      { id: "PT-0147", name: "Sarah Johnson", age: 34 },
      { id: "PT-0148", name: "Michael Brown", age: 42 },
      { id: "PT-0149", name: "Emily Davis", age: 29 },
    ],
    selectedPatient: "PT-0147",
    findings: [
      {
        id: "F1",
        patient: "PT-0147",
        tooth: 36,
        type: "Cavity",
        severity: "High",
        note: "Reference annotation. Requires clinician review.",
      },
      {
        id: "F2",
        patient: "PT-0147",
        tooth: 26,
        type: "Plaque",
        severity: "Moderate",
        note: "Reference annotation.",
      },
      {
        id: "F3",
        patient: "PT-0147",
        tooth: 14,
        type: "Wear",
        severity: "Low",
        note: "Reference annotation.",
      },
    ],
    plans: [],
    scans: [],
    reports: [],
  };
}
export function validate(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.patients) ||
    !s.patients.length ||
    s.patients.length > 500
  )
    throw Error("Invalid patient document");
  for (const k of ["findings", "plans", "scans", "reports"])
    if (!Array.isArray(s[k]) || s[k].length > 1000) throw Error("Invalid " + k);
  let ids = new Set();
  for (const p of s.patients) {
    if (
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 100 ||
      !Number.isInteger(p.age) ||
      p.age < 0 ||
      p.age > 120
    )
      throw Error("Invalid patient");
    ids.add(p.id);
  }
  if (!ids.has(s.selectedPatient)) throw Error("Unknown selected patient");
  for (const list of [s.findings, s.plans, s.scans, s.reports]) {
    let recordIds = new Set();
    for (const r of list) {
      if (
        !r ||
        typeof r.id !== "string" ||
        recordIds.has(r.id) ||
        !ids.has(r.patient)
      )
        throw Error("Invalid record");
      recordIds.add(r.id);
    }
  }
  for (const f of s.findings)
    if (
      !TEETH.includes(f.tooth) ||
      !["Cavity", "Plaque", "Wear", "Crack", "Gum issue"].includes(f.type) ||
      !["High", "Moderate", "Low"].includes(f.severity) ||
      typeof f.note !== "string" ||
      f.note.length > 500
    )
      throw Error("Invalid finding");
  for (const p of s.plans)
    if (
      !TEETH.includes(p.tooth) ||
      typeof p.treatment !== "string" ||
      !p.treatment.trim() ||
      p.treatment.length > 120 ||
      !["Planned", "Scheduled", "Completed"].includes(p.status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !Number.isFinite(Date.parse(p.date))
    )
      throw Error("Invalid treatment");
  for (const x of [...s.scans, ...s.reports])
    if (typeof x.date !== "string" || !Number.isFinite(Date.parse(x.date)))
      throw Error("Invalid record date");
  return s;
}
export function visibleFindings(s, patient = s.selectedPatient) {
  return s.findings.filter((f) => f.patient === patient);
}
export function summary(s) {
  const fs = visibleFindings(s);
  return {
    patients: s.patients.length,
    scans: s.scans.filter((x) => x.patient === s.selectedPatient).length,
    findings: fs.length,
    scheduled: s.plans.filter(
      (x) => x.patient === s.selectedPatient && x.status === "Scheduled",
    ).length,
    completed: s.plans.filter(
      (x) => x.patient === s.selectedPatient && x.status === "Completed",
    ).length,
  };
}
export function processPixels(
  input,
  width,
  height,
  mode = "original",
  contrast = 1,
) {
  if (input.length !== width * height * 4)
    throw Error("Invalid pixel dimensions");
  const out = new Uint8ClampedArray(input.length),
    gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++)
    gray[i] =
      (0.299 * input[i * 4] +
        0.587 * input[i * 4 + 1] +
        0.114 * input[i * 4 + 2] -
        128) *
        contrast +
      128;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let i = y * width + x,
        v = gray[i];
      if (mode === "threshold") v = v > 128 ? 255 : 0;
      if (mode === "edges") {
        const at = (dx, dy) =>
          gray[
            Math.max(0, Math.min(height - 1, y + dy)) * width +
              Math.max(0, Math.min(width - 1, x + dx))
          ];
        let gx =
            -at(-1, -1) +
            at(1, -1) -
            2 * at(-1, 0) +
            2 * at(1, 0) -
            at(-1, 1) +
            at(1, 1),
          gy =
            -at(-1, -1) -
            2 * at(0, -1) -
            at(1, -1) +
            at(-1, 1) +
            2 * at(0, 1) +
            at(1, 1);
        v = Math.hypot(gx, gy);
      }
      for (let c = 0; c < 3; c++)
        out[i * 4 + c] =
          mode === "original"
            ? Math.max(
                0,
                Math.min(255, (input[i * 4 + c] - 128) * contrast + 128),
              )
            : v;
      out[i * 4 + 3] = 255;
    }
  return out;
}
export function csv(rows) {
  return rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v)
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
}
