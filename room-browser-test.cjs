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
    const p = await b.newPage({ viewport: { width: 1440, height: 1100 } }),
      errors = [],
      report = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(process.env.TEST_URL || "http://localhost:8000");
    assert.equal(await p.locator(".room-walls").count(), 0);
    assert.ok(
      await p
        .locator(".cell")
        .evaluateAll((cells) =>
          cells.every(
            (c) =>
              getComputedStyle(c).backgroundImage === "none" &&
              !c.hasAttribute("data-room"),
          ),
        ),
    );
    await p.evaluate(() => {
      window.originalGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = (seed, attempts, n) =>
        originalGenerate(0, attempts, n);
    });
    for (const n of [5, 6, 7]) {
      await p.setViewportSize({ width: 1440, height: 1100 });
      await p.locator(`[data-size="${n}"]`).click();
      if (await p.evaluate(() => modalKind === "size"))
        await p.locator("#modal-primary").click();
      await p.waitForFunction((n) => game?.size === n && !loading, n);
      const rooms = await p.evaluate(() => game.puzzle.rooms),
        shape = await p.evaluate(() =>
          MurdokuEngine.roomGeometry(game.puzzle.rooms, size).rooms.find(
            (r) => r.fill < 1,
          ),
        );
      assert.ok(shape);
      for (const width of [1440, 800, 390, 360]) {
        await p.setViewportSize({ width, height: 1100 });
        await p.evaluate(async () => {
          scrollTo(0, 0);
          scheduleBoardGeometry();
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        });
        const info = await p.evaluate(() => {
          const svg = document.querySelector(".room-walls"),
            rects = [...document.querySelectorAll(".cell")].map((c) =>
              c.getBoundingClientRect(),
            ),
            origin = rects[0];
          return {
            segments: JSON.parse(svg.dataset.segments),
            stroke: getComputedStyle(svg.firstChild).strokeWidth,
            pointer: getComputedStyle(svg).pointerEvents,
            svg: svg.getBoundingClientRect().toJSON(),
            cells: [...document.querySelectorAll(".cell")].map((c, i) => ({
              cell: i,
              walls: c.dataset.walls,
              room: Number(c.dataset.room),
              origin: getComputedStyle(c).backgroundOrigin,
              pos: getComputedStyle(c).backgroundPosition,
              style: getComputedStyle(c).borderTopStyle,
              repeat: getComputedStyle(c).backgroundRepeat,
              width: rects[i].width,
              height: rects[i].height,
              dx: rects[i].left - origin.left,
              dy: rects[i].top - origin.top,
              label: c.getAttribute("aria-label"),
            })),
          };
        });
        const expected = [];
        for (let i = 0; i < n * n; i++) {
          if (Math.floor(i / n) === 0) expected.push(i + "t");
          if (i % n === 0) expected.push(i + "l");
          if (i % n === n - 1 || rooms[i] !== rooms[i + 1])
            expected.push(i + "r");
          if (i + n >= n * n || rooms[i] !== rooms[i + n])
            expected.push(i + "b");
        }
        assert.deepEqual(
          info.segments.map((s) => s.cell + s.edge),
          expected,
        );
        assert.equal(
          new Set(
            info.segments.map((s) =>
              s.points.map((v) => v.toFixed(2)).join(","),
            ),
          ).size,
          expected.length,
        );
        assert.equal(info.stroke, width < 640 ? "2px" : "3px");
        assert.equal(info.pointer, "none");
        for (const c of info.cells) {
          assert.equal(c.origin, "border-box");
          assert.equal(c.repeat, "repeat");
          const pos = c.pos.split(" ").map(parseFloat);
          assert.ok(
            Math.abs(pos[0] + c.dx) < 0.01 && Math.abs(pos[1] + c.dy) < 0.01,
          );
          const residual = (v) =>
            Math.min(Math.abs(v) % 100, 100 - (Math.abs(v) % 100));
          assert.ok(
            residual(pos[0] + (c.cell % n) * info.cells[0].width) <= 0.5 &&
              residual(
                pos[1] + Math.floor(c.cell / n) * info.cells[0].height,
              ) <= 0.5,
            "mechanical coordinate residual<=.5px",
          );
          assert.ok(
            c.label.includes(
              await p.evaluate((room) => s().roomNames[room], c.room),
            ),
          );
        }
        const box = await p.locator("#board").boundingBox(),
          clip = {
            x: Math.floor(box.x),
            y: Math.floor(box.y),
            width: Math.ceil(box.x + box.width) - Math.floor(box.x),
            height: Math.ceil(box.y + box.height) - Math.floor(box.y),
          },
          shot = await p.screenshot({ clip });
        const pixels = await p.evaluate(
          async ({ base64, info, clip }) => {
            const img = new Image();
            img.src = "data:image/png;base64," + base64;
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, img.width, img.height).data,
              gold = (x, y) => {
                if (x < 0 || y < 0 || x >= img.width || y >= img.height)
                  return false;
                const i = (y * img.width + x) * 4;
                return (
                  Math.max(
                    Math.abs(data[i] - 212),
                    Math.abs(data[i + 1] - 175),
                    Math.abs(data[i + 2] - 55),
                  ) <= 12
                );
              };
            let vertices = 0;
            const widths = [];
            for (const {
              points: [x1, y1, x2, y2],
            } of info.segments) {
              for (const [x, y] of [
                [x1, y1],
                [x2, y2],
              ]) {
                const px = Math.floor(x + info.svg.x - clip.x),
                  py = Math.floor(y + info.svg.y - clip.y);
                if (!gold(px, py))
                  throw Error(`wall vertex gap at ${px},${py}`);
                vertices++;
              }
              const mx = Math.floor((x1 + x2) / 2 + info.svg.x - clip.x),
                my = Math.floor((y1 + y2) / 2 + info.svg.y - clip.y);
              let count = 0;
              for (let d = -5; d <= 5; d++)
                if (x1 === x2 ? gold(mx + d, my) : gold(mx, my + d)) count++;
              widths.push(count);
            }
            return {
              vertices,
              minWidth: Math.min(...widths),
              maxWidth: Math.max(...widths),
            };
          },
          { base64: shot.toString("base64"), info, clip },
        );
        assert.ok(
          pixels.minWidth >= Number.parseFloat(info.stroke) - 1 &&
            pixels.maxWidth <= Number.parseFloat(info.stroke) + 1,
          "single wall stroke, not double borders",
        );
        await p.screenshot({
          path: `/tmp/murdoku-rooms010-${n}-${width}.png`,
          fullPage: true,
        });
        report.push({
          size: n,
          viewport: width,
          shape,
          segments: expected.length,
          ...pixels,
        });
        // Real clue focus/hover/click targets every arm and preserves the game model.
        if (width < 640) await p.locator("#clues-tab").click();
        const index = await p.evaluate(
            (room) => game.puzzle.clues.findIndex((c) => c.room === room),
            shape.id,
          ),
          clue = p.locator(`[data-clue="${index}"]`),
          before = await p.evaluate(() =>
            JSON.stringify({
              positions: game.positions,
              marks: game.marks,
              history: game.history,
              moves: game.moves,
              hintCursor: game.hintCursor,
            }),
          );
        await p.locator("#new").focus();
        await clue.focus();
        assert.deepEqual(
          await p
            .locator(".cell.room-target")
            .evaluateAll((c) => c.map((x) => Number(x.dataset.cell))),
          rooms.flatMap((r, i) => (r === shape.id ? [i] : [])),
          `target ${n}/${width}`,
        );
        await clue.click();
        if (width < 640) await p.locator("#board-tab").click();
        assert.equal(await p.locator(".cell.room-target").count(), shape.area);
        assert.equal(
          await p.evaluate(() =>
            JSON.stringify({
              positions: game.positions,
              marks: game.marks,
              history: game.history,
              moves: game.moves,
              hintCursor: game.hintCursor,
            }),
          ),
          before,
        );
        await p.evaluate(() => {
          pinnedRoomTarget = null;
          targetRoom(null);
        });
      }
    }

    // External compact U/notch map with multiple reflex vertices, independent of
    // the rectangle/corner-notch catalog. Only geometry rendering is under test.
    const fixture = [..."111122011022000033400033444553444555"].map(Number);
    assert.ok(
      await p.evaluate(
        (map) => MurdokuEngine.roomGeometry(map, 6).valid,
        fixture,
      ),
    );
    await p.setViewportSize({ width: 1440, height: 1100 });
    await p.evaluate((map) => {
      size = 6;
      game = new MurdokuGame({
        ...originalGenerate(0, 100, 6),
        rooms: map,
        objects: [],
        clues: [],
      });
      activeRoomTarget = null;
      pinnedRoomTarget = null;
      render();
    }, fixture);
    await p.evaluate(async () => {
      scrollTo(0, 0);
      scheduleBoardGeometry();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    await p.screenshot({
      path: "/tmp/murdoku-rooms010-double-reflex.png",
      fullPage: true,
    });
    await p.addStyleTag({
      content:
        ".cell{background-image:none!important;background-color:#12151b!important;border-color:transparent!important;box-shadow:none!important}.cell::before,.cell::after{display:none!important}",
    });
    const corners = await p.evaluate((map) => {
      const result = [];
      for (let r = 1; r < 6; r++)
        for (let c = 1; c < 6; c++) {
          const around = [
            (r - 1) * 6 + c - 1,
            (r - 1) * 6 + c,
            r * 6 + c - 1,
            r * 6 + c,
          ];
          if (around.filter((i) => map[i] === 0).length === 3) {
            const rect = document
              .querySelector(`[data-cell="${r * 6 + c}"]`)
              .getBoundingClientRect();
            result.push({ x: rect.x, y: rect.y });
          }
        }
      return result;
    }, fixture);
    assert.ok(corners.length >= 2);
    const fbox = await p.locator("#board").boundingBox(),
      fclip = {
        x: Math.floor(fbox.x),
        y: Math.floor(fbox.y),
        width: Math.ceil(fbox.width) + 1,
        height: Math.ceil(fbox.height) + 1,
      },
      fshot = await p.screenshot({ clip: fclip });
    await p.evaluate(
      async ({ base64, corners, clip }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + base64;
        await img.decode();
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const cx = cv.getContext("2d");
        cx.drawImage(img, 0, 0);
        const pixels = cx.getImageData(0, 0, cv.width, cv.height).data,
          gold = (x, y) => {
            const i = (y * cv.width + x) * 4;
            return (
              Math.max(
                Math.abs(pixels[i] - 212),
                Math.abs(pixels[i + 1] - 175),
                Math.abs(pixels[i + 2] - 55),
              ) < 12
            );
          };
        for (const point of corners) {
          const x = Math.floor(point.x - clip.x),
            y = Math.floor(point.y - clip.y);
          if (!gold(x, y)) throw Error("reflex corner gap");
          for (const dx of [-4, 4])
            for (const dy of [-4, 4])
              if (gold(x + dx, y + dy))
                throw Error("brass bleed outside miter arms");
        }
      },
      { base64: fshot.toString("base64"), corners, clip: fclip },
    );
    report.push({
      externalNotch: true,
      reflexVertices: corners.length,
      noGaps: true,
      noBleed: true,
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "/tmp/murdoku-room-render-measurements.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      "PASS: neutral cold grid, exact single3px/2px wall ownership and opaque vertex pixels, no doubled borders, globally anchored border-box textures, L/notch whole-room clue targeting, correct names/ARIA at5/6/7 and1440/800/390/360;12 screenshots.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
