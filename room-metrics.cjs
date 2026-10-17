/* Independent Node audit oracle. It reads only the final cell-to-room map. */
function measure(cells, N) {
  const ids = [...new Set(cells)],
    rooms = ids.map((id) => {
      const indices = cells.flatMap((v, i) => (v === id ? [i] : [])),
        ys = indices.map((i) => Math.floor(i / N)),
        xs = indices.map((i) => i % N),
        top = Math.min(...ys),
        bottom = Math.max(...ys),
        left = Math.min(...xs),
        right = Math.max(...xs),
        w = right - left + 1,
        h = bottom - top + 1;
      const queue = [indices[0]],
        seen = new Set(queue);
      for (const i of queue)
        for (const j of [
          i % N ? i - 1 : -1,
          i % N < N - 1 ? i + 1 : -1,
          i >= N ? i - N : -1,
          i + N < N * N ? i + N : -1,
        ])
          if (j >= 0 && cells[j] === id && !seen.has(j)) {
            seen.add(j);
            queue.push(j);
          }
      return {
        id,
        w,
        h,
        top,
        left,
        area: indices.length,
        aspect: Math.max(w, h) / Math.min(w, h),
        fill: indices.length / (w * h),
        connected: seen.size === indices.length,
        span: w === N || h === N,
      };
    }),
    edges = new Set();
  for (let i = 0; i < cells.length; i++)
    for (const j of [i % N < N - 1 ? i + 1 : -1, i + N < N * N ? i + N : -1])
      if (j >= 0 && cells[i] !== cells[j])
        edges.add([cells[i], cells[j]].sort((a, b) => a - b).join(":"));
  const adjacency = [...edges]
      .map((key) => key.split(":").map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    byId = new Map(rooms.map((r) => [r.id, r])),
    sameNeighbors = adjacency.filter(
      ([a, b]) =>
        byId.get(a).w === byId.get(b).w && byId.get(a).h === byId.get(b).h,
    ),
    strong =
      rooms.filter((r) =>
        adjacency
          .filter(([a, b]) => a === r.id || b === r.id)
          .every(([a, b]) => {
            const other = byId.get(a === r.id ? b : a);
            return other.w !== r.w && other.h !== r.h;
          }),
      ).length / rooms.length;
  return {
    rooms,
    adjacency,
    sameNeighbors,
    strong,
    spans: rooms.filter((r) => r.span).length,
  };
}

module.exports = { measure };
