const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  { execFileSync } = require("node:child_process"),
  assert = require("node:assert/strict");
const count = Number(process.argv[2] || 1000),
  baselineIndex = process.argv.indexOf("--baseline"),
  baseline = baselineIndex < 0 ? null : process.argv[baselineIndex + 1];
let source = baseline
  ? execFileSync("git", ["show", `${baseline}:engine.js`], { encoding: "utf8" })
  : fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
const stats = {},
  context = { module: { exports: {} }, __generationStats: stats };
source = source
  .replace(
    "const random = rng(seed);",
    "const stats=globalThis.__generationStats; const random = rng(seed);",
  )
  .replace(
    /for \(let attempt = 0; attempt < maxAttempts; attempt\+\+\) \{/,
    "for (let attempt=0;attempt<maxAttempts;attempt++){stats.attempts++;",
  )
  .replace(
    "if (!rooms) continue;",
    "if (!rooms){stats.layoutFailure++;continue;}",
  )
  .replace(
    "if (!pairs.length) continue;",
    "if (!pairs.length){stats.noVictimPair++;continue;}",
  )
  .replace(
    "if (!fixtures) continue;",
    "if (!fixtures){stats.objectNoSingle++;continue;}",
  )
  .replace(
    "const result = verify(puzzle);",
    "stats.verificationAttempts++;const result = verify(puzzle);",
  );
vm.runInNewContext(source, context);
const E = context.module.exports,
  results = [];
for (const n of [5, 6, 7]) {
  const times = [],
    attempts = [],
    histogram = {},
    total = {
      attempts: 0,
      layoutFailure: 0,
      noVictimPair: 0,
      objectNoSingle: 0,
      verificationAttempts: 0,
    },
    failures = [];
  for (let seed = 0; seed < count; seed++) {
    for (const key of Object.keys(total)) stats[key] = 0;
    const start = performance.now();
    try {
      E.generate(seed, 100, n);
    } catch (e) {
      failures.push({ seed, error: e.message });
    }
    times.push(performance.now() - start);
    attempts.push(stats.attempts);
    histogram[stats.attempts] = (histogram[stats.attempts] || 0) + 1;
    for (const key of Object.keys(total)) total[key] += stats[key];
  }
  times.sort((a, b) => a - b);
  let cold = null;
  if (!baseline) {
    cold = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "-e",
          `const t=performance.now(),E=require(${JSON.stringify(path.join(__dirname, "engine.js"))}),l=performance.now();E.generate(0,100,${n});console.log(JSON.stringify({moduleMs:l-t,firstCaseIncludingCatalogMs:performance.now()-l}));`,
        ],
        { encoding: "utf8" },
      ),
    );
    assert.deepEqual(failures, []);
    assert.ok(times[Math.floor(times.length * 0.95)] < 50);
  }
  const result = {
    size: n,
    cases: count,
    failures,
    total,
    attemptHistogram: histogram,
    meanAttempts: total.attempts / count,
    maxAttempts: Math.max(...attempts),
    verificationRejected:
      total.verificationAttempts - (count - failures.length),
    p95Ms: times[Math.floor(times.length * 0.95)],
    maxMs: times.at(-1),
    cold,
  };
  console.log(JSON.stringify(result));
  results.push(result);
}
fs.writeFileSync(
  baseline
    ? "/tmp/murdoku-generation-cost-before.json"
    : "/tmp/murdoku-generation-cost-after.json",
  JSON.stringify(results, null, 2),
);
console.log(
  baseline
    ? "MEASURED baseline retry paths."
    : "PASS: no exhaustion, bounded retries, interactive p95; objectNoSingle explicitly measures placeObjects rejecting absent singleton/non-last-row anchor.",
);
