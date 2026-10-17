const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  { execFileSync } = require("node:child_process"),
  { createHash } = require("node:crypto");
const count = Number(process.argv[2] || 500),
  baseline = process.argv.indexOf("--baseline"),
  revision = baseline < 0 ? null : process.argv[baseline + 1];
let E = require("./engine.js"),
  source = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
if (revision) {
  source = execFileSync("git", ["show", `${revision}:engine.js`], {
    encoding: "utf8",
  });
  const context = { module: { exports: {} } };
  vm.runInNewContext(source, context);
  E = context.module.exports;
}
// Independent oracle: neither engine geometry code nor candidate domains are used.
const { measure } = require("./room-metrics.cjs");
const reports = [],
  percentile = (values, q) =>
    [...values].sort((a, b) => a - b)[
      Math.min(values.length - 1, Math.floor(values.length * q))
    ];
for (const N of [5, 6, 7]) {
  const cases = [],
    all = [],
    times = [],
    roomCounts = {},
    spans = {},
    fills = [],
    aspects = [],
    areas = [],
    strong = [];
  let thicknessFailures = 0,
    aspectFailures = 0,
    fillFailures = 0,
    spanFailures = 0,
    adjacencyFailures = 0,
    victimSmallest = 0;
  for (let seed = 0; seed < count; seed++) {
    const start = performance.now(),
      p = E.generate(seed, 100, N);
    times.push(performance.now() - start);
    const m = measure(Array.from(p.rooms), N);
    assert.equal(p.rooms.length, N * N);
    assert.ok(m.rooms.every((r) => r.connected));
    assert.ok(
      m.rooms.length >= N - 1 && m.rooms.length <= (N === 5 ? 5 : N + 1),
    );
    roomCounts[m.rooms.length] = (roomCounts[m.rooms.length] || 0) + 1;
    spans[m.spans] = (spans[m.spans] || 0) + 1;
    strong.push(m.strong);
    for (const r of m.rooms) {
      all.push(r);
      fills.push(r.fill);
      aspects.push(r.aspect);
      areas.push(r.area);
      if (r.w < 2 || r.h < 2) thicknessFailures++;
      if (r.aspect > 2.5) aspectFailures++;
      if (r.fill < 0.6) fillFailures++;
    }
    if (m.spans > 1) spanFailures++;
    if (m.sameNeighbors.length) adjacencyFailures++;
    if (!revision) {
      assert.equal(
        m.sameNeighbors.length,
        0,
        `${N}/${seed}: adjacent equal bbox`,
      );
      assert.ok(m.spans <= 1);
      assert.ok(
        m.rooms.every(
          (r) => r.w >= 2 && r.h >= 2 && r.aspect <= 2.5 && r.fill >= 0.6,
        ),
      );
      assert.equal(E.roomGeometry(p.rooms, N).valid, true);
      assert.ok(
        m.rooms.some((r) => r.fill < 1),
        "procedural notches supported",
      );
    }
    const victim = p.rooms[p.solution[0]],
      victimArea = m.rooms.find((r) => r.id === victim).area;
    assert.equal(p.solution.filter((c) => p.rooms[c] === victim).length, 2);
    if (victimArea === Math.min(...m.rooms.map((r) => r.area)))
      victimSmallest++;
    if (seed % 50 === 0)
      assert.equal(
        JSON.stringify(E.generate(seed, 100, N)),
        JSON.stringify(p),
        "seeded reproducibility across cached catalogs",
      );
    cases.push({
      seed,
      roomCount: m.rooms.length,
      rooms: m.rooms,
      adjacency: m.adjacency,
      sameNeighbors: m.sameNeighbors,
      fullSpans: m.spans,
      strongQualifiedFraction: m.strong,
    });
  }
  const summary = {
    size: N,
    cases: count,
    rooms: all.length,
    roomCounts,
    oneCellThicknessRooms: thicknessFailures,
    aspectFailures,
    fillFailures,
    fullSpanCaseFailures: spanFailures,
    adjacencyCaseFailures: adjacencyFailures,
    fullSpanCounts: spans,
    meanAspect: aspects.reduce((a, b) => a + b) / aspects.length,
    p90Aspect: percentile(aspects, 0.9),
    maxAspect: Math.max(...aspects),
    minFill: Math.min(...fills),
    notchedRooms: all.filter((r) => r.fill < 1).length,
    minArea: Math.min(...areas),
    maxArea: Math.max(...areas),
    meanArea: areas.reduce((a, b) => a + b) / areas.length,
    strongReadingInformational: {
      meanQualifiedFraction: strong.reduce((a, b) => a + b) / count,
      casesAtLeastHalf: strong.filter((v) => v >= 0.5).length,
    },
    victimRoomSmallestFraction: victimSmallest / count,
    generationMs: { p95: percentile(times, 0.95), max: Math.max(...times) },
  };
  if (!revision)
    assert.ok(
      summary.generationMs.p95 < 50,
      `${N}: p95 generation must stay below50ms`,
    );
  console.log(JSON.stringify(summary));
  console.log("Adjacency example:", JSON.stringify(cases[0]));
  reports.push({ summary, cases });
}
const output = revision
  ? "/tmp/murdoku-room-shapes-before.json"
  : "/tmp/murdoku-room-shapes-after.json";
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      baseline: revision,
      engineSha256: createHash("sha256").update(source).digest("hex"),
      reports,
    },
    null,
    2,
  ),
);
if (!revision) {
  const slabs = Array.from({ length: 36 }, (_, i) => i % 6);
  assert.equal(E.roomGeometry(slabs, 6).valid, false);
  const p = E.generate(12, 100, 6),
    broken = [...p.rooms];
  broken[0] = 99;
  assert.equal(E.roomGeometry(broken, 6).valid, false);
}
console.log(
  `${revision ? "MEASURED baseline" : "PASS"}: ${count} seeds/size; independent dimensions/fill/connectivity/adjacency graph, exact room ranges, complete coverage, victim pair and reproducibility. ${output}`,
);
