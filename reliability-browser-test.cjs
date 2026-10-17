const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const R = require("./reliability.js"),
  url = process.env.TEST_URL || "http://localhost:8000";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : {}),
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(url);
    const ids = await page.evaluate(() => [
      MurdokuEngine.buildId,
      MurdokuGame.buildId,
      MurdokuI18n.buildId,
      MurdokuApp.buildId,
      MurdokuReliability.buildId,
    ]);
    assert.ok(ids.every((id) => id === "1.1.1"));
    assert.equal(await page.locator("#build-id").textContent(), "1.1.1");
    for (const value of await page
      .locator("script[src],link[href],img[src]")
      .evaluateAll((nodes) => nodes.map((n) => n.src || n.href)))
      assert.equal(new URL(value).searchParams.get("v"), "1.1.1", value);
    await page.locator("#start").click();
    await page.waitForFunction(() => game && !loading);
    for (const code of ["en", "it", "es", "ca"]) {
      await page.locator("#language").focus();
      await page.locator("#language").selectOption(code);
      assert.notEqual(
        await page.locator("#feedback").textContent(),
        R.notice(code, {}, []),
      );
    }
    await page.screenshot({
      path: "/tmp/murdoku-build-complete-ca.png",
      fullPage: true,
    });
    assert.ok(
      requests
        .filter((r) => !r.endsWith("/"))
        .every((r) => new URL(r).searchParams.get("v") === "1.1.1"),
      requests.join("\n"),
    );
    // A single missing template is handled by English fallback, not a stale warning.
    await page.evaluate(() => {
      delete MurdokuStrings.ca.objectClues.only_person;
      render();
    });
    assert.ok(
      !(await page.locator("#feedback").textContent()).includes("Cmd+Shift+R"),
    );
    // Simulate a mismatched engine, independently of dictionaries. Focus and gameplay stay usable.
    await page.evaluate(() => {
      MurdokuEngine.buildId = "old";
      render();
    });
    for (const code of ["en", "it", "es", "ca"]) {
      await page.locator("#language").focus();
      await page.locator("#language").selectOption(code);
      assert.equal(
        await page.locator("#feedback").textContent(),
        R.notice(code, {}, []),
      );
      assert.equal(
        await page
          .locator("#language")
          .evaluate((n) => n === document.activeElement),
        true,
      );
    }
    await page.reload();
    await page.locator("#language").selectOption("ca");
    assert.ok(
      !(await page.locator("#feedback").textContent()).includes("Cmd+Shift+R"),
    );
    await page.close();
    // Exact pre-1.1 production strings table from 490ddad281df4ec58813a5c6c8073c160843d519:
    // raw window.MurdokuStrings={it,en}; no I18n API, ES/CA, object/size/hint keys or build id.
    const stale = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    stale.on("pageerror", (e) => errors.push(e.message));
    let intercepted = 0;
    await stale.route("**/strings.js*", async (route) => {
      intercepted++;
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: fs.readFileSync(
          path.join(__dirname, "test-fixtures/pre-1.1-strings.js"),
          "utf8",
        ),
      });
    });
    await stale.goto(url);
    assert.equal(intercepted, 1);
    assert.deepEqual(
      await stale.evaluate(() =>
        ["es", "ca"].map((code) => MurdokuI18n.has(code)),
      ),
      [false, false],
    );
    await stale.locator("#start").click();
    await stale.waitForFunction(() => game && !loading);
    await stale.locator(".cell").first().click();
    await stale.locator("#hint").click();
    const snapshot = () =>
      stale.evaluate(() =>
        JSON.stringify({
          puzzle: game.puzzle,
          positions: game.positions,
          marks: game.marks,
          history: game.history,
          moves: game.moves,
          started: game.started,
          hintCursor: game.hintCursor,
          hintProof: game.hintProof,
          currentHint: game.currentHint,
        }),
      );
    const before = await snapshot();
    for (const code of ["es", "ca", "en", "it", "es", "ca"]) {
      await stale.locator("#language").focus();
      await stale.locator("#language").selectOption(code);
      assert.equal(await snapshot(), before);
      assert.equal(
        await stale.locator("#feedback").textContent(),
        R.notice(code, {}, []),
      );
      assert.equal(
        await stale
          .locator("#language")
          .evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal(
        await stale.locator("#modal").evaluate((n) => n.open),
        false,
      );
      if (["es", "ca"].includes(code))
        await stale.screenshot({
          path: `/tmp/murdoku-stale-${code}.png`,
          fullPage: true,
        });
    }
    await stale.locator("#check").click();
    assert.equal(
      await stale.locator("#feedback").textContent(),
      R.notice("ca", {}, []),
    );
    await stale.locator("#undo").click();
    assert.equal(await stale.locator(".person.placed").count(), 0);
    assert.equal(
      await stale.locator("#feedback").textContent(),
      R.notice("ca", {}, []),
    );
    for (const width of [1440, 800, 390]) {
      await stale.setViewportSize({ width, height: 1000 });
      assert.ok(
        await stale.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await stale.setViewportSize({ width: 1440, height: 1000 });
    for (const n of [5, 7, 6]) {
      await stale.locator(`[data-size="${n}"]`).click();
      await stale.waitForFunction((n) => game?.size === n && !loading, n);
      assert.equal(await stale.locator(".cell").count(), n * n);
      assert.equal(
        await stale.locator("#feedback").textContent(),
        R.notice("ca", {}, []),
      );
    }
    assert.deepEqual(errors, []);
    const offline = await browser.newPage();
    await offline.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await offline.goto(
      require("node:url").pathToFileURL(path.join(__dirname, "index.html"))
        .href,
    );
    await offline.locator("#language").selectOption("es");
    await offline.locator("#start").click();
    await offline.waitForFunction(() => game && !loading);
    assert.equal(
      await offline.locator("#new span").textContent(),
      "Nuevo caso",
    );
    assert.equal(await offline.locator("#build-id").textContent(), "1.1.1");
    console.log(
      "PASS: version queries for every asset, matching IDs/footer, exact historical strings interception, four-locale notice, play/undo/check/hints/focus/state preserved, mismatch/reload and missing-template guards, responsive and versioned file://.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
