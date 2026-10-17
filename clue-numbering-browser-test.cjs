// story-011 regression: dossier clue numbers must read in ascending order, the hint must name
// the same number the dossier shows, and interaction must never renumber a row.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const TEST_URL = process.env.TEST_URL || "http://localhost:8000";

async function readRows(page) {
  return page.$$eval("#clues .clue", (nodes) =>
    nodes.map((node) => ({
      index: Number(node.dataset.clue),
      number: (node.querySelector(".clue-number")?.textContent || "").trim(),
      pressed: node.getAttribute("aria-pressed") === "true",
      text: (node.querySelector(".clue-text, span:last-of-type")?.textContent || "")
        .replace(/\s+/g, " ")
        .trim(),
    })),
  );
}

// Derive display positions from the puzzle, without calling the app's numbering helper.
async function expectedRows(page) {
  return page.evaluate(() => {
    const order = ["room", "direction", "beside", "touch", "object", "count"];
    const width = Math.max(2, String(game.puzzle.clues.length).length);
    return game.puzzle.clues.map((clue, index) => ({
      index, type: clue.type, text: clueText(clue).replace(/\s+/g, " ").trim(),
    })).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
      .map((row, position) => ({...row, number: String(position + 1).padStart(width, "0")}));
  });
}

async function assertIdentity(page, label) {
  const expected = await expectedRows(page);
  const actual = await readRows(page);
  assert.deepEqual(actual.map(({index, number, text}) => ({index, number, text})),
    expected.map(({index, number, text}) => ({index, number, text})),
    `${label}: AC-4 row index, number and text must match the original puzzle clue`);
}

function assertHintNumber(text, expected, label) {
  // Compare the first numeric token, not a substring (01 must not match 010).
  assert.equal(text.match(/\d+/)?.[0], expected, `${label}: AC-3 clue reference differs`);
}

async function ensureCase(page, size) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const hasGame = () =>
    page.evaluate(() => typeof game !== "undefined" && !!game && !loading);
  if (!(await hasGame())) {
    const start = page.locator("#start");
    if (await start.count()) await start.click({ force: true });
    await page.waitForFunction(
      () => typeof game !== "undefined" && !!game && !loading,
      null,
      { timeout: 25000 },
    );
  }
  const current = await page.evaluate(() => game.size);
  if (current !== size) {
    await page.locator(`[data-size="${size}"]`).click();
    if (await page.evaluate(() => typeof modalKind !== "undefined" && modalKind === "size"))
      await page.locator("#modal-primary").click();
  } else {
    await page.locator("#new").click();
  }
  await page.waitForFunction(
    (n) => typeof game !== "undefined" && game && game.size === n && !loading,
    size,
  );
  await page.waitForSelector("#clues .clue", { timeout: 20000 });
}

