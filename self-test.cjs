"use strict";
const assert = require("node:assert/strict"),
  E = require("./engine.js"),
  Game = require("./game.js");
function objectTruth(clue, positions, puzzle) {
  const object = puzzle.objects.find((o) => o.id === clue.object),
    cell = positions[clue.a],
    N = puzzle.size;
  if (!object) return false;
  const dr = Math.floor(cell / N) - Math.floor(object.cell / N),
    dc = (cell % N) - (object.cell % N);
  switch (clue.relation) {
    case "sitting_on":
    case "standing_on":
      return cell === object.cell;
    case "beside":
      return Math.abs(dr) + Math.abs(dc) === 1;
    case "south_of":
      return dr > 0;
    case "avoids":
      return cell !== object.cell;
    case "only_person":
      return (
        puzzle.rooms[cell] === puzzle.rooms[object.cell] &&
        positions.filter((x) => puzzle.rooms[x] === puzzle.rooms[object.cell])
          .length === 1
      );
    default:
      return false;
  }
}
const started = Date.now(),
  cases = Number(process.argv[2] || 100);
const permutations = (a) =>
  a.length
    ? a.flatMap((x, i) =>
        permutations(a.filter((_, j) => j !== i)).map((t) => [x, ...t]),
      )
    : [[]];
