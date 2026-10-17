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
      errors = [],
      failed = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(r.url());
    });
    page.on("request", (r) => requests.push(r.url()));
    const url = process.env.TEST_URL || "http://localhost:8000";
    await page.goto(url);
    await page.locator("#language").selectOption("it");
    assert.equal(
      await page.locator(".cell[data-object]").count(),
      0,
      "no fixtures before generation",
    );
    for (const n of [5, 6, 7]) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.locator(`[data-size="${n}"]`).click();
      if (await page.evaluate(() => modalKind === "size"))
        await page.locator("#modal-primary").click();
      await page.waitForFunction((n) => game?.size === n && !loading, n);
      await page.waitForFunction(() =>
        [...document.images].every((i) => i.complete && i.naturalWidth > 0),
      );
      const objects = await page.evaluate(() => game.puzzle.objects),
        serialized = JSON.stringify(objects);
      assert.equal(
        await page.locator(".cell[data-object]").count(),
        objects.length,
      );
      assert.equal(
        await page.locator("#furniture-legend .furniture-legend-item").count(),
        objects.length,
      );
      const fixture = objects[0],
        cell = () => page.locator(`[data-cell="${fixture.cell}"]`);
      for (const width of [1440, 800, 390, 360]) {
        await page.setViewportSize({ width, height: 1100 });
        await cell().focus();
        await page.keyboard.press("x");
        assert.equal(await cell().locator(".furniture-icon").count(), 1);
        assert.equal(await cell().locator(".x-mark").count(), 1);
        assert.equal(
          await cell()
            .locator(".x-mark")
            .evaluate((el) => getComputedStyle(el).opacity),
          "0.85",
        );
        await page.locator("#undo").click();
        await cell().focus();
        await page.keyboard.press("1");
        assert.equal(await cell().locator(".portrait").count(), 1);
        assert.equal(await cell().locator(".furniture-badge").count(), 1);
        assert.equal(await cell().locator(".seal").count(), 1);
        assert.ok(
          await cell().evaluate((el) => {
            const a = el.querySelector(".seal").getBoundingClientRect(),
              b = el.querySelector(".furniture-badge").getBoundingClientRect();
            return a.right <= b.left || a.bottom <= b.top;
          }),
          "victim seal and furniture badge must not overlap",
        );
        const label = await cell().getAttribute("aria-label");
        assert.match(label, /Lord Reginald/);
        assert.match(label, /Vittima|Victim/);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `/tmp/murdoku-objects-${n}-${width}.png`,
          fullPage: true,
        });
        await page.locator("#undo").click();
        assert.equal(await cell().locator(".furniture-badge").count(), 0);
        assert.equal(await cell().locator(".furniture-icon").count(), 1);
        assert.equal(
          await page.evaluate(() => JSON.stringify(game.puzzle.objects)),
          serialized,
        );
      }
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.locator('[data-filter="object"]').click();
      assert.equal(await page.locator(".clue").count(), 5);
      assert.equal(await page.locator(".clue .clue-object").count(), 5);
      assert.match(
        await page.locator(".clue-category").textContent(),
        /Oggetti|Furniture/,
      );
      await page.locator(".clue").first().click();
      assert.equal(
        await page.locator(".clue").first().getAttribute("aria-pressed"),
        "true",
      );
      await page.locator(".clue").first().click();
      await page.locator("#language").selectOption("en");
      assert.equal(
        await page.locator('[data-filter="object"]').textContent(),
        "Objects",
      );
      assert.equal(
        await page.locator(".clue-category").textContent(),
        "Furniture & Objects",
      );
      assert.ok(
        !(await page.locator("#clues").textContent()).includes("undefined"),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#clues-tab").click();
      assert.equal(
        await page.locator('[data-filter="object"]').isVisible(),
        true,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `/tmp/murdoku-object-clues-${n}.png`,
        fullPage: true,
      });
      await page.locator("#board-tab").click();
      await page.setViewportSize({ width: 1440, height: 1100 });
      const avoids = await page.evaluate(() =>
          game.puzzle.clues.find(
            (c) => c.type === "object" && c.relation === "avoids",
          ),
        ),
        avoided = objects.find((o) => o.id === avoids.object);
      await page.locator(`[data-cell="${avoided.cell}"]`).focus();
      await page.keyboard.press(String(avoids.a + 1));
      await page.locator("#check").click();
      assert.ok(await page.evaluate(() => game.check().clues > 0));
      await page.locator("#undo").click();
      await page.locator("#reset").click();
      await page.locator("#confirm-reset").click();
      assert.equal(
        await page.locator(".cell[data-object]").count(),
        objects.length,
      );
      assert.equal(
        await page.evaluate(() => JSON.stringify(game.puzzle.objects)),
        serialized,
      );
      // Correct completion checks the global only-person rule through the real UI.
      const solution = await page.evaluate(() => game.puzzle.solution);
      for (let person = 0; person < n; person++) {
        await page.locator(`[data-cell="${solution[person]}"]`).focus();
        await page.keyboard.press(String(person + 1));
      }
      await page.locator("#check").click();
      assert.equal(
        await page.locator("#modal-title").textContent(),
        "CASE SOLVED!",
      );
      await page.locator("#modal-close").click();
      await page.locator("#language").selectOption("it");
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    assert.ok(requests.every((r) => r.startsWith(new URL(url).origin + "/")));
    console.log(
      "PASS: furniture empty/portrait/victim/X layering at 5/6/7 and 1440/800/390/360px, no seal-badge overlap, fixed fixtures across Undo/Reset, accessible object labels, object swatches/filter/scratchpad/localisation, avoids contradictions, correct completion and local resources.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
