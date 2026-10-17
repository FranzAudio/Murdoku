const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const I = require("./strings.js"),
  R = require("./reliability.js"),
  E = require("./engine.js"),
  Game = require("./game.js");
const expected = {
  en: "Some interface text is outdated. Reload the page (Cmd+Shift+R) to finish switching language.",
  it: "Alcuni testi dell'interfaccia sono obsoleti. Ricarica la pagina (Cmd+Shift+R) per completare il cambio di lingua.",
  es: "Parte del texto de la interfaz está desactualizado. Recarga la página (Cmd+Shift+R) para completar el cambio de idioma.",
  ca: "Part del text de la interfície és obsolet. Recarrega la pàgina (Cmd+Shift+R) per completar el canvi d’idioma.",
};
const stale = { window: {} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "test-fixtures/pre-1.1-strings.js"),
    "utf8",
  ),
  stale,
);
const table = stale.window.MurdokuStrings,
  ids = [E.buildId, Game.buildId, I.buildId, R.buildId];
assert.equal(R.buildId, "1.1.1");
assert.ok(ids.every((id) => id === R.buildId));
for (const code of ["en", "it", "es", "ca"]) {
  assert.equal(I.has(code), true);
  assert.equal(R.has(table, code), ["en", "it"].includes(code));
  assert.equal(R.notice(code, I.strings, ids), "");
  assert.equal(
    R.notice(code, table, [E.buildId, Game.buildId, undefined, R.buildId]),
    expected[code],
  );
  for (let index = 0; index < ids.length; index++) {
    const mixed = [...ids];
    mixed[index] = "older";
    assert.equal(R.notice(code, I.strings, mixed), expected[code]);
  }
  const saved = I.strings[code];
  delete I.strings[code];
  assert.equal(I.has(code), false);
  I.strings[code] = saved;
}
assert.equal(R.notice("es", table, ids), expected.es);
assert.equal(R.notice("ca", table, ids), expected.ca);
assert.equal(I.has("xx"), false);
const saved = I.strings.es.objectClues.only_person;
delete I.strings.es.objectClues.only_person;
assert.equal(I.has("es"), true);
assert.equal(R.notice("es", I.strings, ids), "");
assert.equal(
  I.locale("es").objectClues.only_person,
  I.strings.en.objectClues.only_person,
);
I.strings.es.objectClues.only_person = saved;
const fallback = R.legacyI18n(table);
assert.equal(fallback.has("es"), false);
assert.equal(fallback.has("ca"), false);
assert.equal(fallback.locale("es").new, I.strings.en.new);
assert.deepEqual(fallback.locale("es"), I.strings.en);
assert.equal(fallback.locale("it").new, table.it.new);
assert.equal(fallback.locale("it").hint, I.strings.en.hint);
console.log(
  "PASS: four script IDs, legacy table has() false for ES/CA, exact four-locale notices, every build mismatch, missing single template fallback without notice, historical API compatibility.",
);
// Deterministic release tool and independent drift failures, using disposable files.
const { execFileSync, spawnSync } = require("node:child_process"),
  os = require("node:os");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "murdoku-stamp-"));
try {
  const files = [
    "release.cjs",
    "engine.js",
    "game.js",
    "strings.js",
    "app.js",
    "reliability.js",
    "index.html",
  ];
  for (const f of files)
    fs.copyFileSync(path.join(__dirname, f), path.join(temp, f));
  const before = files.map((f) => fs.readFileSync(path.join(temp, f), "utf8"));
  execFileSync(process.execPath, [path.join(temp, "release.cjs")]);
  execFileSync(process.execPath, [path.join(temp, "release.cjs")]);
  assert.deepEqual(
    files.map((f) => fs.readFileSync(path.join(temp, f), "utf8")),
    before,
    "release stamping must be idempotent",
  );
  for (const f of files.filter((f) => f.endsWith(".js"))) {
    const p = path.join(temp, f),
      original = fs.readFileSync(p, "utf8");
    for (const replacement of ['const BUILD_ID = "old";', ""]) {
      fs.writeFileSync(
        p,
        original.replace(/const BUILD_ID = "[^"]+";/, replacement),
      );
      assert.notEqual(
        spawnSync(process.execPath, [path.join(temp, "release.cjs"), "--check"])
          .status,
        0,
        f + " ID drift",
      );
    }
    fs.writeFileSync(p, original);
  }
  for (const [f, from, to] of [
    ["index.html", "?v=1.1.1", "?v=old"],
    ["index.html", 'data-build="1.1.1"', 'data-build="old"'],
    [
      "reliability.js",
      "Mystery at Blackwood Manor",
      "Outdated English snapshot",
    ],
  ]) {
    const p = path.join(temp, f),
      original = fs.readFileSync(p, "utf8");
    fs.writeFileSync(p, original.replace(from, to));
    assert.notEqual(
      spawnSync(process.execPath, [path.join(temp, "release.cjs"), "--check"])
        .status,
      0,
      f + " generated drift",
    );
    fs.writeFileSync(p, original);
  }
  console.log(
    "PASS: deterministic release stamping; --check rejects script/HTML/URL/English snapshot drift and missing script IDs.",
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
