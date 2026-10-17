const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : {}),
  });
  const measurements = [];
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.TEST_URL || "http://localhost:8000");
    const iconSizes = {
        1440: [64, 58, 50],
        800: [58, 50, 44],
        390: [42, 36, 30],
        360: [42, 36, 30],
      },
      badgeSizes = {
        1440: [32, 28, 24],
        800: [28, 24, 22],
        390: [22, 18, 16],
        360: [22, 18, 16],
      },
      portraitSizes = {
        1440: [72, 64, 54],
        800: [64, 56, 50],
        390: [48, 42, 36],
        360: [48, 42, 36],
      },
      sealSizes = {
        1440: [24, 22, 20],
        800: [22, 20, 18],
        390: [18, 16, 14],
        360: [18, 16, 14],
      };
    for (const n of [5, 6, 7]) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.locator(`[data-size="${n}"]`).click();
      await page.waitForFunction((n) => game?.size === n && !loading, n);
      const objects = await page.evaluate(() => game.puzzle.objects);
      assert.equal(objects.length, n - 1);
      assert.equal(new Set(objects.map((o) => o.type)).size, n - 1);
      const first = objects[0],
        cell = () => page.locator(`[data-cell="${first.cell}"]`);
      for (const width of [1440, 800, 390, 360]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.waitForFunction(() =>
          [...document.images].every((i) => i.complete && i.naturalWidth > 0),
        );
        const empty = await page
          .locator(".cell[data-object] > .furniture-icon")
          .evaluateAll((imgs) =>
            imgs.map((img) => {
              const i = img.getBoundingClientRect(),
                c = img.parentElement.getBoundingClientRect();
              return {
                width: i.width,
                height: i.height,
                cellWidth: c.width,
                cellHeight: c.height,
                natural: img.naturalWidth,
                inside:
                  i.left >= c.left &&
                  i.right <= c.right &&
                  i.top >= c.top &&
                  i.bottom <= c.bottom,
              };
            }),
          );
        for (const m of empty) {
          assert.equal(m.width, iconSizes[width][n - 5]);
          assert.equal(m.height, m.width);
          assert.ok(m.width <= m.natural);
          assert.ok(m.inside);
          assert.ok(
            m.width / m.cellWidth <= 0.7,
            `${n}/${width}: icon fraction ${m.width / m.cellWidth}`,
          );
        }
        await page.evaluate(async () => {
          scrollTo(0, 0);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        });
        await page.screenshot({
          path: `/tmp/murdoku-furniture009-${n}-${width}-empty.png`,
          fullPage: true,
        });
        // A complete row/column permutation with the victim on a fixture exercises
        // dense occupied visuals without introducing incidental row/column conflicts.
        const placements = await page.evaluate((target) => {
          const p = [...game.puzzle.solution],
            r = MurdokuEngine.row,
            c = MurdokuEngine.col;
          const ar = r(p[0], size),
            br = r(target, size);
          for (let i = 0; i < p.length; i++) {
            const row = r(p[i], size);
            if (row === ar) p[i] = br * size + c(p[i], size);
            else if (row === br) p[i] = ar * size + c(p[i], size);
          }
          const ac = c(p[0], size),
            bc = c(target, size);
          for (let i = 0; i < p.length; i++) {
            const col = c(p[i], size);
            if (col === ac) p[i] = r(p[i], size) * size + bc;
            else if (col === bc) p[i] = r(p[i], size) * size + ac;
          }
          return p;
        }, first.cell);
        for (let person = 0; person < n; person++) {
          await page.locator(`[data-cell="${placements[person]}"]`).focus();
          await page.keyboard.press(String(person + 1));
        }
        const occupied = await cell().evaluate((el) => {
          const rect = (e) => {
              const r = e.getBoundingClientRect();
              return {
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              };
            },
            c = rect(el),
            b = rect(el.querySelector(".furniture-badge")),
            s = rect(el.querySelector(".seal")),
            p = rect(el.querySelector(".portrait")),
            l = rect(el.querySelector(".cell-name"));
          return { cell: c, badge: b, seal: s, portrait: p, label: l };
        });
        const { cell: c, badge: b, seal: s, portrait: p, label: l } = occupied;
        assert.equal(b.width, badgeSizes[width][n - 5]);
        assert.equal(b.height, b.width);
        assert.equal(s.width, sealSizes[width][n - 5]);
        assert.ok(p.width <= portraitSizes[width][n - 5]);
        for (const el of [b, s, p])
          assert.ok(
            el.left >= c.left &&
              el.right <= c.right &&
              el.top >= c.top &&
              el.bottom <= c.bottom,
            "fixture/portrait/seal inside cell",
          );
        assert.ok(
          s.right <= b.left || s.bottom <= b.top,
          "seal/badge non-overlap",
        );
        assert.ok(b.bottom <= l.top + 0.1, "badge above character label");
        assert.equal(await page.locator(".cell.conflict").count(), 0);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.evaluate(async () => {
          scrollTo(0, 0);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        });
        await page.screenshot({
          path: `/tmp/murdoku-furniture009-${n}-${width}-occupied.png`,
          fullPage: true,
        });
        measurements.push({
          size: n,
          viewport: width,
          empty: empty[0],
          badge: b.width,
          seal: s.width,
          portrait: p.width,
          sealBadgeHorizontalGap: b.left - s.right,
          sealBadgeVerticalGap: b.top - s.bottom,
          labelClearance: l.top - b.bottom,
        });
        // Existing conflict/hint precedence stays red, fixtures remain in the stack.
        await cell().evaluate((el) =>
          el.classList.add("hint-highlight", "conflict"),
        );
        assert.equal(
          await cell().evaluate((el) => getComputedStyle(el).outlineColor),
          "rgb(220, 38, 38)",
        );
        await page.locator("#reset").click();
        await page.locator("#confirm-reset").click();
        await cell().focus();
        await page.keyboard.press("x");
        assert.equal(await cell().locator(".furniture-icon").count(), 1);
        assert.equal(
          await cell()
            .locator(".x-mark")
            .evaluate((e) => getComputedStyle(e).opacity),
          "0.85",
        );
        await page.locator("#undo").click();
      }
      await page.setViewportSize({ width: 1440, height: 1100 });
      for (const code of ["en", "it", "es", "ca"]) {
        await page.locator("#language").selectOption(code);
        const rows = await page.evaluate(() =>
          game.puzzle.objects.map((o) => ({
            object: s().objectNames[o.type],
            room: s().roomNames[game.puzzle.rooms[o.cell]],
            coord: coord(o.cell),
          })),
        );
        const text = await page
          .locator("#furniture-legend .furniture-legend-item")
          .allTextContents();
        assert.deepEqual(
          text,
          rows.map((o) => `${o.object} · ${o.room} (${o.coord})`),
        );
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "/tmp/murdoku-furniture009-measurements.json",
      JSON.stringify(measurements, null, 2),
    );
    console.log(
      "PASS: exact 4/5/6 density, unique types, empty icon/badge/portrait/seal sizes, <=70% cell and native64px ceiling, no clipping/seal-label overlap, conflict/hint/X layering, four-language room/coordinate legends; all 5/6/7 at 1440/800/390/360, 24 screenshots and rendered measurements.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
