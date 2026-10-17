/* Pure finite-domain puzzle engine. No DOM, network, or persistence. */
(function (root) {
  "use strict";
  const SUPPORTED_SIZES = [5, 6, 7];
  const row = (x, size = 6) => Math.floor(x / size),
    col = (x, size = 6) => x % size;
  const indices = (length) => Array.from({ length }, (_, i) => i);
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, random) {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function partition(random, N) {
    const minimum = N - 1,
      maximum = N === 5 ? 5 : N + 1;
    const rects = [[0, 0, N, N]],
      target = minimum + Math.floor(random() * (maximum - minimum + 1));
    while (rects.length < target) {
      const options = rects
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => q[2] * q[3] > 2);
      const { q, i } = options[Math.floor(random() * options.length)];
      const [r, c, h, w] = q;
      const vertical = w > 1 && (h === 1 || random() < 0.5);
      const cut = 1 + Math.floor(random() * ((vertical ? w : h) - 1));
      rects.splice(
        i,
        1,
        vertical ? [r, c, h, cut] : [r, c, cut, w],
        vertical ? [r, c + cut, h, w - cut] : [r + cut, c, h - cut, w],
      );
    }
    const rooms = Array(N * N);
    shuffle(rects, random).forEach(([r, c, h, w], id) => {
      for (let y = r; y < r + h; y++)
        for (let x = c; x < c + w; x++) rooms[y * N + x] = id;
    });
    return rooms;
  }
  function nearRoom(cell, room, rooms, diagonal) {
    const N = Math.sqrt(rooms.length),
      row = (x) => Math.floor(x / N),
      col = (x) => x % N;
    return indices(rooms.length).some(
      (x) =>
        rooms[x] === room &&
        (diagonal
          ? Math.abs(row(x) - row(cell)) === 1 &&
            Math.abs(col(x) - col(cell)) === 1
          : Math.abs(row(x) - row(cell)) + Math.abs(col(x) - col(cell)) === 1),
    );
  }
  function unary(clue, cell, rooms) {
    if (clue.type === "room") return rooms[cell] === clue.room;
    if (clue.type === "beside" || clue.type === "touch")
      return nearRoom(cell, clue.room, rooms, clue.type === "touch");
    return true;
  }
  function direction(a, b, axis, N) {
    return axis === "north" ? row(a, N) < row(b, N) : col(a, N) < col(b, N);
  }
  function clueTrue(clue, positions, rooms) {
    if (clue.type === "direction")
      return direction(
        positions[clue.a],
        positions[clue.b],
        clue.axis,
        Math.sqrt(rooms.length),
      );
    if (clue.type === "count")
      return (
        new Set(rooms).size - new Set(positions.map((x) => rooms[x])).size ===
        clue.count
      );
    return unary(clue, positions[clue.a], rooms);
  }
  function valid(positions, rooms, clues = []) {
    const N = Math.sqrt(rooms.length);
    return (
      SUPPORTED_SIZES.includes(N) &&
      positions.length === N &&
      positions.every((x) => Number.isInteger(x) && x >= 0 && x < N * N) &&
      new Set(positions.map((x) => row(x, N))).size === N &&
      new Set(positions.map((x) => col(x, N))).size === N &&
      positions.filter((x) => rooms[x] === rooms[positions[0]]).length === 2 &&
      clues.every((c) => clueTrue(c, positions, rooms))
    );
  }
  function initialDomains(puzzle) {
    const N = puzzle.size ?? 6,
      cells = indices(N * N);
    return Array.from({ length: N }, (_, a) =>
      cells.filter((x) =>
        puzzle.clues.every(
          (c) =>
            c.a !== a || c.type === "direction" || unary(c, x, puzzle.rooms),
        ),
      ),
    );
  }
  function compatible(a, x, b, y, clues, N) {
    if (row(x, N) === row(y, N) || col(x, N) === col(y, N)) return false;
    return clues.every(
      (c) =>
        c.type !== "direction" ||
        ((c.a !== a || c.b !== b || direction(x, y, c.axis, N)) &&
          (c.a !== b || c.b !== a || direction(y, x, c.axis, N))),
    );
  }
  // Arc consistency removes unsupported candidates. This loop never guesses or branches.
  function propagate(puzzle) {
    const N = puzzle.size ?? 6;
    const domains = initialDomains(puzzle),
      trace = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (let a = 0; a < N; a++)
        for (let b = 0; b < N; b++)
          if (a !== b) {
            const next = domains[a].filter((x) =>
              domains[b].some((y) => compatible(a, x, b, y, puzzle.clues, N)),
            );
            if (next.length !== domains[a].length) {
              trace.push({
                person: a,
                support: b,
                removed: domains[a].length - next.length,
              });
              domains[a] = next;
              changed = true;
            }
          }
    }
    const solution = domains.map((d) => d[0]);
    return {
      domains,
      trace,
      solved:
        domains.every((d) => d.length === 1) &&
        valid(solution, puzzle.rooms, puzzle.clues),
      solution,
    };
  }
  // Exhaustive assignment search independent of propagation. Stop only after limit solutions.
  function enumerate(puzzle, limit = 2) {
    const N = puzzle.size ?? 6,
      row = (x) => Math.floor(x / N),
      col = (x) => x % N;
    const domains = initialDomains(puzzle),
      order = indices(N).sort((a, b) => domains[a].length - domains[b].length),
      positions = Array(N).fill(-1),
      solutions = [];
    function visit(depth, rows, cols) {
      if (solutions.length >= limit) return;
      if (depth === N) {
        if (valid(positions, puzzle.rooms, puzzle.clues))
          solutions.push([...positions]);
        return;
      }
      const a = order[depth];
      for (const x of domains[a]) {
        if (rows & (1 << row(x)) || cols & (1 << col(x))) continue;
        if (
          !positions.every(
            (y, b) => y < 0 || compatible(a, x, b, y, puzzle.clues, N),
          )
        )
          continue;
        positions[a] = x;
        visit(depth + 1, rows | (1 << row(x)), cols | (1 << col(x)));
        positions[a] = -1;
        if (solutions.length >= limit) return;
      }
    }
    visit(0, 0, 0);
    return solutions;
  }
  function verify(puzzle) {
    const deductions = propagate(puzzle),
      solutions = enumerate(puzzle);
    return {
      valid: valid(puzzle.solution, puzzle.rooms, puzzle.clues),
      unique:
        solutions.length === 1 &&
        solutions[0].every((x, i) => x === puzzle.solution[i]),
      forward:
        deductions.solved &&
        deductions.solution.every((x, i) => x === puzzle.solution[i]),
      deductions: deductions.trace.length,
    };
  }
  function generate(seed = Date.now() >>> 0, maxAttempts = 100, size = 6) {
    if (!SUPPORTED_SIZES.includes(size))
      throw new RangeError("UNSUPPORTED_SIZE");
    const N = size,
      row = (x) => Math.floor(x / N),
      col = (x) => x % N;
    const random = rng(seed);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rooms = partition(random, N),
        columns = shuffle(indices(N), random);
      let solution = columns.map((c, r) => r * N + c);
      const pairs = solution.filter(
        (x) => solution.filter((y) => rooms[y] === rooms[x]).length === 2,
      );
      if (!pairs.length) continue;
      const victim = pairs[Math.floor(random() * pairs.length)];
      solution = [
        victim,
        ...shuffle(
          solution.filter((x) => x !== victim),
          random,
        ),
      ];
      const clues = solution.map((x, a) => ({
        type: "room",
        a,
        room: rooms[x],
      }));
      for (const axis of ["north", "west"]) {
        const order = indices(N).sort((a, b) =>
          axis === "north"
            ? row(solution[a]) - row(solution[b])
            : col(solution[a]) - col(solution[b]),
        );
        for (let i = 0; i < N - 1; i++)
          clues.push({ type: "direction", a: order[i], b: order[i + 1], axis });
      }
      for (const type of ["beside", "touch"]) {
        const choices = [];
        for (let a = 0; a < N; a++)
          for (const room of new Set(rooms))
            if (
              room !== rooms[solution[a]] &&
              nearRoom(solution[a], room, rooms, type === "touch")
            )
              choices.push({ type, a, room });
        if (choices.length)
          clues.push(choices[Math.floor(random() * choices.length)]);
      }
      clues.push({
        type: "count",
        count:
          new Set(rooms).size - new Set(solution.map((x) => rooms[x])).size,
      });
      const puzzle = { size, seed: seed >>> 0, rooms, solution, clues };
      // Keep room and vocabulary clues; remove redundant directional clues only when deduction still finishes.
      for (const clue of shuffle(
        clues.filter((c) => c.type === "direction"),
        random,
      )) {
        const index = clues.indexOf(clue);
        clues.splice(index, 1);
        if (!propagate(puzzle).solved) clues.splice(index, 0, clue);
      }
      const result = verify(puzzle);
      if (
        result.valid &&
        result.unique &&
        result.forward &&
        clues.some((c) => c.type === "beside") &&
        clues.some((c) => c.type === "touch")
      )
        return { ...puzzle, proof: result };
    }
    throw new Error("GENERATION_EXHAUSTED");
  }
  const API = {
    generate,
    verify,
    enumerate,
    propagate,
    valid,
    clueTrue,
    row,
    col,
    rng,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.MurdokuEngine = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
