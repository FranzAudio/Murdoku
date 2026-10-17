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
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator("#language").inputValue(), "en");
    assert.deepEqual(await page.locator("#language option").allTextContents(), [
      "English",
      "Español",
      "Català",
      "Italiano",
    ]);
    assert.equal(await page.locator("#new span").textContent(), "New Case");
    const state = () =>
      page.evaluate(() =>
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
          selected,
          marking,
          size,
          view,
          filter,
          located,
          pendingSize,
          resolved: [...resolved],
          hintResult,
          hintDismissed,
          feedbackState,
          victorySummary,
        }),
      );
    const change = (code) => page.locator("#language").selectOption(code);
    const modalChange = (code) =>
      page.evaluate((code) => {
        document.querySelector("#language").value = code;
        document.querySelector("#language").dispatchEvent(new Event("change"));
      }, code);
    await page.locator('[data-size="7"]').click();
    await page.waitForFunction(() => game?.size === 7 && !loading);
    const solution = await page.evaluate(() => game.puzzle.solution);
    await page.locator(`[data-cell="${solution[0]}"]`).focus();
    await page.keyboard.press("1");
    const mark = await page.evaluate(() =>
      Array.from({ length: size * size }, (_, i) => i).find(
        (i) => !game.puzzle.solution.includes(i),
      ),
    );
    await page.locator(`[data-cell="${mark}"]`).focus();
    await page.keyboard.press("x");
    await page.locator(".clue").first().click();
    await page.locator("#hint").click();
    await page.locator("#check").click();
    await page.locator("#mark").click();
    await page.evaluate(() => {
      window.savedCase = game;
      window.savedPuzzle = game.puzzle;
      window.savedHistory = game.history;
      window.savedProof = game.hintProof;
    });
    const original = await state();
    for (const code of ["es", "ca", "it", "en", "es", "ca"]) {
      await change(code);
      assert.equal(
        await state(),
        original,
        "mid-case state must be byte-for-byte identical",
      );
      assert.ok(
        await page.evaluate(
          () =>
            game === savedCase &&
            game.puzzle === savedPuzzle &&
            game.history === savedHistory &&
            game.hintProof === savedProof,
        ),
      );
      assert.equal(await page.locator("html").getAttribute("lang"), code);
      assert.equal(
        await page.locator("#language").getAttribute("aria-label"),
        await page.evaluate(() => s().language),
      );
      assert.equal(
        await page.locator("#check span").textContent(),
        await page.evaluate(() => s().check),
      );
      assert.equal(
        await page.locator("#feedback").textContent(),
        await page.evaluate(() =>
          format(s().checkResult, feedbackState.values),
        ),
      );
      assert.match(
        await page.locator("#hint-step").textContent(),
        code === "ca"
          ? /Pas /
          : code === "es"
            ? /Paso /
            : code === "it"
              ? /Passo /
              : /Step /,
      );
      assert.ok(
        !/\b(?:undefined|null)\b|\{\w+\}/.test(
          await page.locator("body").innerText(),
        ),
      );
    }
    // Every clue family, object relation and hint consequence is formatted by the
    // real app renderer over generated cases; no independent translation mock.
    for (const code of ["es", "ca"]) {
      await change(code);
      const coverage = await page.evaluate(() => {
        const previousGame = game,
          previousSize = size,
          types = new Set();
        try {
          for (const n of [5, 6, 7])
            for (let seed = 0; seed < 20; seed++) {
              const p = MurdokuEngine.generate(seed, 100, n);
              game = { puzzle: p };
              size = n;
              for (const clue of p.clues) {
                const text = clueText(clue);
                if (
                  !text ||
                  /\b(?:undefined|null)\b|\{\w+\}|el\/la|sentado\/a|assegut\/da|dret\/a/.test(
                    text,
                  )
                )
                  throw Error(text);
                types.add(
                  clue.type === "object"
                    ? "object." + clue.relation
                    : clue.type,
                );
                if (clue.a !== undefined && !text.includes(s().names[clue.a]))
                  throw Error("person parameter");
                if (
                  clue.type === "object" &&
                  !text.includes(
                    s().objectNames[
                      p.objects.find((o) => o.id === clue.object).type
                    ],
                  )
                )
                  throw Error("object parameter");
              }
              const proof = MurdokuEngine.propagate(p);
              for (let i = 0; i < proof.trace.length; i++) {
                const text = hintText({
                  status: "step",
                  step: proof.trace[i],
                  index: i,
                  total: proof.trace.length,
                });
                if (!text || /\b(?:undefined|null)\b|\{\w+\}/.test(text))
                  throw Error(text);
              }
            }
          return [...types].sort();
        } finally {
          game = previousGame;
          size = previousSize;
        }
      });
      assert.equal(coverage.length, 11);
      assert.equal(await state(), original);
    }
    // Nested English fallback is visible in real controls, character/room labels,
    // and a missing procedural object template, with no state change.
    await change("es");
    await page.evaluate(() => {
      window.savedSpanish = JSON.parse(JSON.stringify(MurdokuStrings.es));
      delete MurdokuStrings.es.new;
      delete MurdokuStrings.es.objectClues.only_person;
      MurdokuStrings.es.names[2] = null;
      MurdokuStrings.es.roomNames[0] = "";
      delete MurdokuStrings.es.sizeOptions[7];
      render();
    });
    assert.equal(await page.locator("#new span").textContent(), "New Case");
    assert.equal(
      await page
        .locator(".person")
        .nth(2)
        .locator(".person-name")
        .textContent(),
      "Colonel Vance",
    );
    assert.match(
      await page.locator('[data-size="7"]').getAttribute("title"),
      /Expert/,
    );
    assert.ok(
      await page.evaluate(() =>
        clueText(
          game.puzzle.clues.find(
            (c) => c.type === "object" && c.relation === "only_person",
          ),
        ).includes("is the only person"),
      ),
    );
    assert.ok(
      !/\b(?:undefined|null)\b|\{\w+\}/.test(
        await page.locator("body").innerText(),
      ),
    );
    assert.equal(await state(), original);
    await page.evaluate(() => {
      MurdokuStrings.es = window.savedSpanish;
      render();
    });
    // Solved modal text changes in place, without recomputing its captured time or
    // altering case/history/hint state. Programmatic changes model modal-safe i18n.
    if ((await page.locator("#mark").getAttribute("aria-pressed")) === "true")
      await page.locator("#mark").click();
    for (let person = 1; person < 7; person++) {
      await page.locator(`[data-cell="${solution[person]}"]`).focus();
      await page.keyboard.press(String(person + 1));
    }
    await page.locator("#check").click();
    const solved = await state();
    for (const code of ["ca", "es", "it", "en"]) {
      await modalChange(code);
      assert.equal(await state(), solved);
      assert.equal(
        await page.locator("#modal-title").textContent(),
        await page.evaluate(() => s().solved),
      );
      assert.ok(
        !/\b(?:undefined|null)\b|\{\w+\}/.test(
          await page.locator("#modal-body").textContent(),
        ),
      );
      assert.match(
        await page.locator("#modal-detail").textContent(),
        /\d\d:\d\d/,
      );
    }
    await page.locator("#modal-close").click();
    await page.locator('[data-size="5"]').click();
    const pending = await state();
    await modalChange("ca");
    assert.equal(await state(), pending);
    assert.equal(
      await page.locator("#modal-body").textContent(),
      await page.evaluate(() => s().sizeConfirm),
    );
    await page.locator("#modal-close").click();
    await page.evaluate(() => {
      newCase();
      document.querySelector("#language").value = "es";
      document.querySelector("#language").dispatchEvent(new Event("change"));
    });
    assert.match(await page.locator("#modal-title").textContent(), /muebles/);
    await page.waitForFunction(
      () => game && !loading && !document.querySelector("#modal").open,
    );
    await page.evaluate(() => {
      window.savedGenerate = MurdokuEngine.generate;
      MurdokuEngine.generate = () => {
        throw Error("expected test failure");
      };
    });
    await page.locator("#new").click();
    await page.waitForFunction(() => !loading);
    const failed = await state();
    await modalChange("ca");
    assert.equal(await state(), failed);
    assert.match(await page.locator("#modal-title").textContent(), /cas vàlid/);
    await page.evaluate(() => (MurdokuEngine.generate = window.savedGenerate));
    await page.locator("#modal-primary").click();
    await page.waitForFunction(
      () => game && !loading && !document.querySelector("#modal").open,
    );
    for (const n of [5, 6, 7]) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      if (n !== (await page.evaluate(() => size))) {
        await page.locator(`[data-size="${n}"]`).click();
        await page.waitForFunction((n) => game?.size === n && !loading, n);
      }
      for (const code of ["es", "ca"]) {
        await change(code);
        for (const width of [1440, 800, 390, 360]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          assert.ok(
            (await page.locator("#language").boundingBox()).height >= 44,
          );
          if (n === 7 && (width === 390 || width === 1440)) {
            await page.evaluate(async () => {
              scrollTo(0, 0);
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
            });
            assert.equal(await page.locator("header").count(), 1);
            await page.screenshot({
              path: `/tmp/murdoku-${code}-${n}-${width}.png`,
              fullPage: true,
            });
          }
        }
      }
    }
    const offline = await browser.newPage();
    await offline.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await offline.goto(
      require("node:url").pathToFileURL(
        require("node:path").resolve(__dirname, "index.html"),
      ).href,
    );
    assert.equal(await offline.locator("html").getAttribute("lang"), "en");
    await offline.locator("#language").selectOption("ca");
    await offline.locator("#start").click();
    await offline.waitForFunction(() => game && !loading);
    assert.equal(await offline.locator("#new span").textContent(), "Nou cas");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: English cold default/order, all ES/CA generated clue/hint templates and parameters, nested English fallback, exact mid-case references/state preservation, check feedback/hints/modals/loading/error translation, four locales, 5/6/7 responsive views, 44px selector and file:// offline.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
