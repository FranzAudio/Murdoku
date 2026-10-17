---
id: story-001
kind: story
work_type: product
ui_impact: material
cancelled: no
revision: 00bf0a2d72d1f2fbf1c47921ffc33b5eddf2234ee3e72aa1a8358472a6b2401f
approved: yes
approved_by: PM Assistant
approved_at: 2026-10-17T13:29:12Z
accepted: no
accepted_by:
accepted_at:
accepted_story_revision:
accepted_ui_revision:
accepted_code_revision:
---

# User Story
> **Type:** product artifact
> **Inspired by:** Jeff Patton, *User Story Mapping*, ch. 6-7 (3 Cs, Connextra)
> **Use:** single source of truth for scope, rules and acceptance. UI spec and code derive from here.

## 1. Card

| Field | Value |
| --- | --- |
| ID | story-001 |
| Title | Murdoku browser game with procedural generation |
| Priority | High |
| Estimate | L (the generator algorithm is the risky part) |

## 2. Story

> As a casual puzzle player
> I want to play procedurally generated Murdoku cases in my browser
> So that I get an endless supply of unique, solvable deduction puzzles without installing anything.

## 3. Conversation

**What Murdoku is.** A murder-mystery deduction puzzle (created by Manuel Garand). A square grid divided into named rooms holds N people: one victim plus N-1 suspects, exactly one person per row and column. Two rules govern every valid case:
1. no two people share a row or a column (each row and each column holds exactly one person; the victim counts as a person);
2. the room containing the victim holds exactly one suspect, and that suspect is the murderer.

Clues are logical statements (room membership, cardinal direction, adjacency, global counts) that are individually true and together force a unique arrangement. The player places the people and identifies the murderer. Murdoku is not Sudoku: there are no numbers and no 3x3 boxes.

**User context.** Plays in a desktop browser, no account, wants a fresh case on demand.

**Failure mode.** An ambiguous case (more than one solution), an unsolvable case, or clues that do not match the solution destroys trust and makes the game unplayable.

**Edge cases.** Empty or partial board; wrong placements; marking and unmarking; regenerating many cases in a row; a generated case that fails the no-guess bar.

## 4. Confirmation

| AC | Given | When | Then |
| --- | --- | --- | --- |
| AC-1 | the app is loaded with an empty board | the player clicks "New case" | a procedurally generated 6x6 case renders: 6 people (1 victim marked "V", 5 suspects with visible traits), a room partition covering all 36 cells, and a clue list |
| AC-2 | any generated case | the generator's verifier checks its solution | the solution obeys both rules: every row and column holds exactly one person, and the victim's room holds exactly one suspect |
| AC-3 | any generated case | the generator enumerates all valid assignments | exactly one assignment satisfies the clues and both rules (unique solution) |
| AC-4 | any generated case | a forward constraint-propagation solver runs | it reaches the unique solution without backtracking; a case that fails is discarded and regenerated |
| AC-5 | a generated case | each clue is evaluated against its solution | every clue is true, and the clue set is sufficient to deduce the full arrangement |
| AC-6 | a case is on screen | the player selects a person and clicks a cell | the person is placed there; clicking again removes it; an "X" can be toggled on empty cells |
| AC-7 | placements or marks exist | the player clicks Undo or Reset | Undo reverts the last action; Reset clears the board |
| AC-8 | two people occupy the same row or column | the player submits or interacts | the app surfaces the row/column violation (highlight and/or check feedback) |
| AC-9 | a partial or complete board | the player clicks Check | the app reports how many placements or clues are wrong and, if correct and complete, names the murderer (the unique suspect in the victim's room) |
| AC-10 | the app is served as static files | it is opened in a modern browser | it runs fully client-side with no backend or network requests |
| AC-11 | a case is displayed | the player inspects the board | rooms are visually distinct, people have distinguishable portraits, the victim is clearly marked, and clue cards are legible |

## 5. Open questions

1. **MVP clue vocabulary.** Proposal: room membership, cardinal direction (north/south/east/west), orthogonal "beside", diagonal "touch", and one global ("exactly K rooms are empty"). The Engineer confirms the minimal subset that still guarantees uniqueness and the no-guess bar.
2. **Board size.** 6x6 fixed for MVP (5 suspects + 1 victim); larger sizes are a stretch.
3. **UI language.** Italian by default, English swappable via a single strings table.
4. **Difficulty levels.** Stretch, not in MVP.

## 6. Assumptions

- Single-player, offline, no accounts, no server persistence (a "last case" restore via localStorage is a stretch).
- Desktop-first (mouse/touch), evergreen browser.
- Assets are bitmaps, self-made or permissively licensed, bundled locally (no runtime CDN).
- The procedural generator with a unique, forward-solvable clue set is the key technical risk. If the strict no-guess bar (AC-4) proves too costly for the first cut, the Engineer flags it and we phase: MVP guarantees AC-2/AC-3/AC-5, then tighten to AC-4 next.
