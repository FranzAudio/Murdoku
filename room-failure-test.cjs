const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
function load(text) {
  const c = { module: { exports: {} } };
  vm.runInNewContext(text, c);
  return c.module.exports;
}
const E = require("./engine.js");
for (const n of [5, 6, 7]) {
  const externalMap = Array.from({ length: n * n }, (_, i) => i % n); // No partition-search input.
  assert.equal(E.roomGeometry(externalMap, n).valid, false);
  assert.ok(E.auditRoomGeometry(externalMap, n).rooms.some((r) => r.w === 1));
  const disconnected = Array.from(
    { length: n * n },
    (_, i) => (Math.floor(i / n) + (i % n)) % 2,
  );
  assert.equal(E.roomGeometry(disconnected, n).valid, false);
  assert.ok(
    E.auditRoomGeometry(disconnected, n).rooms.some((r) => !r.connected),
  );

  const bounded = load(
    source.replace("if (++nodes > 5000)", "if (++nodes > 0)"),
  );
  assert.throws(
    () => bounded.generate(0, 2, n),
    (e) => e.message === "GENERATION_EXHAUSTED",
    "bounded layout failure must retry then exhaust normally",
  );
  const once = load(
    source.replace(
      "function partition(random, N) {",
      "let forcedFailures=0; function partition(random,N){if(++forcedFailures===1)return null;return workingPartition(random,N);} function workingPartition(random, N) {",
    ),
  );
  assert.ok(
    once.generate(0, 100, n).proof.geometry,
    "a failed layout falls through to the next case attempt",
  );
  const rejected = load(
    source.replace(
      "function roomGeometry(rooms, N = Math.sqrt(rooms.length)) {",
      "function roomGeometry(){return {valid:false}} function unusedRoomGeometry(rooms, N = Math.sqrt(rooms.length)) {",
    ),
  );
  assert.throws(
    () => rejected.generate(0, 5, n),
    (e) => e.message === "GENERATION_EXHAUSTED",
    "no path may bypass the independent final-map geometry gate",
  );
}
console.log(
  "PASS: bounded layout-search failure retries safely, exhausted cases report GENERATION_EXHAUSTED, and a failed final-map geometry gate prevents emission at every size.",
);
const rectangular = Array.from(
  { length: 25 },
  (_, i) => (Math.floor(i / 5) < 2 ? 0 : 2) + (i % 5 < 2 ? 0 : 1),
);
assert.equal(
  E.roomGeometry(rectangular, 5).valid,
  true,
  "a valid external rectangle map not produced by the notched-only search is accepted",
);
assert.deepEqual(E.auditRoomGeometry(rectangular, 5).adjacency, [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
]);

const notched = [..."111122011022000033400033444553444555"].map(Number);
assert.equal(
  E.roomGeometry(notched, 6).valid,
  true,
  "independent external U/notch accepted by final-map gate",
);
assert.equal(
  E.auditRoomGeometry(notched, 6).rooms.find((r) => r.id === 0).fill,
  0.75,
);
