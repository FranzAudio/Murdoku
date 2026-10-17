"use strict";
const assert = require("node:assert/strict"),
  E = require("./engine.js"),
  Game = require("./game.js");
const started = Date.now(),
  cases = Number(process.argv[2] || 250),
  fingerprints = new Set();
for (let seed = 0; seed < cases; seed++) {
  const p = E.generate(seed),
    proof = E.verify(p);
  assert.deepEqual(
    [proof.valid, proof.unique, proof.forward],
    [true, true, true],
    `seed ${seed}`,
  );
  assert.equal(p.rooms.length, 36);
  assert.ok(p.rooms.every((x) => Number.isInteger(x) && x >= 0 && x < 8));
  assert.ok(new Set(p.rooms).size >= 4 && new Set(p.rooms).size <= 8);
  for (const room of new Set(p.rooms)) {
    const cells = p.rooms
        .map((r, i) => (r === room ? i : -1))
        .filter((i) => i >= 0),
      seen = new Set([cells[0]]),
      queue = [cells[0]];
    while (queue.length) {
      const cell = queue.pop();
      for (const next of cells)
        if (
          !seen.has(next) &&
          Math.abs(E.row(cell) - E.row(next)) +
            Math.abs(E.col(cell) - E.col(next)) ===
            1
        ) {
          seen.add(next);
          queue.push(next);
        }
    }
    assert.equal(seen.size, cells.length, "rooms must be connected");
  }
  for (const type of ["room", "direction", "beside", "touch", "count"])
    assert.ok(p.clues.some((c) => c.type === type));
  assert.ok(p.clues.every((c) => E.clueTrue(c, p.solution, p.rooms)));
  assert.equal(E.enumerate(p).length, 1);
  assert.ok(E.propagate(p).trace.length > 0);
  fingerprints.add(JSON.stringify([p.rooms, p.solution]));
  // A second full enumeration of all row and column permutations, without candidate domains.
  if (seed < 3) {
    const permute = (a) =>
      a.length
        ? a.flatMap((x, i) =>
            permute(a.filter((_, j) => j !== i)).map((t) => [x, ...t]),
          )
        : [[]];
    const permutations = permute([0, 1, 2, 3, 4, 5]);
    let count = 0;
    for (const rows of permutations)
      for (const cols of permutations) {
        const positions = rows.map((r, i) => r * 6 + cols[i]);
        if (E.valid(positions, p.rooms, p.clues)) count++;
      }
    assert.equal(count, 1, "independent 518,400-assignment enumeration");
  }
}
assert.equal(fingerprints.size, cases, "seeds yield fresh boards");
const p = E.generate(99),
  g = new Game(p);
assert.equal(g.check().missing, 6);
assert.equal(g.check().wrong, 0);
g.act(0, 0);
g.act(1, 1);
assert.deepEqual(g.conflicts().rows, [0]);
assert.ok(g.check().conflicts > 0);
g.undo();
assert.equal(g.positions[1], -1);
g.act(0, 0);
assert.equal(g.positions[0], -1);
g.act(8, 0, true);
assert.deepEqual(g.marks, [8]);
g.undo();
assert.deepEqual(g.marks, []);
g.act(8, 0, true);
g.act(8, 0);
assert.deepEqual(g.marks, []);
assert.equal(g.positions[0], 8);
g.act(9, 0);
assert.equal(g.positions[0], 9);
assert.equal(g.occupant(8), -1);
g.reset();
assert.ok(g.positions.every((x) => x < 0));
assert.deepEqual(g.marks, []);
g.undo();
assert.equal(g.positions[0], 9);
g.reset();
for (let i = 0; i < 6; i++) g.act(p.solution[i], i);
assert.ok(g.check().solved);
assert.ok(g.check().murderer > 0);
assert.equal(g.check().wrong, 0);
assert.equal(g.check().clues, 0);
g.act(p.solution[0], 0, false, true);
assert.equal(g.check().missing, 1);
assert.ok(
  E.enumerate({ ...p, clues: [] }).length === 2,
  "ambiguous clues must be detected",
);
assert.equal(E.propagate({ ...p, clues: [] }).solved, false);
const impossible = { ...p, clues: [{ type: "room", a: 0, room: 99 }] };
assert.equal(E.enumerate(impossible).length, 0);
assert.equal(E.propagate(impossible).solved, false);
assert.throws(() => E.generate(0, 0), /GENERATION_EXHAUSTED/);
assert.deepEqual(E.generate(1234), E.generate(1234), "seed reproducibility");
console.log(
  `PASS: ${cases} generated cases, validity/uniqueness/forward deduction, connected partitions, vocabulary, variation, negative solver cases, game actions/checks; 3 × 518,400 independent assignments; ${Date.now() - started}ms.`,
);
