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
    const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
    await p.goto(process.env.TEST_URL || "http://localhost:8000");
    await p.evaluate(() => {
      window.originalGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = (seed, attempts, n) =>
        originalGenerate(0, attempts, n);
    });
    await p.locator("#start").click();
    await p.waitForFunction(
      () => document.querySelector(".room-walls")?.dataset.synced === "true",
    );
    // Isolate the texture plane for pixel comparison. This test-only style removes
    // shadows/guidelines/sprites, never changes the shipped artwork or room shapes.
    await p.addStyleTag({
      content:
        ".cell{box-shadow:none!important;border-color:transparent!important;outline:none!important}.cell::before,.cell::after{display:none!important}.cell>*{visibility:hidden!important}.room-walls{visibility:hidden!important}",
    });
    const setup = await p.evaluate(async () => {
      const cells = [...document.querySelectorAll(".cell")],
        rects = cells.map((c) => c.getBoundingClientRect()),
        origin = rects[0],
        last = rects.at(-1),
        rooms = game.puzzle.rooms,
        notched = new Set(
          MurdokuEngine.roomGeometry(rooms, size)
            .rooms.filter((r) => r.fill < 1)
            .map((r) => r.id),
        ),
        pairs = [];
      for (let i = 0; i < cells.length; i++)
        for (const [other, vertical] of [
          [i % size < size - 1 ? i + 1 : -1, true],
          [i + size < cells.length ? i + size : -1, false],
        ])
          if (other >= 0 && rooms[i] === rooms[other] && notched.has(rooms[i]))
            pairs.push({ i, other, vertical });
      // Deliberately vary a perpendicular border to exercise the padding-box trap
      // on an actual notch seam. Border-box must ignore that inset entirely.
      const pair = pairs[0];
      cells[pair.i].style[
        pair.vertical ? "borderTopWidth" : "borderLeftWidth"
      ] = "3px";
      scheduleBoardGeometry();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return {
        origin: { x: origin.x, y: origin.y },
        width: last.right - origin.left,
        height: last.bottom - origin.top,
        pairs,
        rects: rects.map((r) => r.toJSON()),
      };
    });
    assert.ok(setup.pairs.length > 0);
    const clip = {
      x: Math.floor(setup.origin.x),
      y: Math.floor(setup.origin.y),
      width:
        Math.ceil(setup.origin.x + setup.width) - Math.floor(setup.origin.x),
      height:
        Math.ceil(setup.origin.y + setup.height) - Math.floor(setup.origin.y),
    };
    async function compare(texture, negative = false) {
      await p.evaluate(
        async ({ texture, negative }) => {
          const url = `assets/rooms/${texture}.png?v=${MurdokuApp.buildId}`,
            img = new Image();
          img.src = url;
          await img.decode();
          for (const c of document.querySelectorAll(".cell")) {
            c.style.backgroundImage = `url(${url})`;
            c.style.backgroundOrigin = negative ? "padding-box" : "border-box";
          }
        },
        { texture, negative },
      );
      const actual = await p.screenshot({ clip });
      fs.writeFileSync(
        `/tmp/room-pixel-${texture}-${negative ? "negative" : "actual"}.png`,
        actual,
      );
      await p.evaluate(
        ({ setup, texture }) => {
          const div = document.createElement("div");
          div.id = "pixel-reference";
          Object.assign(div.style, {
            position: "absolute",
            left: setup.origin.x + "px",
            top: setup.origin.y + "px",
            width: setup.width + "px",
            height: setup.height + "px",
            zIndex: "99999",
            backgroundColor: "#1a1e27",
            backgroundImage: `url(assets/rooms/${texture}.png?v=${MurdokuApp.buildId})`,
            backgroundSize: "100px",
            backgroundRepeat: "repeat",
            backgroundOrigin: "border-box",
            backgroundPosition: "0px 0px",
          });
          document.body.append(div);
        },
        { setup, texture },
      );
      const reference = await p.screenshot({ clip });
      fs.writeFileSync(`/tmp/room-pixel-${texture}-reference.png`, reference);
      await p.locator("#pixel-reference").evaluate((e) => e.remove());
      return await p.evaluate(
        async ({ actual, reference, setup, clip }) => {
          async function pixels(base64) {
            const img = new Image();
            img.src = "data:image/png;base64," + base64;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            return {
              data: ctx.getImageData(0, 0, c.width, c.height).data,
              width: c.width,
            };
          }
          const a = await pixels(actual),
            b = await pixels(reference),
            diffs = [];
          for (const pair of setup.pairs) {
            const r = setup.rects[pair.i],
              other = setup.rects[pair.other];
            if (pair.vertical) {
              const x = Math.round(r.right - clip.x);
              for (
                let y = Math.ceil(r.top - clip.y) + 6;
                y < Math.floor(r.bottom - clip.y) - 6;
                y++
              )
                for (let dx = -4; dx <= 4; dx++) {
                  if (Math.abs(dx) <= 2) continue;
                  const offset = (y * a.width + x + dx) * 4;
                  for (let k = 0; k < 3; k++)
                    diffs.push(
                      Math.abs(a.data[offset + k] - b.data[offset + k]),
                    );
                }
            } else {
              const y = Math.round(r.bottom - clip.y);
              for (
                let x = Math.ceil(r.left - clip.x) + 6;
                x < Math.floor(r.right - clip.x) - 6;
                x++
              )
                for (let dy = -4; dy <= 4; dy++) {
                  if (Math.abs(dy) <= 2) continue;
                  const offset = ((y + dy) * a.width + x) * 4;
                  for (let k = 0; k < 3; k++)
                    diffs.push(
                      Math.abs(a.data[offset + k] - b.data[offset + k]),
                    );
                }
            }
          }
          diffs.sort((a, b) => a - b);
          return {
            samples: diffs.length,
            max: diffs.at(-1),
            p99: diffs[Math.floor(diffs.length * 0.99)],
            mean: diffs.reduce((a, b) => a + b) / diffs.length,
            above3: diffs.filter((x) => x > 3).length / diffs.length,
          };
        },
        {
          actual: actual.toString("base64"),
          reference: reference.toString("base64"),
          setup,
          clip,
        },
      );
    }
    const results = [];
    for (const texture of [
      "library",
      "dining",
      "conservatory",
      "lounge",
      "billiards",
      "ballroom",
      "kitchen",
      "cellar",
    ]) {
      const result = await compare(texture);
      results.push({ texture, ...result });
      console.log(texture, result);
      if (!process.argv.includes("--diagnostic"))
        assert.ok(
          result.p99 <= 3 && result.mean <= 1,
          "rendered cell seams must match continuous reference within raster noise: " +
            texture,
        );
    }
    const negative = await compare("lounge", true);
    console.log("negative padding-box control", negative);
    assert.ok(
      negative.mean > 2 && negative.above3 > 0.1,
      "test must detect the padding-origin phase kink",
    );
    fs.writeFileSync(
      "/tmp/murdoku-room-pixels.json",
      JSON.stringify({ results, negative, pairs: setup.pairs }, null, 2),
    );
    console.log(
      (process.argv.includes("--diagnostic") ? "MEASURED: " : "PASS: ") +
        "actual screenshot pixels across notched-room seams match one continuous100px reference for all8textures; deliberately different perpendicular border, negative padding-origin control detects discontinuity. Intrinsic100px asset repeat seams are preserved in both images.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
