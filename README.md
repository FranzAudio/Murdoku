# Murdoku

A static, client-side deduction game for story-001. Open `index.html` directly, or run `python3 -m http.server 8000` in this directory and open http://localhost:8000. No install, build, backend, CDN, or external service is required. Italian is the default; choose English in the header.

## Verification

Run `node self-test.cjs` (250 deterministic seeds by default), or `node self-test.cjs 2000` for a larger sample. There is no build or lint dependency. JavaScript syntax can be checked with `node --check` on each source file.

- AC-1: seeded procedural rectangular partitions (4–8 connected rooms), shuffled people/row/column permutations, a fresh cryptographic seed per New Case.
- AC-2: the verifier checks one person in every row and column and exactly two people in the victim's room.
- AC-3: an exhaustive assignment search, with row/column and clue pruning, counts solutions up to two. Only exactly one is accepted. The test additionally checks three cases against all 720 × 720 row/column permutation assignments, without using solver candidate domains.
- AC-4: a separate finite-domain solver applies unary room/adjacency constraints and repeated pairwise arc consistency for row/column exclusion and directional clues. Each eliminated candidate must lack support in another person's domain. There is no branching, trial assignment, recursive search, or hidden solution lookup in this solver. Only six singleton domains that satisfy all rules/clues pass. A deduction trace is retained. Failure discards the candidate; 100 failed attempts produces an actionable error.
- AC-5: all emitted clues are evaluated against the answer. Directional clues are removed only if forward propagation still solves the case. Vocabulary includes room membership, north/west ordering, beside a room cell orthogonally, touching a room cell diagonally, and empty-room count. With one person per row/column, two people cannot be orthogonally adjacent, so adjacency clues explicitly reference room cells. North and west specify strict axis ordering, not alignment.
- AC-6–AC-9: `game.js` owns placements, removal, relocation, marks, history, reset, conflict detection, partial checks, and murderer identification. Model tests cover these transitions and negative cases. Check reports incorrect placements compared with the unique answer and only counts clues as contradicted when all referenced people are placed; global count is evaluated on complete boards.
- AC-10–AC-11: HTML/CSS and classic local scripts work over both HTTP and `file://`. All portraits, patterns and icons are bundled. No application fetch, analytics, external font, or runtime package dependency exists. Room walls, legend, portrait traits, victim badges, clue categories, keyboard navigation, live announcements and responsive views are included.

Browser verification is available in `browser-test.cjs` (optional development dependency: Playwright). With the static server running, use `NODE_PATH=/path/to/playwright/node_modules CHROME_BIN=/path/to/chrome node browser-test.cjs`; omit `CHROME_BIN` to use Playwright's installed Chromium. `TEST_URL` overrides http://localhost:8000. This checks live controls, keyboard navigation, conflicts, reset, localisation, victory, retry, responsive layout, bundled images and direct-file offline operation. Screenshots are written under `/tmp/murdoku-*.png`.

Engineering verification performed: 2,000 seeds pass the generator/model suite; Chrome desktop (1440px) and narrow (390px) flows pass, including forced generator failure/retry and `file://` operation. All JavaScript syntax checks pass. No build or repository lint command exists. Designer review and PM acceptance remain separate.

## Interaction

Select one of six people, then click a cell. Click an occupied cell to return its person to the tray. Select an already placed person to locate them; click an empty cell to move them. Mark X toggles empty-cell exclusions. Undo reverts a placement, removal, mark, move or reset. Reset uses inline confirmation. Arrow keys navigate cells; Enter/Space acts; X marks; Delete/Backspace clears; 1–6 places a person; Ctrl/Cmd+Z undoes. Clues may be checked off without changing the puzzle.

## Technical decisions and limits

`strings.js` is the single bilingual strings table rather than a fetched JSON file, so direct-file offline use needs no browser fetch permission. Seeded generation is deterministic and replayable through `MurdokuEngine.generate(seed)`. The finite-domain verifier is the emission gate, not a claim about puzzle difficulty. Room, global-count and adjacency clues may be redundant. Difficulty levels, saving, hints and account features are outside the approved MVP. Timer and move count are in memory only.

The Designer owns `specs/ui/ui-001.md` and assets; the PM owns the story and final acceptance. This implementation does not record product acceptance.
