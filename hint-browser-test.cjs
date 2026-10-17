const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : {}),
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.TEST_URL || "http://localhost:8000");
    await page.locator("#language").selectOption("it");
    assert.ok(await page.locator("#hint").isDisabled());
    assert.ok(!(await page.locator("#hint-banner").isVisible()));
    const boardState = () =>
      page.evaluate(() =>
        JSON.stringify({
          positions: game.positions,
          marks: game.marks,
          history: game.history,
          moves: game.moves,
          started: game.started,
          resolved: [...resolved],
        }),
      );
    for (const n of [5, 6, 7]) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.locator(`[data-size="${n}"]`).click();
      if (await page.evaluate(() => modalKind === "size"))
        await page.locator("#modal-primary").click();
      await page.waitForFunction((n) => game?.size === n && !loading, n);
      assert.ok(!(await page.locator("#hint").isDisabled()));
      assert.equal(
        await page.locator("#hint").getAttribute("aria-keyshortcuts"),
        "h",
      );
      const pristine = await boardState();
      await page.locator("#hint").click();
      assert.equal(await page.locator("#hint-banner").isVisible(), true);
      assert.match(
        await page.locator("#hint-step").textContent(),
        /Passo 1 di/,
      );
      assert.ok((await page.locator(".cell.hint-highlight").count()) > 0);
      assert.equal(await page.locator(".clue.hint-active").count(), 1);
      assert.equal(await boardState(), pristine);
      assert.ok(
        await page
          .locator(".cell.hint-highlight")
          .first()
          .getAttribute("aria-description"),
      );
      await page.keyboard.press("h");
      assert.match(
        await page.locator("#hint-step").textContent(),
        /Passo 2 di/,
      );
      assert.equal(await boardState(), pristine);
      const second = await page.locator("#hint-text").textContent();
      await page.keyboard.press("Escape");
      assert.ok(!(await page.locator("#hint-banner").isVisible()));
      assert.equal(await page.locator(".cell.hint-highlight").count(), 0);
      await page.keyboard.press("H");
      assert.equal(await page.locator("#hint-text").textContent(), second);
      assert.match(
        await page.locator("#hint-step").textContent(),
        /Passo 2 di/,
      );
      await page.locator("#language").selectOption("en");
      assert.match(await page.locator("#hint-step").textContent(), /Step 2 of/);
      assert.ok(
        !(await page.locator("#hint-text").textContent()).includes("undefined"),
      );
      // Board/clue co-existence and exhaustive hint progression are model-tested; UI
      // adds a real singleton hint with a fixture on its highlighted cell.
      await page.evaluate(() => {
        while (
          hintResult.status === "step" &&
          (hintResult.step.after.length !== 1 ||
            !game.puzzle.objects.some(
              (o) => o.cell === hintResult.step.after[0],
            ))
        )
          showHint();
      });
      assert.equal(await page.evaluate(() => hintResult.status), "step");
      assert.equal(
        await page.locator(".cell.hint-highlight .furniture-icon").count(),
        1,
      );
      assert.equal(await boardState(), pristine);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `/tmp/murdoku-hint-${n}-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 800, height: 1000 });
      await page.locator("#toggle-dossier").click();
      assert.equal(await page.locator("#clues").isVisible(), false);
      await page.locator("#hint-clue-link").click();
      assert.equal(await page.locator("#clues").isVisible(), true);
      assert.equal(await page.locator(".clue.hint-active").count(), 1);
      assert.equal(await boardState(), pristine);
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator("#hint-clue-link").click();
        assert.equal(await page.locator("#dossier").isVisible(), true);
        assert.equal(await page.locator("#hint-return").isVisible(), true);
        assert.equal(await page.locator(".clue.hint-active").count(), 1);
        await page.locator("#hint-return").click();
        assert.equal(await page.locator("#board-panel").isVisible(), true);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `/tmp/murdoku-hint-${n}-${width}.png`,
          fullPage: true,
        });
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page
          .locator(".cell.hint-highlight")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.locator("#hint-dismiss").click();
      await page.locator(".cell").first().focus();
      await page.keyboard.press("h");
      assert.equal(await page.locator("#hint-banner").isVisible(), true);
      // Wrong placement and X guards must pause, not advance, the stepper.
      const wrong = await page.evaluate(
        () => (game.puzzle.solution[0] + 1) % (size * size),
      );
      await page.locator(`[data-cell="${wrong}"]`).focus();
      await page.keyboard.press("1");
      assert.equal(await page.locator("#hint-banner").isVisible(), false);
      const wrongBoard = await boardState();
      await page.locator("#hint").click();
      assert.match(
        await page.locator("#hint-text").textContent(),
        /contradictions/,
      );
      assert.ok((await page.locator(".cell.hint-conflict").count()) > 0);
      assert.equal(await boardState(), wrongBoard);
      assert.equal(await page.locator(".cell.hint-highlight").count(), 0);
      await page.locator("#undo").click();
      const solution = await page.evaluate(() => game.puzzle.solution);
      await page.locator(`[data-cell="${solution[0]}"]`).focus();
      await page.keyboard.press("x");
      await page.locator("#hint").click();
      assert.match(
        await page.locator("#hint-text").textContent(),
        /contradictions/,
      );
      await page.locator("#undo").click();
      await page.locator("#hint").click();
      assert.match(await page.locator("#hint-step").textContent(), /Step 1 of/);
      for (let person = 0; person < n; person++) {
        await page.locator(`[data-cell="${solution[person]}"]`).focus();
        await page.keyboard.press(String(person + 1));
      }
      const complete = await boardState();
      await page.locator("#hint").click();
      assert.match(
        await page.locator("#hint-text").textContent(),
        /already solved/,
      );
      assert.equal(await boardState(), complete);
      await page.locator("#reset").click();
      await page.locator("#confirm-reset").click();
      await page.evaluate(() => {
        for (let i = 0; i < 200; i++) showHint();
      });
      assert.match(
        await page.locator("#hint-text").textContent(),
        /No further/,
      );
      await page.locator("#language").selectOption("it");
    }
    await page.evaluate(() => {
      window.savedGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = () => {
        throw Error("expected test failure");
      };
    });
    await page.locator("#new").click();
    await page.waitForFunction(() => !loading);
    assert.equal(await page.locator("#hint").isDisabled(), true);
    await page.evaluate(() => (MurdokuEngine.generate = window.savedGenerate));
    await page.locator("#modal-primary").click();
    await page.waitForFunction(
      () => !!game && !loading && !document.querySelector("#modal").open,
    );
    assert.equal(await page.locator("#hint").isDisabled(), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: hints at all sizes; disabled/active/progression/reopen/localisation, non-mutation, clue link and collapsed/mobile navigation, furniture highlights, H/Escape, reduced motion, conflicts/X/undo/reset/solved/exhaustion; 1440/800/390/360px.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
