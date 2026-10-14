import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  validate,
  visibleFindings,
  summary,
  processPixels,
  csv,
} from "../src/model.js";
test("seeded workspace validates and isolates patient findings", () => {
  const s = initialState();
  assert.equal(validate(s), s);
  assert.equal(visibleFindings(s).length, 3);
  s.selectedPatient = "PT-0148";
  assert.equal(visibleFindings(s).length, 0);
  assert.equal(summary(s).findings, 0);
});
test("duplicate patient IDs and dangling records are rejected", () => {
  let s = initialState();
  s.patients.push({ ...s.patients[0] });
  assert.throws(() => validate(s));
  s = initialState();
  s.findings[0].patient = "missing";
  assert.throws(() => validate(s));
});
test("invalid tooth severity age and notes are rejected", () => {
  for (const [key, value] of [
    ["tooth", 99],
    ["severity", "Unsafe"],
    ["note", "x".repeat(501)],
  ]) {
    const s = initialState();
    s.findings[0][key] = value;
    assert.throws(() => validate(s));
  }
  const s = initialState();
  s.patients[0].age = -1;
  assert.throws(() => validate(s));
});
test("scheduled and completed treatments aggregate independently", () => {
  const s = initialState();
  s.plans = [
    {
      id: "P1",
      patient: s.selectedPatient,
      tooth: 36,
      treatment: "Review",
      date: "2026-10-20",
      status: "Scheduled",
    },
  ];
  validate(s);
  assert.equal(summary(s).scheduled, 1);
  s.plans[0].status = "Completed";
  assert.equal(summary(s).scheduled, 0);
  assert.equal(summary(s).completed, 1);
});
test("JSON roundtrip retains records", () => {
  const s = initialState();
  assert.deepEqual(validate(JSON.parse(JSON.stringify(s))), s);
});
test("Sobel finds intensity boundary and constant image stays black", () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (let i = 0; i < 25; i++) {
    pixels[i * 4 + 3] = 255;
    if (i % 5 > 2) pixels.fill(255, i * 4, i * 4 + 3);
  }
  const out = processPixels(pixels, 5, 5, "edges");
  assert.ok(out[(2 * 5 + 2) * 4] > 0);
  assert.equal(out[2 * 5 * 4], 0);
});
test("grayscale and threshold change pixel channels predictably", () => {
  const p = new Uint8ClampedArray([255, 0, 0, 255, 255, 255, 255, 255]);
  const g = processPixels(p, 2, 1, "grayscale");
  assert.equal(g[0], g[1]);
  assert.ok(g[0] > 70 && g[0] < 80);
  assert.equal(processPixels(p, 2, 1, "threshold")[0], 0);
  assert.equal(processPixels(p, 2, 1, "threshold")[4], 255);
});
test("pixel shape errors and malicious CSV cells are handled", () => {
  assert.throws(() => processPixels(new Uint8ClampedArray(3), 1, 1));
  assert.equal(
    csv([["=SUM(A1)", 'a"b', "line\nbreak"]]),
    '"\'=SUM(A1)","a""b","line\nbreak"',
  );
});
