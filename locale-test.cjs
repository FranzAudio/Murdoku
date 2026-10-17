"use strict";
const assert = require("node:assert/strict"),
  I = require("./strings.js");
const requiredKeys = [
  "subtitle",
  "language",
  "new",
  "undo",
  "reset",
  "mark",
  "check",
  "hint",
  "hintAria",
  "hintEyebrow",
  "hintDismiss",
  "hintStep",
  "hintShowClue",
  "hintReturn",
  "hintSubtext",
  "hintFrom",
  "hintArc",
  "hintForced",
  "hintCandidates",
  "hintConflict",
  "hintSolved",
  "hintNoFurther",
  "hintCompleted",
  "start",
  "welcomeTitle",
  "welcome",
  "tray",
  "victim",
  "suspect",
  "clues",
  "dossier",
  "rooms",
  "roomNames",
  "names",
  "traits",
  "categories",
  "instructions",
  "rules",
  "all",
  "roomFilter",
  "objectFilter",
  "furnitureTitle",
  "furnitureGenerating",
  "furnitureError",
  "cellOccupied",
  "cellOn",
  "objectNames",
  "objectOn",
  "objectClues",
  "position",
  "boardTab",
  "cluesTab",
  "ready",
  "noCase",
  "case",
  "remaining",
  "placed",
  "empty",
  "markCell",
  "resolved",
  "resetQuestion",
  "confirm",
  "cancel",
  "generating",
  "sizeLabel",
  "sizeOptions",
  "sizeConfirm",
  "sizeContinue",
  "sizeCounter",
  "sizeError",
  "sizeRevert",
  "dossierToggle",
  "verifying",
  "error",
  "retry",
  "back",
  "solved",
  "another",
  "close",
  "murderer",
  "time",
  "moves",
  "checkResult",
  "conflictRow",
  "conflictCol",
  "roomClue",
  "directionClue",
  "north",
  "west",
  "besideClue",
  "touchClue",
  "countClue",
  "footer",
];
assert.equal(requiredKeys.length, 93);
function leaves(value, path = "") {
  return Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === "string"
      ? [[path + key, entry]]
      : leaves(entry, path + key + "."),
  );
}
const english = leaves(I.strings.en),
  tokens = (text) =>
    [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const values = {
  name: "PERSON",
  other: "OTHER",
  room: "ROOM",
  object: "OBJECT",
  on: "ON",
  direction: "DIRECTION",
  id: 12,
  count: 3,
  total: 7,
  current: 2,
  remaining: 5,
  missing: 4,
  wrong: 1,
  clues: 2,
  conflicts: 1,
  value: "B",
  size: 7,
  cell: "G7",
  coord: "G7",
  cells: "A1, B2",
};
for (const code of ["es", "ca"]) {
  const raw = I.strings[code],
    resolved = I.locale(code);
  for (const key of requiredKeys)
    assert.ok(Object.hasOwn(raw, key), `${code} missing ${key}`);
  for (const [path, template] of english) {
    const read = (object) => path.split(".").reduce((v, k) => v?.[k], object);
    const translated = read(raw);
    assert.equal(typeof translated, "string", `${code} ${path}`);
    assert.ok(translated.trim());
    assert.deepEqual(
      tokens(translated),
      tokens(template),
      `${code} ${path} placeholders`,
    );
    const text = I.format(read(resolved), values);
    assert.ok(!/undefined|null|\{\w+\}/.test(text), `${code} ${path}: ${text}`);
  }
  // Test both resolver APIs at each leaf, including arrays and nested templates.
  for (const [path, expected] of english) {
    const parts = path.split("."),
      key = parts.pop();
    let parent = raw;
    for (const part of parts) parent = parent[part];
    const original = parent[key];
    for (const absent of [undefined, null, ""]) {
      parent[key] = absent;
      assert.equal(I.resolveString(path, code), expected);
      assert.equal(
        path.split(".").reduce((v, k) => v[k], I.locale(code)),
        expected,
      );
    }
    parent[key] = original;
  }
  const original = raw.objectClues;
  delete raw.objectClues;
  assert.deepEqual(I.locale(code).objectClues, I.strings.en.objectClues);
  raw.objectClues = original;
}
assert.equal(I.resolveString("new", "not-a-locale"), "New Case");
assert.equal(I.resolveString("unknown.key", "ca"), "unknown.key");
assert.equal(I.format("Keep {missing} readable"), "Keep {missing} readable");
assert.equal(I.format("{value}", { value: 0 }), "0");
console.log(
  `PASS: 93 required keys and all ${english.length} English leaf paths translated with matching parameters in ES/CA; nested/array/missing/null/blank fallback, unknown locale, safe formatting.`,
);

assert.equal(
  I.formatClue(
    I.strings.es.objectClues.avoids,
    { name: "Vance", object: "Sillón" },
    "es",
    { object: "chair", person: 2 },
  ),
  "Vance evita el Sillón (no ocupa esa casilla).",
);
assert.equal(
  I.formatClue(
    I.strings.ca.objectClues.beside,
    { name: "Alder", object: "Escriptori" },
    "ca",
    { object: "desk", person: 3 },
  ),
  "Alder és al costat de l’Escriptori (comparteixen un costat).",
);
assert.equal(
  I.formatClue(
    I.strings.es.roomClue,
    { name: "Vance", room: "Comedor" },
    "es",
    { room: 1 },
  ),
  "Vance está en el Comedor.",
);
assert.equal(
  I.formatClue(
    I.strings.ca.roomClue,
    { name: "Alder", room: "Hivernacle" },
    "ca",
    { room: 2 },
  ),
  "Alder és a l’Hivernacle.",
);
