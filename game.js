(function (root) {
  "use strict";
  const E =
    typeof module !== "undefined" && module.exports
      ? require("./engine.js")
      : root.MurdokuEngine;
  class Game {
    constructor(puzzle) {
      this.puzzle = puzzle;
      this.positions = Array(6).fill(-1);
      this.marks = [];
      this.history = [];
      this.moves = 0;
      this.started = Date.now();
    }
    save() {
      this.history.push({
        positions: [...this.positions],
        marks: [...this.marks],
      });
      this.moves++;
    }
    occupant(cell) {
      return this.positions.indexOf(cell);
    }
    act(cell, person, mark = false, clear = false) {
      const occupant = this.occupant(cell);
      if (mark && occupant >= 0) return false;
      if (clear && occupant < 0 && !this.marks.includes(cell)) return false;
      if (!clear && !mark && occupant < 0 && person < 0) return false;
      this.save();
      if (occupant >= 0) this.positions[occupant] = -1;
      if (mark) {
        if (this.marks.includes(cell))
          this.marks = this.marks.filter((x) => x !== cell);
        else this.marks.push(cell);
      } else {
        this.marks = this.marks.filter((x) => x !== cell);
        if (!clear && occupant < 0) this.positions[person] = cell;
      }
      return true;
    }
    undo() {
      const previous = this.history.pop();
      if (!previous) return false;
      this.positions = previous.positions;
      this.marks = previous.marks;
      return true;
    }
    reset() {
      if (this.positions.some((x) => x >= 0) || this.marks.length) {
        this.save();
        this.positions.fill(-1);
        this.marks = [];
      }
    }
    conflicts() {
      const rows = [],
        cols = [];
      for (let i = 0; i < 6; i++) {
        if (this.positions.filter((x) => x >= 0 && E.row(x) === i).length > 1)
          rows.push(i);
        if (this.positions.filter((x) => x >= 0 && E.col(x) === i).length > 1)
          cols.push(i);
      }
      return { rows, cols };
    }
    check() {
      const placed = this.positions.filter((x) => x >= 0).length,
        conflict = this.conflicts();
      const wrong = this.positions.filter(
        (x, i) => x >= 0 && x !== this.puzzle.solution[i],
      ).length;
      const contradicted = this.puzzle.clues.filter((c) => {
        if (c.type === "count" && placed < 6) return false;
        if (c.a !== undefined && this.positions[c.a] < 0) return false;
        if (c.b !== undefined && this.positions[c.b] < 0) return false;
        return !E.clueTrue(c, this.positions, this.puzzle.rooms);
      }).length;
      const solved =
        placed === 6 &&
        E.valid(this.positions, this.puzzle.rooms, this.puzzle.clues);
      const murderer = solved
        ? this.positions.findIndex(
            (x, i) =>
              i > 0 &&
              this.puzzle.rooms[x] === this.puzzle.rooms[this.positions[0]],
          )
        : -1;
      return {
        missing: 6 - placed,
        wrong,
        clues: contradicted,
        conflicts: conflict.rows.length + conflict.cols.length,
        solved,
        murderer,
      };
    }
  }
  if (typeof module !== "undefined" && module.exports) module.exports = Game;
  else root.MurdokuGame = Game;
})(typeof globalThis !== "undefined" ? globalThis : this);
