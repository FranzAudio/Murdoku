"use strict";
const assert = require("node:assert/strict"),
  E = require("./engine.js"),
  Game = require("./game.js");
const perSize = Number(process.argv[2] || 50),
  start = Date.now();
const snapshot = (g) =>
  JSON.stringify({
    positions: g.positions,
    marks: g.marks,
    history: g.history,
    moves: g.moves,
    started: g.started,
    puzzle: g.puzzle,
  });
function unaryAllowed(clue, person, cell, p) {
  const n = p.size,
    r = (x) => Math.floor(x / n),
    c = (x) => x % n;
  if (clue.type === "object") {
    const object = p.objects.find((o) => o.id === clue.object),
      sameRoom = p.rooms[cell] === p.rooms[object.cell];
    if (clue.relation === "only_person")
      return person === clue.a ? sameRoom : !sameRoom;
    if (person !== clue.a) return true;
    switch (clue.relation) {
      case "sitting_on":
      case "standing_on":
        return cell === object.cell;
      case "beside":
        return (
          Math.abs(r(cell) - r(object.cell)) +
            Math.abs(c(cell) - c(object.cell)) ===
          1
        );
      case "south_of":
        return r(cell) > r(object.cell);
      case "avoids":
        return cell !== object.cell;
      default:
        throw Error("unknown relation");
    }
  }
  if (clue.a !== person || ["direction", "count"].includes(clue.type))
    return true;
  if (clue.type === "room") return p.rooms[cell] === clue.room;
  return p.rooms.some(
    (room, x) =>
      room === clue.room &&
      (clue.type === "beside"
        ? Math.abs(r(cell) - r(x)) + Math.abs(c(cell) - c(x)) === 1
        : Math.abs(r(cell) - r(x)) === 1 && Math.abs(c(cell) - c(x)) === 1),
  );
}
function pairAllowed(a, x, b, y, p) {
  const r = (z) => Math.floor(z / p.size),
    c = (z) => z % p.size;
  if (r(x) === r(y) || c(x) === c(y)) return false;
  return p.clues.every((clue) => {
    if (clue.type !== "direction") return true;
    const left = clue.a === a && clue.b === b,
      right = clue.a === b && clue.b === a;
    if (!left && !right) return true;
    const first = left ? x : y,
      second = left ? y : x;
    return clue.axis === "north" ? r(first) < r(second) : c(first) < c(second);
  });
}
let checked = 0;
for (const size of [5, 6, 7])
  for (let seed = 0; seed < perSize; seed++) {
    const p = E.generate(seed, 100, size),
      publicCase = { size, rooms: p.rooms, clues: p.clues, objects: p.objects },
      frozen = JSON.stringify(publicCase),
      proof = E.propagate(publicCase);
    assert.ok(proof.solved);
    assert.equal(JSON.stringify(publicCase), frozen);
    const domains = Array.from({ length: size }, () =>
      Array.from({ length: size * size }, (_, i) => i),
    );
    for (let index = 0; index < proof.trace.length; index++) {
      const step = proof.trace[index];
      assert.deepEqual(step.before, domains[step.person]);
      assert.ok(step.before.length > step.after.length);
      assert.ok(
        step.clueIndices.length &&
          step.clueIndices.every(
            (i) => Number.isInteger(i) && i >= 0 && i < p.clues.length,
          ),
      );
      assert.ok(step.dependencies.every((i) => i >= 0 && i < index));
      const expected =
        step.kind === "clue"
          ? step.before.filter((cell) =>
              unaryAllowed(p.clues[step.clueIndices[0]], step.person, cell, p),
            )
          : step.before.filter((cell) =>
              domains[step.support].some((other) =>
                pairAllowed(step.person, cell, step.support, other, p),
              ),
            );
      if (step.kind === "arc")
        assert.deepEqual(step.supportDomain, domains[step.support]);
      assert.deepEqual(
        step.after,
        expected,
        "every pruning step must have a forward witness",
      );
      assert.deepEqual(
        step.removedCells,
        step.before.filter((cell) => !expected.includes(cell)),
      );
      assert.equal(step.removed, step.removedCells.length);
      domains[step.person] = step.after;
      checked++;
    }
    assert.deepEqual(domains, proof.domains);
    assert.deepEqual(
      domains.map((d) => d[0]),
      p.solution,
    );
    const game = new Game(publicCase),
      board = snapshot(game);
    let previous = -1;
    for (let i = 0; i < proof.trace.length; i++) {
      const hint = game.hint();
      assert.equal(hint.status, "step");
      assert.equal(hint.index, previous + 1);
      assert.deepEqual(hint.step, proof.trace[hint.index]);
      assert.equal(snapshot(game), board);
      previous = hint.index;
      assert.deepEqual(
        game.hint(false),
        hint,
        "dismiss/reopen retains current step",
      );
      assert.equal(snapshot(game), board);
    }
    assert.equal(game.hint().status, "exhausted");
    assert.equal(game.hint().status, "exhausted");
    assert.equal(snapshot(game), board);
    // Hidden answer access is forbidden, not merely absent by convention.
    const guarded = { ...publicCase };
    Object.defineProperty(guarded, "solution", {
      get() {
        throw Error("hint read hidden answer");
      },
    });
    assert.equal(new Game(guarded).hint().status, "step");
    const conflict = new Game(publicCase);
    conflict.act(0, 0);
    conflict.act(1, 1);
    const bad = snapshot(conflict);
    assert.equal(conflict.hint().status, "conflict");
    assert.equal(snapshot(conflict), bad);
    assert.equal(conflict.hintCursor, 0);
    const marked = new Game(publicCase);
    marked.act(p.solution[0], 0, true);
    const markState = snapshot(marked);
    assert.equal(marked.hint().status, "conflict");
    assert.equal(snapshot(marked), markState);
    const wrong = new Game(publicCase);
    wrong.act((p.solution[0] + 1) % (size * size), 0);
    assert.equal(wrong.hint().status, "conflict");
    const solved = new Game(publicCase);
    for (let person = 0; person < size; person++)
      solved.act(p.solution[person], person);
    const complete = snapshot(solved);
    assert.equal(solved.hint().status, "solved");
    assert.equal(snapshot(solved), complete);
    const partial = new Game(publicCase);
    partial.act(p.solution[0], 0);
    const partialState = snapshot(partial);
    const next = partial.hint();
    assert.equal(next.status, "step");
    assert.notEqual(next.step.person, 0);
    assert.equal(snapshot(partial), partialState);
    partial.undo();
    assert.equal(partial.hint().index, 0);
    partial.reset();
    assert.equal(partial.hint().index, 0);
    const noClues = new Game({ ...publicCase, clues: [] });
    assert.equal(noClues.hint().status, "unavailable");
  }
console.log(
  `PASS: ${perSize * 3} cases, ${checked} independently replayed forward trace steps; hint order/clue references/witnesses, no hidden answer access, non-mutation of placements/marks/history/moves/timer/puzzle, reopen/exhaustion, empty/partial/solved/conflicted/X/undo/reset/unavailable; ${Date.now() - start}ms.`,
);