function assertAscending(rows, label) {
  assert.ok(rows.length > 0, `${label}: no clues rendered`);
  const width = Math.max(2, String(rows.length).length);
  rows.forEach((row, position) => {
    assert.match(row.number, /^\d+$/, `${label}: row ${position} has a non-numeric number "${row.number}"`);
    assert.equal(
      row.number.length,
      width,
      `${label}: row ${position} number "${row.number}" does not match width ${width}`,
    );
    assert.equal(
      Number(row.number),
      position + 1,
      `${label}: row ${position} prints "${row.number}", expected ${position + 1}`,
    );
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(TEST_URL);
    await page.locator("#language").selectOption("it");

    // AC-1 and AC-2: ascending, exactly 1..N, across sizes and cases.
    for (const size of [5, 6, 7]) {
      await ensureCase(page, size);
      for (let k = 0; k < 10; k += 1) {
        assertAscending(await readRows(page), `${size}x${size} case ${k}`);
        await assertIdentity(page, `${size}x${size} case ${k}`);
        await page.locator("#new").click();
        await page.waitForTimeout(80);
      }
    }
    console.log("AC-1/AC-2 ascending 1..N: PASS");

    // AC-4: the hint names the number the dossier shows for the clue it highlights.
    for (const size of [5, 6, 7]) {
      await ensureCase(page, size);
      for (const language of ["it", "en", "es", "ca"]) {
        await page.locator("#language").selectOption(language);
        await page.locator("#hint").click();
        for (let step = 0; step < 3; step += 1) {
          const active = await page.$$eval("#clues .clue.hint-active", (nodes) =>
            nodes.map((node) => Number(node.dataset.clue)),
          );
          assert.equal(active.length, 1, `${size}/${language}: expected exactly one hint-active clue`);
          const originalIndex = await page.evaluate(() => hintResult.step.clueIndices[0]);
          assert.equal(active[0], originalIndex, "AC-4 highlight must retain original clue identity");
          const expected = (await expectedRows(page)).find(row => row.index === originalIndex).number;
          const spoken = (await page.locator("#hint-clue-link").textContent()).trim();
          const explanation = (await page.locator("#hint-text").innerText()).replace(/\s+/g, " ");
          assertHintNumber(spoken, expected, `${size}/${language} link`);
          assertHintNumber(explanation, expected, `${size}/${language} explanation`);
          await assertIdentity(page, `${size}/${language} hint`);
          await page.locator("#hint-clue-link").click();
          assert.equal(await page.evaluate(() => Number(document.activeElement.dataset.clue)),
            originalIndex, "AC-4 shortcut must focus the referenced original clue");
          await page.keyboard.press("h");
          await page.waitForTimeout(60);
        }
        await page.keyboard.press("Escape");
      }
    }
    console.log("AC-4 hint names the dossier number: PASS");

    // AC-3 and AC-6: interaction never renumbers, and padding never changes.
    await ensureCase(page, 7);
    await page.locator("#language").selectOption("it");
    const mapping = rows => rows.map(({index, number}) => ({index, number}));
    const before = mapping(await readRows(page));
    const expected = await expectedRows(page);
    const filters = await page.$$eval('[data-filter]', nodes => nodes.map(node => node.dataset.filter));
    assert.deepEqual([...filters].sort(), ["all", "object", "position", "room"]);
    for (const family of filters) {
      await page.locator(`[data-filter="${family}"]`).click();
      const filtered = await readRows(page);
      const belongs = row => family === "all" || (family === "position"
        ? ["direction", "beside", "touch"].includes(row.type) : row.type === family);
      const wanted = expected.filter(belongs);
      assert.ok(filtered.length > 0, `${family}: filter has no coverage`);
      if (family !== "all") assert.ok(filtered.length < before.length, `${family}: filter did not narrow`);
      assert.deepEqual(mapping(filtered), mapping(wanted), `AC-5 ${family}: filtering changed clue identity or number`);
    }
    await page.locator('[data-filter="all"]').click();
    assert.deepEqual(mapping(await readRows(page)), before, "clearing the filter changed a number");
    await page.locator("#clues .clue").first().click();
    assert.equal((await readRows(page))[0].pressed, true, "marking did not toggle aria-pressed");
    assert.deepEqual(mapping(await readRows(page)), before, "marking a clue changed a number");
    await page.locator('#tray .person').nth(1).click();
    await page.locator('[data-cell="0"]').click();
    await page.locator('#tray .person').nth(2).click();
    await page.locator('[data-cell="1"]').click();
    assert.ok((await page.locator(".cell.conflict").count()) > 0, "expected a conflict to be flagged");
    assert.deepEqual(mapping(await readRows(page)), before, "a conflict changed a number");
    await page.locator("#hint").click();
    assert.deepEqual(mapping(await readRows(page)), before, "an active hint changed a number");
    await page.keyboard.press("Escape");
    console.log("AC-3/AC-6 stable under filter, mark, conflict, hint: PASS");

    // AC-7: the number column holds at every width, size and locale.
    for (const width of [1440, 800, 390, 360]) {
      for (const size of [5, 6, 7]) {
        await ensureCase(page, size);
        await page.setViewportSize({ width, height: 1100 });
        for (const language of ["it", "en", "es", "ca"]) {
          await page.locator("#language").selectOption(language);
          const cluesTab = page.locator("#clues-tab");
          if ((await cluesTab.isVisible()) && (await cluesTab.getAttribute("aria-pressed")) !== "true")
            await cluesTab.click();
          const measured = await page.evaluate(() =>
            [...document.querySelectorAll("#clues .clue")].map((row) => {
              const number = row.querySelector(".clue-number");
              const text = row.querySelector("span:last-of-type");
              const swatch = row.querySelector(".clue-object");
              const ro = row.getBoundingClientRect();
              const no = number.getBoundingClientRect();
              const to = text.getBoundingClientRect();
              const style = getComputedStyle(number);
              // Flex items are blockified: their content top is the first 20px line-box top.
              const lineTop = no.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
              return {
                index: Number(row.dataset.clue),
                numberWidth: no.width,
                paddingTop: style.paddingTop,
                lineTopDelta: lineTop - to.top,
                digits: Number(number.textContent),
                numberInside: no.left >= ro.left - 0.5 && no.right <= ro.right + 0.5,
                textHeight: to.height,
                text: text.textContent.replace(/\s+/g, " ").trim(),
                textIsSpan: text.tagName === "SPAN",
                hasSwatch: !!swatch,
                swatchDistinct: !swatch || (text !== swatch && text === swatch.nextElementSibling),
                textClipped: text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1,
                textInside: to.left >= no.right && to.right <= ro.right + 0.5 && to.bottom <= ro.bottom + 0.5,
              };
            }),
          );
          assert.ok(measured.length > 0, `${width}/${size}/${language}: no clues`);
          const expected = await expectedRows(page);
          assert.ok(measured.some(row => row.hasSwatch), "AC-6 requires a furniture swatch row");
          assert.ok(measured.some(row => row.digits < 10) && measured.some(row => row.digits >= 10),
            "AC-2 requires both one-digit and two-digit numeric values");
          for (const row of measured) {
            assert.equal(row.paddingTop, "0px", `AC-1 ${width}/${size}/${language}: number padding-top`);
            assert.ok(Math.abs(row.lineTopDelta) <= 1, `AC-2 ${width}/${size}/${language}: line top delta ${row.lineTopDelta}px`);
            assert.ok(
              Math.abs(row.numberWidth - 24) < 1,
              `${width}/${size}/${language}: number column is ${row.numberWidth}px, expected 24px`,
            );
            assert.ok(row.numberInside, `${width}/${size}/${language}: number escapes its row`);
            assert.ok(row.textIsSpan && row.swatchDistinct, "AC-6 must measure the text span, not the furniture swatch");
            assert.equal(row.text, expected.find(item => item.index === row.index)?.text, "AC-6 rendered clue content");
            assert.ok(row.textHeight >= 20, `AC-6 ${width}/${size}/${language}: clue text height ${row.textHeight}px`);
            assert.ok(!row.textClipped, `${width}/${size}/${language}: clue text is clipped`);
            assert.ok(row.textInside, `${width}/${size}/${language}: clue text overflows its row`);
          }
          console.log(`ALIGN ${width}/${size}/${language}: padding=${[...new Set(measured.map(row => row.paddingTop))]} delta=${Math.min(...measured.map(row => row.lineTopDelta))}..${Math.max(...measured.map(row => row.lineTopDelta))}px`);
        }
      }
    }
    console.log("AC-7 number column holds at 1440/800/390/360 in four locales: PASS");

    // AC-5: the DOM identity stays on the original index.
    await ensureCase(page, 6);
    await assertIdentity(page, "AC-5 original indices");
    console.log("AC-5 data-clue keeps the original index: PASS");

    assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
    console.log("CLUE NUMBERING: PASS");
  } finally {
    await browser.close();
  }
})();
