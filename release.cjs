/* Release source of truth. Edit VERSION, then run node release.cjs. No runtime build needed. */
const VERSION = "1.2.0";
const fs = require("node:fs"),
  path = require("node:path");
const root = __dirname,
  check = process.argv.includes("--check");
function update(file, transform) {
  const p = path.join(root, file),
    before = fs.readFileSync(p, "utf8"),
    after = transform(before);
  if (check) {
    if (before !== after)
      throw Error(
        `${file} is not stamped for ${VERSION}; run node release.cjs`,
      );
  } else if (before !== after) fs.writeFileSync(p, after);
}
for (const file of [
  "engine.js",
  "game.js",
  "strings.js",
  "app.js",
  "reliability.js",
])
  update(file, (text) => {
    const pattern = /const BUILD_ID = "[^"]+";/g;
    if ([...text.matchAll(pattern)].length !== 1)
      throw Error(`${file}: missing or duplicate build stamp`);
    return text.replace(pattern, `const BUILD_ID = "${VERSION}";`);
  });
update("index.html", (text) => {
  if ((text.match(/data-build="[^"]+"/g) ?? []).length !== 1)
    throw Error("index.html: missing or duplicate build stamp");
  return text
    .replace(/data-build="[^"]+"/, `data-build="${VERSION}"`)
    .replace(/(\b(?:src|href)="[^"?]+)(?:\?v=[^"?]+)?"/g, `$1?v=${VERSION}"`);
});
// The current English dictionary is also the compatibility floor when a genuinely
// pre-1.1 strings.js lacks the modern API and newer object/hint/size keys entirely.
delete require.cache[require.resolve("./strings.js")];
const english = JSON.stringify(require("./strings.js").strings.en);
update("reliability.js", (text) => {
  if (
    !text.includes("// BEGIN GENERATED ENGLISH") ||
    !text.includes("// END GENERATED ENGLISH")
  )
    throw Error("Missing English snapshot markers");
  return text.replace(
    /\/\/ BEGIN GENERATED ENGLISH[\s\S]*?\/\/ END GENERATED ENGLISH/,
    `// BEGIN GENERATED ENGLISH\n  // prettier-ignore\n  const english = ${english};\n  // END GENERATED ENGLISH`,
  );
});
console.log(
  `${check ? "PASS: checked" : "Stamped"} ${VERSION}: scripts, local HTML URLs, English compatibility snapshot.`,
);
