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
    assert.equal(
      await page.locator('[data-size="6"]').getAttribute("aria-checked"),
      "true",
    );
    assert.equal(await page.locator(".cell").count(), 36);
    async function ready(n) {
      await page.waitForFunction((n) => game?.size === n && !loading, n);
      await page.waitForFunction(() =>
        [...document.images].every((i) => i.complete && i.naturalWidth > 0),
      );
      assert.equal(await page.locator(".cell").count(), n * n);
      assert.equal(await page.locator(".person").count(), n);
      assert.equal(
        await page.locator("#board").getAttribute("aria-rowcount"),
        String(n),
      );
      assert.equal(
        await page.locator("#board").getAttribute("aria-colcount"),
        String(n),
      );
      assert.equal(
        await page.locator(`[data-size="${n}"]`).getAttribute("aria-checked"),
        "true",
      );
    }
    await page.locator('[data-size="5"]').click();
    await ready(5);
    assert.match(await page.locator("#tray-title").textContent(), /\(5\)/);
    assert.match(await page.locator("#counter").textContent(), /5 di 5/);
    await page.locator('[data-cell="24"]').focus();
    await page.keyboard.press("7");
    assert.equal(
      await page.evaluate(() => game.positions.every((x) => x < 0)),
      true,
    );
    await page.keyboard.press("5");
    assert.equal(await page.evaluate(() => game.positions[4]), 24);
    const original = await page.evaluate(() => ({
      seed: game.puzzle.seed,
      positions: [...game.positions],
      history: game.history.length,
    }));
    await page.locator('[data-size="7"]').click();
    assert.equal(await page.locator("#modal").isVisible(), true);
    await page.locator("#modal-close").click();
    assert.deepEqual(
      await page.evaluate(() => ({
        seed: game.puzzle.seed,
        positions: [...game.positions],
        history: game.history.length,
      })),
      original,
    );
    await page.locator('[data-size="7"]').click();
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => game.size), 5);
    assert.equal(await page.locator("#modal").isVisible(), false);
    await page.locator('[data-size="7"]').click();
    await page.locator("#modal-primary").click();
    await ready(7);
    assert.equal(await page.evaluate(() => game.history.length), 0);
    assert.equal(await page.evaluate(() => game.positions.length), 7);
    assert.match(
      await page.locator(".person").nth(6).getAttribute("aria-label"),
      /Mrs. Higgins/,
    );
    assert.match(
      await page.locator('[data-cell="48"]').getAttribute("aria-label"),
      /G7/,
    );
    await page.locator('[data-cell="48"]').focus();
    await page.keyboard.press("7");
    assert.equal(await page.evaluate(() => game.positions[6]), 48);
    await page.keyboard.press("8");
    assert.equal(await page.evaluate(() => game.positions.length), 7);
    await page.locator("#undo").click();
    // Complete the 7x7 case through the actual number-key handlers.
    const solution = await page.evaluate(() => game.puzzle.solution);
    for (let i = 0; i < 7; i++) {
      await page.locator(`[data-cell="${solution[i]}"]`).focus();
      await page.keyboard.press(String(i + 1));
    }
    await page.locator("#check").click();
    assert.match(
      await page.locator("#modal-title").textContent(),
      /CASO RISOLTO/,
    );
    await page.locator("#modal-close").click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/murdoku-7-desktop.png",
      fullPage: true,
    });
    await page.locator("#language").selectOption("en");
    assert.equal(
      await page.locator("#size-selector").getAttribute("aria-label"),
      "Grid Size",
    );
    assert.match(await page.locator("#instructions").textContent(), /1–7/);
    await page.setViewportSize({ width: 800, height: 1000 });
    assert.equal(await page.locator("#toggle-dossier").isVisible(), true);
    await page.locator("#toggle-dossier").click();
    assert.equal(await page.locator("#clues").isVisible(), false);
    await page.locator("#toggle-dossier").click();
    assert.equal(await page.locator("#clues").isVisible(), true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/murdoku-7-medium.png",
      fullPage: true,
    });
    for (const n of [7, 5, 6]) {
      if (n !== 7) {
        await page.locator(`[data-size="${n}"]`).click();
        if (
          (await page.locator("#modal").isVisible()) &&
          (await page.evaluate(() => modalKind === "size"))
        )
          await page.locator("#modal-primary").click();
        await ready(n);
      }
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        assert.ok(
          await page
            .locator("#board")
            .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
        );
        if (n === 7)
          assert.ok(
            await page
              .locator(".cell")
              .first()
              .evaluate((el) => el.getBoundingClientRect().width + 4 >= 48),
          );
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `/tmp/murdoku-${n}-mobile-${width}.png`,
          fullPage: true,
        });
      }
    }
    // Marks also trigger loss-of-progress protection; cancelling leaves marks untouched.
    await page.locator("#mark").click();
    await page.locator('[data-cell="0"]').click();
    await page.locator('[data-size="7"]').click();
    assert.equal(await page.evaluate(() => modalKind), "size");
    await page.locator("#modal-close").click();
    assert.deepEqual(await page.evaluate(() => game.marks), [0]);
    await page.locator('[data-size="7"]').click();
    await page.locator("#modal-primary").click();
    await ready(7);
    // Force a size-specific failure and exercise the explicit 6x6 fallback.
    await page.evaluate(() => {
      window.savedGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = () => {
        throw Error("expected test failure");
      };
    });
    await page.locator("#new").click();
    await page.waitForFunction(() => !loading);
    assert.match(await page.locator("#modal-title").textContent(), /7×7/);
    assert.equal(
      await page.locator("#modal-close").textContent(),
      "Revert to 6×6",
    );
    await page.evaluate(() => (MurdokuEngine.generate = window.savedGenerate));
    await page.locator("#modal-close").click();
    await ready(6);
    // Keyboard radio activation on a pristine board generates the next size.
    await page.locator('[data-size="6"]').focus();
    await page.keyboard.press("ArrowLeft");
    await ready(5);
    await page.locator('[data-size="5"]').focus();
    await page.keyboard.press("ArrowRight");
    await ready(6);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 5/6/7 selector, default, N-person tray, dynamic coordinates/counter/keyboard, ignored keys, confirm/cancel/Escape/mark protection, 7x7 victory, bilingual size copy, medium dossier, 360/390px layouts, size failure/fallback and keyboard radios.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
