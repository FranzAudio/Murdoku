const { measureRenderedPhases } = require("./room-phase-metrics.cjs");
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
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
    await p.addStyleTag({
      content:
        ".cell{box-shadow:none!important;border-color:transparent!important;outline:none!important}.cell::before,.cell::after{display:none!important}.cell>*{visibility:hidden!important}.room-walls{visibility:hidden!important}",
    });
    await p.evaluate(() => {
      window.originalGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = (seed, attempts, n) =>
        originalGenerate(0, attempts, n);
    });
    for (const n of [5, 6, 7])
      for (const width of [1440, 390]) {
        await p.setViewportSize({ width: 1440, height: 1200 });
        if (await p.evaluate((n) => !game || size !== n, n)) {
          await p.locator(`[data-size="${n}"]`).click();
          await p.waitForFunction((n) => game?.size === n && !loading, n);
        }
        await p.setViewportSize({ width, height: 1200 });
        const setup = await p.evaluate(async () => {
          scrollTo(0, 0);
          scheduleBoardGeometry();
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          const cells = [...document.querySelectorAll(".cell")],
            rects = cells.map((c) => c.getBoundingClientRect()),
            a = rects[0],
            z = rects.at(-1),
            url = `assets/rooms/library.png?v=${MurdokuApp.buildId}`,
            img = new Image();
          img.src = url;
          await img.decode();
          for (const c of cells) c.style.backgroundImage = `url(${url})`;
          return {
            origin: { x: a.x, y: a.y },
            width: z.right - a.left,
            height: z.bottom - a.top,
            rects: rects.map((r) => r.toJSON()),
            url,
          };
        });
        const clip = {
          x: Math.floor(setup.origin.x),
          y: Math.floor(setup.origin.y),
          width:
            Math.ceil(setup.origin.x + setup.width) -
            Math.floor(setup.origin.x),
          height:
            Math.ceil(setup.origin.y + setup.height) -
            Math.floor(setup.origin.y),
        };
        const actual = await p.screenshot({ clip });
        await p.evaluate((s) => {
          const d = document.createElement("div");
          d.id = "phase-reference";
          Object.assign(d.style, {
            position: "absolute",
            left: s.origin.x + "px",
            top: s.origin.y + "px",
            width: s.width + "px",
            height: s.height + "px",
            zIndex: "99999",
            background: `#1a1e27 url(${s.url}) repeat 0 0 / 100px border-box`,
          });
          document.body.append(d);
        }, setup);
        const reference = await p.screenshot({ clip });
        await p.locator("#phase-reference").evaluate((e) => e.remove());
        const estimate = (shot) =>
          measureRenderedPhases(p, shot, reference, setup, clip);
        const noise = await estimate(reference);
        assert.equal(
          noise.maxShift,
          0,
          "reference self-comparison noise floor",
        );
        const positive = await estimate(actual);
        console.log(n, width, positive);
        assert.ok(
          positive.maxShift <= 1.5,
          `${n}/${width}: per-cell estimated phase must be within1.5px fit tolerance`,
        );
        const controls = [];
        for (const error of [3, 6]) {
          const target = n * Math.floor(n / 2);
          await p.evaluate(
            ({ target, error }) => {
              const c = document.querySelector(`[data-cell="${target}"]`);
              if (!c.dataset.originalPhase)
                c.dataset.originalPhase = c.style.backgroundPosition;
              const [x, y] = c.dataset.originalPhase.split(" ").map(parseFloat);
              c.style.backgroundPosition = `${x + error}px ${y}px`;
            },
            { target, error },
          );
          const estimateResult = await estimate(await p.screenshot({ clip }));
          const measured = Math.abs(estimateResult.phases[target]);
          controls.push({ injected: error, measured });
          assert.ok(
            Math.abs(measured - error) <= 0.5,
            `phase estimator must detect ${error}px error`,
          );
        }
        console.log("controls", controls);
        report.push({
          size: n,
          viewport: width,
          ...positive,
          controls,
          noiseFloor: noise.maxShift,
        });
        await p.evaluate(() => {
          for (const c of document.querySelectorAll(
            ".cell[data-original-phase]",
          )) {
            c.style.backgroundPosition = c.dataset.originalPhase;
            delete c.dataset.originalPhase;
          }
        });
      }
    fs.writeFileSync(
      "/tmp/murdoku-room-phase.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      (process.argv.includes("--diagnostic") ? "MEASURED: " : "PASS: ") +
        "per-cell rendered library phase fit over -6..6px in.125px steps stays within1.5px at5/6/7 and1440/390;3px/6px injected error controls detected. Raw pixel deltas recorded as context, not an equality gate.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
