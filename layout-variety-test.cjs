const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const samples = Number(process.argv[2] || 1000),
  baselineIndex = process.argv.indexOf("--baseline"),
  baseline = baselineIndex < 0 ? null : process.argv[baselineIndex + 1];
const source = baseline
  ? execFileSync("git", ["show", `${baseline}:engine.js`], { encoding: "utf8" })
  : fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
const context = { module: { exports: {} } };
vm.runInNewContext(
  baseline
    ? source
    : source.replace(
        "const API = {",
        "const API = { _partition: partition, _catalog: shapeCatalog,",
      ),
  context,
);
const E = context.module.exports;
function canonical(rooms, N) {
  let best;
  for (let reflect = 0; reflect < 2; reflect++)
    for (let turns = 0; turns < 4; turns++) {
      const transformed = Array(N * N);
      rooms.forEach((id, i) => {
        let r = Math.floor(i / N),
          c = i % N;
        if (reflect) c = N - 1 - c;
        for (let t = 0; t < turns; t++) [r, c] = [c, N - 1 - r];
        transformed[r * N + c] = id;
      });
      const ids = new Map(),
        key = transformed
          .map((id) => {
            if (!ids.has(id)) ids.set(id, ids.size);
            return ids.get(id);
          })
          .join("");
      if (best === undefined || key < best) best = key;
    }
  return best;
}
const report = [];
for (const N of [5, 6, 7]) {
  const counts = new Map(),
    roomCounts = {},
    areas = [];
  for (let seed = 0; seed < samples; seed++) {
    const p = E.generate(seed, 100, N),
      key = canonical(Array.from(p.rooms), N);
    counts.set(key, (counts.get(key) || 0) + 1);
    const ids = [...new Set(p.rooms)];
    roomCounts[ids.length] = (roomCounts[ids.length] || 0) + 1;
    for (const id of ids) areas.push(p.rooms.filter((x) => x === id).length);
  }
  let catalogSize = null,
    enumeration = null;
  if (!baseline) {
    const C = E._catalog(N),
      records = [...new Set(C.flat())];
    catalogSize = records.length;
    const board = Array(N * N).fill(-1),
      chosen = [],
      canonicalTilings = new Set();
    let leaves = 0,
      nodes = 0,
      stopped = false;
    const start = performance.now();
    function count(lo, hi, left, spans) {
      if (stopped) return;
      if (++nodes > 1000000 || performance.now() - start > 2000) {
        stopped = true;
        return;
      }
      if (!left) {
        if (
          chosen.length < N - 1 ||
          !chosen.some((s) => s.cells.length < s.w * s.h)
        )
          return;
        leaves++;
        canonicalTilings.add(canonical(board, N));
        if (canonicalTilings.size >= 10000) stopped = true;
        return;
      }
      if (
        chosen.length >= (N === 5 ? 5 : N + 1) ||
        left < Math.max(0, N - 1 - chosen.length) * 3
      )
        return;
      for (const s of C[board.indexOf(-1)]) {
        if (
          lo & s.lo ||
          hi & s.hi ||
          (spans && s.spans) ||
          s.neighbors.some(
            (x) =>
              board[x] >= 0 &&
              chosen[board[x]].w === s.w &&
              chosen[board[x]].h === s.h,
          )
        )
          continue;
        for (const x of s.cells) board[x] = chosen.length;
        chosen.push(s);
        count(
          lo | s.lo,
          hi | s.hi,
          left - s.cells.length,
          spans + Number(s.spans),
        );
        chosen.pop();
        for (const x of s.cells) board[x] = -1;
        if (stopped) break;
      }
    }
    count(0, 0, N * N, 0);
    enumeration = {
      canonicalTilings: canonicalTilings.size,
      orientedTilings: leaves,
      exact: !stopped,
      nodes,
      offlineMs: performance.now() - start,
    };
  }
  const repeats = [...counts.values()].sort((a, b) => a - b),
    result = {
      size: N,
      samples,
      distinctUpToD8: counts.size,
      averageRepeats: samples / counts.size,
      maxRepeats: Math.max(...repeats),
      medianRepeats: repeats[Math.floor(repeats.length / 2)],
      roomCounts,
      minArea: Math.min(...areas),
      maxArea: Math.max(...areas),
      areaCap: baseline ? null : N + 3,
      catalogPlacements: catalogSize,
      admittedTilingsEnumeration: enumeration,
    };
  report.push(result);
  console.log(JSON.stringify(result));
}
fs.writeFileSync(
  baseline
    ? "/tmp/murdoku-layout-variety-before.json"
    : "/tmp/murdoku-layout-variety-after.json",
  JSON.stringify(report, null, 2),
);
