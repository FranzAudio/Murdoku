const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { measureRenderedPhases } = require("./room-phase-metrics.cjs");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : {}),
  });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1200 } }),
      report = [];
    await p.goto(process.env.TEST_URL || "http://localhost:8000");
    await p.evaluate(() => {
      window.originalGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = (seed, attempts, n) =>
        originalGenerate(0, attempts, n);
    });
    await p.locator("#start").click();
    await p.waitForFunction(() => game && !loading);
    const settle = () =>
      p.evaluate(async () => {
        scrollTo(0, 0);
        scheduleBoardGeometry();
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
    const properties = () =>
      p.locator(".cell").evaluateAll((cells) =>
        cells.map((c) => {
          const s = getComputedStyle(c);
          return {
            image: s.backgroundImage,
            size: s.backgroundSize,
            position: s.backgroundPosition,
            origin: s.backgroundOrigin,
            repeat: s.backgroundRepeat,
          };
        }),
      );
    await settle();
    const baseline = await properties(),
      fixture = await p.evaluate(() => game.puzzle.objects[0].cell),
      plain = await p.evaluate(() =>
        Array.from({ length: size * size }, (_, i) => i).find(
          (i) => !game.puzzle.objects.some((o) => o.cell === i),
        ),
      );
    await p.addStyleTag({
      content:
        ".cell{background-color:#1a1e27!important;box-shadow:none!important;border-color:transparent!important;outline:none!important}.cell::before,.cell::after{display:none!important}.cell>*{visibility:hidden!important}.room-walls{visibility:hidden!important}",
    });
    const box = await p.locator("#board").boundingBox(),
      clip = {
        x: Math.floor(box.x),
        y: Math.floor(box.y),
        width: Math.ceil(box.x + box.width) - Math.floor(box.x),
        height: Math.ceil(box.y + box.height) - Math.floor(box.y),
      },
      setup = await p.evaluate(() => ({
        rects: [...document.querySelectorAll(".cell")].map((c) =>
          c.getBoundingClientRect().toJSON(),
        ),
      })),
      reference = await p.screenshot({ clip });
    async function check(name, selector) {
      await settle();
      assert.deepEqual(
        await properties(),
        baseline,
        `${name}: all texture properties remain unchanged`,
      );
      if (selector)
        assert.ok(
          (await p.locator(selector).count()) > 0,
          name + " actually active",
        );
      const current = await p.locator("#board").boundingBox(),
        currentClip = {
          x: Math.floor(current.x),
          y: Math.floor(current.y),
          width: clip.width,
          height: clip.height,
        };
      const fit = await measureRenderedPhases(
        p,
        await p.screenshot({ clip: currentClip }),
        reference,
        setup,
        clip,
      );
      if (fit.maxShift > 1.5) console.log(name, fit);
      assert.ok(fit.maxShift <= 1.5, name + " phase preserved");
      report.push({
        state: name,
        propertiesUnchanged: true,
        maxShift: fit.maxShift,
        raw: fit.raw,
      });
    }
    async function reset() {
      await p.locator("#reset").click();
      await p.locator("#confirm-reset").click();
      await settle();
    }
    async function place(cell, person) {
      await p.locator(`[data-cell="${cell}"]`).focus();
      await p.keyboard.press(String(person + 1));
    }
    await p.locator(".person").nth(1).click();
    await check("selected-suspect", '.person[aria-selected="true"]');
    await p.locator(`[data-cell="${plain}"]`).hover();
    assert.ok(
      await p
        .locator(`[data-cell="${plain}"]`)
        .evaluate((c) => c.matches(":hover")),
    );
    await check("hover");
    await p.locator('[data-cell="0"]').focus();
    await p.keyboard.press("ArrowRight");
    await check("focus-visible", ".cell:focus-visible");
    await place(plain, 1);
    await check("placed", ".cell .portrait");
    await p.locator(".person").nth(1).click();
    await check("selected-placed-suspect", ".cell.located");
    await reset();
    await place(fixture, 0);
    await check("occupied-fixture-victim", ".cell .furniture-badge");
    await reset();
    await place(0, 0);
    await place(1, 1);
    await check("row-conflict", ".cell.conflict");
    await reset();
    await p.locator(`[data-cell="${fixture}"]`).focus();
    await p.keyboard.press("x");
    await check("X-mark", ".cell .x-mark");
    await reset();
    await p.locator('[data-clue="0"]').focus();
    await check("clue-room-target", ".cell.room-target");
    await p.locator("#hint").click();
    await check("hint-halo", ".cell.hint-highlight");
    fs.writeFileSync(
      "/tmp/murdoku-room-state-matrix.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      "PASS: actual selected/hover/focus-visible/placed/located/occupied/conflict/X/clue-room/hint states preserve image,size,position,origin,repeat on every cell; isolated texture-plane phase remains within1.5px.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