for (const size of [5, 6, 7]) {
  const fingerprints = new Set(),
    relations = new Set(),
    objectTypes = new Set(),
    times = [];
  for (let seed = 0; seed < cases; seed++) {
    const start = performance.now(),
      p = E.generate(seed, 100, size);
    times.push(performance.now() - start);
    assert.equal(p.size, size);
    assert.equal(p.solution.length, size);
    assert.equal(p.rooms.length, size * size);
    const proof = E.verify(p);
    assert.deepEqual(
      [proof.valid, proof.unique, proof.forward],
      [true, true, true],
      `size ${size}, seed ${seed}`,
    );
    assert.ok(p.rooms.every((x) => Number.isInteger(x) && x >= 0 && x < 8));
    const count = new Set(p.rooms).size;
    assert.ok(count >= size - 1 && count <= (size === 5 ? 5 : size + 1));
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
            Math.abs(E.row(cell, size) - E.row(next, size)) +
              Math.abs(E.col(cell, size) - E.col(next, size)) ===
              1
          ) {
            seen.add(next);
            queue.push(next);
          }
      }
      assert.equal(seen.size, cells.length, "connected room partition");
    }
    for (const type of ["room", "direction", "beside", "touch", "count"])
      assert.ok(p.clues.some((c) => c.type === type));
    assert.ok(
      p.clues.every((c) => E.clueTrue(c, p.solution, p.rooms, p.objects)),
    );
    assert.equal(p.objects.length, size - 1, "fixed 4/5/6 furniture density");
    assert.equal(new Set(p.objects.map((o) => o.type)).size, p.objects.length);
    assert.equal(new Set(p.objects.map((o) => o.cell)).size, p.objects.length);
    assert.equal(new Set(p.objects.map((o) => o.id)).size, p.objects.length);
    assert.ok(
      p.objects.every(
        (o) => Number.isInteger(o.cell) && o.cell >= 0 && o.cell < size * size,
      ),
    );
    for (const object of p.objects) {
      assert.ok(
        ["desk", "table", "fireplace", "chair", "piano", "billiards"].includes(
          object.type,
        ),
      );
      objectTypes.add(object.type);
    }
    const objectClues = p.clues.filter((c) => c.type === "object");
    assert.equal(objectClues.length, 5);
    for (const clue of objectClues) {
      relations.add(clue.relation);
      assert.ok(p.objects.some((o) => o.id === clue.object));
      assert.ok(objectTruth(clue, p.solution, p));
      // Independent semantic oracle over every possible target cell, including
      // false candidates, catches diagonal/wrapping/equality/off-by-one mistakes.
      for (let cell = 0; cell < size * size; cell++) {
        const positions = [...p.solution];
        positions[clue.a] = cell;
        assert.equal(
          E.clueTrue(clue, positions, p.rooms, p.objects),
          objectTruth(clue, positions, p),
          `${size} ${clue.relation} ${cell}`,
        );
      }
    }
    const publicCase = {
      size,
      rooms: p.rooms,
      clues: p.clues,
      objects: p.objects,
    };
    assert.deepEqual(
      E.enumerate(publicCase),
      [p.solution],
      "exhaustive unique solution, without answer as input",
    );
    const deduction = E.propagate(publicCase);
    assert.ok(deduction.solved);
    assert.deepEqual(deduction.solution, p.solution);
    assert.ok(deduction.trace.length);
    fingerprints.add(JSON.stringify([p.rooms, p.solution, p.objects]));
    if (seed === 0) {
      // Independently visit every pair of row/column permutations. Cheap room tests
      // reject assignments before evaluating the complete rules and clue vocabulary.
      const orders = permutations(Array.from({ length: size }, (_, i) => i));
      let solutions = 0,
        visited = 0;
      const roomClues = p.clues.filter((c) => c.type === "room");
      for (const rows of orders)
        for (const cols of orders) {
          visited++;
          if (
            !roomClues.every(
              (c) => p.rooms[rows[c.a] * size + cols[c.a]] === c.room,
            )
          )
            continue;
          const positions = rows.map((r, i) => r * size + cols[i]);
          if (E.valid(positions, p.rooms, p.clues, p.objects)) solutions++;
        }
      assert.equal(solutions, 1);
      console.log(
        `${size}×${size}: independent ${visited.toLocaleString("en-US")}-assignment enumeration PASS`,
      );
    }
  }
  assert.equal(fingerprints.size, cases, "seed variation");
  for (const relation of [
    "sitting_on",
    "standing_on",
    "beside",
    "south_of",
    "avoids",
    "only_person",
  ])
    assert.ok(relations.has(relation), `missing ${relation} at ${size}`);
  assert.equal(objectTypes.size, 6, "all six furniture assets covered");
  const p = E.generate(99, 100, size),
    g = new Game(p);
  const only = p.clues.find(
      (c) => c.type === "object" && c.relation === "only_person",
    ),
    fixture = p.objects.find((o) => o.id === only.object),
    other = (only.a + 1) % size;
  const duplicate = [...p.solution];
  duplicate[other] = fixture.cell;
  assert.equal(
    E.clueTrue(only, duplicate, p.rooms, p.objects),
    false,
    "only-person forbids a second room occupant",
  );
  const victimCells = p.rooms
    .map((room, cell) => (room === p.rooms[p.solution[0]] ? cell : -1))
    .filter((cell) => cell >= 0);
  const baseClues = p.clues.filter((c) => c.type !== "object");
  assert.ok(
    E.valid(p.solution, p.rooms, baseClues, [
      { id: "chair", type: "chair", cell: p.solution[0] },
    ]),
    "fixture can share victim cell",
  );
  assert.ok(
    E.valid(p.solution, p.rooms, baseClues, [
      { id: "chair", type: "chair", cell: victimCells[0] },
      { id: "desk", type: "desk", cell: victimCells[1] },
    ]),
    "multiple fixtures can share a room",
  );
  const partial = new Game({ ...p, clues: [only] });
  partial.act(fixture.cell, other);
  assert.equal(
    partial.check().clues,
    1,
    "only-person catches other occupant before named person is placed",
  );
  partial.undo();
  assert.equal(partial.check().clues, 0);
  const badReference = { ...p, clues: [{ ...only, object: "missing" }] };
  assert.equal(E.enumerate(badReference).length, 0);
  assert.equal(E.propagate(badReference).solved, false);
  assert.equal(
    E.verify({ ...p, objects: [...p.objects, p.objects[0]] }).valid,
    false,
    "duplicate fixture cells/IDs rejected",
  );
  assert.equal(g.positions.length, size);
  assert.equal(g.check().missing, size);
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
  g.act(9, 0);
  assert.equal(g.positions[0], 9);
  assert.equal(g.occupant(8), -1);
  g.reset();
  assert.ok(g.positions.every((x) => x < 0));
  g.undo();
  assert.equal(g.positions[0], 9);
  g.reset();
  for (let person = 0; person < size; person++)
    g.act(p.solution[person], person);
  assert.ok(g.check().solved);
  assert.ok(g.check().murderer > 0);
  assert.equal(g.check().wrong, 0);
  assert.equal(g.check().clues, 0);
  g.act(p.solution[0], 0, false, true);
  assert.equal(g.check().missing, 1);
  const before = JSON.stringify([g.positions, g.marks, g.history]);
  assert.equal(g.act(size * size, 0), false);
  assert.equal(g.act(0, size), false);
  assert.equal(before, JSON.stringify([g.positions, g.marks, g.history]));
  assert.equal(E.enumerate({ ...p, clues: [] }).length, 2);
  assert.equal(E.propagate({ ...p, clues: [] }).solved, false);
  const impossible = { ...p, clues: [{ type: "room", a: 0, room: 99 }] };
  assert.equal(E.enumerate(impossible).length, 0);
  assert.equal(E.propagate(impossible).solved, false);
  assert.deepEqual(E.generate(123, 100, size), E.generate(123, 100, size));
  times.sort((a, b) => a - b);
  console.log(
    `${size}×${size}: ${cases} seeds PASS; generation p95=${times[Math.floor(times.length * 0.95)].toFixed(1)}ms, max=${times.at(-1).toFixed(1)}ms`,
  );
}
assert.equal(E.generate(0).size, 6, "default remains 6×6");
assert.throws(() => E.generate(0, 0), /GENERATION_EXHAUSTED/);
assert.throws(() => E.generate(0, 100, 8), /UNSUPPORTED_SIZE/);
assert.equal(E.row(48, 7), 6);
assert.equal(E.col(48, 7), 6);
console.log(
  `PASS: all sizes, objects and six relation truth tables, rules/clues, exhaustive uniqueness, forward-only deduction, independent full enumeration, room ranges/connectivity, default, invalid size, reproducibility, variation and game actions; ${Date.now() - started}ms.`,
);
