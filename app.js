/* DOM rendering and interaction; game rules live in the pure engine/model. */
"use strict";
const $ = (id) => document.getElementById(id),
  E = window.MurdokuEngine;
const textures = [
  "library",
  "dining",
  "conservatory",
  "lounge",
  "billiards",
  "ballroom",
  "kitchen",
  "cellar",
];
let locale = "it",
  game = null,
  selected = 0,
  marking = false,
  resolved = new Set(),
  filter = "all",
  loading = false,
  modalKind = "",
  view = "board",
  located = -1,
  size = 6,
  pendingSize = null;
const s = () => window.MurdokuStrings[locale];
function format(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, key) => values[key]);
}
function coord(cell) {
  return String.fromCharCode(65 + E.row(cell, size)) + (E.col(cell, size) + 1);
}
function image(path, alt = "", className = "") {
  const img = document.createElement("img");
  img.src = "assets/" + path + ".png";
  img.alt = alt;
  img.className = className;
  return img;
}
function portrait(person) {
  return image(
    "characters/" + (person === 0 ? "victim" : "suspect-" + person),
    "",
    "portrait",
  );
}
function clueText(clue) {
  if (clue.type === "object") {
    const object = game.puzzle.objects.find((o) => o.id === clue.object);
    return format(s().objectClues[clue.relation], {
      name: s().names[clue.a],
      object: s().objectNames[object.type],
      on: s().objectOn[object.type],
    });
  }
  const t = s(),
    values = {
      name: t.names[clue.a],
      other: t.names[clue.b],
      room: t.roomNames[clue.room],
      direction: t[clue.axis],
      count: clue.count,
    };
  return format(
    t[
      clue.type === "direction"
        ? "directionClue"
        : clue.type === "count"
          ? "countClue"
          : clue.type + "Clue"
    ],
    values,
  );
}
function renderBoard(focusCell) {
  const board = $("board"),
    t = s();
  board.replaceChildren();
  board.setAttribute("aria-rowcount", size);
  board.setAttribute("aria-colcount", size);
  const header = document.createElement("div");
  header.className = "grid-row";
  header.setAttribute("role", "row");
  board.append(header);
  const corner = document.createElement("span");
  corner.className = "coord";
  header.append(corner);
  const conflicts = game ? game.conflicts() : { rows: [], cols: [] };
  for (let c = 0; c < size; c++) {
    const label = document.createElement("span");
    label.className = "coord" + (conflicts.cols.includes(c) ? " warning" : "");
    label.textContent = c + 1;
    label.setAttribute("role", "columnheader");
    header.append(label);
  }
  for (let r = 0; r < size; r++) {
    const gridRow = document.createElement("div");
    gridRow.className = "grid-row";
    gridRow.setAttribute("role", "row");
    board.append(gridRow);
    const label = document.createElement("span");
    label.className = "coord" + (conflicts.rows.includes(r) ? " warning" : "");
    label.textContent = String.fromCharCode(65 + r);
    label.setAttribute("role", "rowheader");
    gridRow.append(label);
    for (let c = 0; c < size; c++) {
      const cell = r * size + c,
        room = game
          ? game.puzzle.rooms[cell]
          : Math.floor(r / Math.ceil(size / 2)) * 2 +
            Math.floor(c / Math.ceil(size / 2)),
        person = game ? game.occupant(cell) : -1;
      const object = game?.puzzle.objects?.find((o) => o.cell === cell);
      const button = document.createElement("button");
      button.className = "cell";
      if (object) {
        button.dataset.object = object.id;
        const icon = image(
          "icons/furniture-" + object.type,
          "",
          "furniture-icon",
        );
        icon.setAttribute("aria-hidden", "true");
        if (person >= 0) {
          const badge = document.createElement("span");
          badge.className = "furniture-badge";
          badge.append(icon);
          button.append(badge);
        } else button.append(icon);
      }
      button.dataset.cell = cell;
      button.setAttribute("role", "gridcell");
      button.tabIndex = cell === (focusCell ?? 0) ? 0 : -1;
      button.disabled = !game || loading;
      button.style.backgroundImage = `url(assets/rooms/${textures[room]}.png)`;
      const rooms = game?.puzzle.rooms;
      if (rooms) {
        for (const [edge, neighbor, boundary] of [
          ["Top", cell - size, r === 0],
          ["Bottom", cell + size, r === size - 1],
          ["Left", cell - 1, c === 0],
          ["Right", cell + 1, c === size - 1],
        ])
          if (boundary || rooms[neighbor] !== room)
            button.style["border" + edge] = "3px solid #D4AF37";
      }
      button.classList.toggle(
        "conflict",
        conflicts.rows.includes(r) || conflicts.cols.includes(c),
      );
      button.classList.toggle("located", located === cell);
      if (person >= 0) {
        button.append(portrait(person));
        if (person === 0)
          button.append(image("icons/victim-marker", "V", "seal"));
        const name = document.createElement("span");
        name.className = "cell-name";
        name.textContent = t.names[person];
        button.append(name);
      } else if (game?.marks.includes(cell))
        button.append(image("icons/mark-x", "X", "x-mark"));
      const state =
        person >= 0
          ? format(t.cellOccupied, { name: t.names[person] }) +
            (person === 0 ? ", " + t.victim : "") +
            (object
              ? " (" +
                format(t.cellOn, { object: t.objectNames[object.type] }) +
                ")"
              : "")
          : game?.marks.includes(cell)
            ? t.markCell
            : t.empty;
      button.setAttribute(
        "aria-label",
        `${coord(cell)}, ${t.roomNames[room]}, ${object ? t.objectNames[object.type] + ", " : ""}${state}`,
      );
      button.title = button.getAttribute("aria-label");
      button.addEventListener("click", () => action(cell));
      button.addEventListener("keydown", (event) => {
        const offsets = {
          ArrowUp: -size,
          ArrowDown: size,
          ArrowLeft: -1,
          ArrowRight: 1,
        };
        if (event.key in offsets) {
          event.preventDefault();
          const target = cell + offsets[event.key];
          if (
            target >= 0 &&
            target < size * size &&
            !(event.key === "ArrowLeft" && c === 0) &&
            !(event.key === "ArrowRight" && c === size - 1)
          ) {
            button.tabIndex = -1;
            const next = board.querySelector(`[data-cell="${target}"]`);
            next.tabIndex = 0;
            next.focus();
          }
        } else if (event.key.toLowerCase() === "x") {
          event.preventDefault();
          action(cell, true);
        } else if (["Backspace", "Delete"].includes(event.key)) {
          event.preventDefault();
          action(cell, false, true);
        } else if (/^[1-7]$/.test(event.key) && Number(event.key) <= size) {
          event.preventDefault();
          selected = Number(event.key) - 1;
          marking = false;
          action(cell);
        }
      });
      gridRow.append(button);
    }
  }
  if (focusCell !== undefined)
    board.querySelector(`[data-cell="${focusCell}"]`)?.focus();
}
function renderTray() {
  const t = s();
  $("tray").replaceChildren();
  for (let person = 0; person < size; person++) {
    const cell = game ? game.positions[person] : -1,
      button = document.createElement("button");
    button.className = "person" + (cell >= 0 ? " placed" : "");
    button.setAttribute("role", "option");
    button.setAttribute(
      "aria-selected",
      String(selected === person && !marking),
    );
    button.disabled = !game || loading;
    button.append(portrait(person));
    if (person === 0)
      button.append(image("icons/victim-marker", "V", "victim-badge"));
    const name = document.createElement("span");
    name.className = "person-name";
    name.textContent = t.names[person];
    button.append(name);
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent =
      cell >= 0 ? coord(cell) : person === 0 ? t.victim : t.suspect;
    button.append(tag);
    button.setAttribute(
      "aria-label",
      `${person + 1}. ${t.names[person]}, ${t.traits[person]}, ${person === 0 ? t.victim : t.suspect}${cell >= 0 ? ", " + t.placed + " " + coord(cell) : ""}`,
    );
    button.title = t.traits[person];
    button.addEventListener("click", () => {
      selected = person;
      marking = false;
      located = cell;
      renderTray();
      renderBoard();
      updateControls();
    });
    $("tray").append(button);
  }
}
function renderClues() {
  const t = s();
  $("clues").replaceChildren();
  let previous = "";
  if (!game) return;
  const clues = game.puzzle.clues
    .map((clue, index) => ({ clue, index }))
    .sort(
      (a, b) =>
        ["room", "direction", "beside", "touch", "object", "count"].indexOf(
          a.clue.type,
        ) -
        ["room", "direction", "beside", "touch", "object", "count"].indexOf(
          b.clue.type,
        ),
    );
  for (const { clue, index } of clues) {
    if (
      (filter === "room" && clue.type !== "room") ||
      (filter === "position" &&
        !["direction", "beside", "touch"].includes(clue.type)) ||
      (filter === "object" && clue.type !== "object")
    )
      continue;
    const category = t.categories[clue.type === "touch" ? "beside" : clue.type];
    if (category !== previous) {
      const heading = document.createElement("h3");
      heading.className = "clue-category";
      heading.textContent = category;
      $("clues").append(heading);
      previous = category;
    }
    const button = document.createElement("button");
    button.className = "clue";
    button.dataset.clue = index;
    button.setAttribute("aria-pressed", String(resolved.has(index)));
    button.setAttribute("aria-label", t.resolved + ": " + clueText(clue));
    const number = document.createElement("span");
    number.className = "clue-number";
    number.textContent = resolved.has(index)
      ? "✓"
      : String(index + 1).padStart(2, "0");
    const text = document.createElement("span");
    text.textContent = clueText(clue);
    button.append(number);
    if (clue.type === "object") {
      const object = game.puzzle.objects.find((o) => o.id === clue.object);
      const swatch = image("icons/furniture-" + object.type, "", "clue-object");
      swatch.setAttribute("aria-hidden", "true");
      button.append(swatch);
    }
    button.append(text);
    button.disabled = loading;
    button.addEventListener("click", () => {
      if (resolved.has(index)) resolved.delete(index);
      else resolved.add(index);
      renderClues();
      $("clues").querySelector(`[data-clue="${index}"]`)?.focus();
    });
    $("clues").append(button);
  }
}
function renderLegend() {
  $("legend").replaceChildren();
  $("furniture-legend").replaceChildren();
  if (!game) return;
  for (const object of game.puzzle.objects ?? []) {
    const item = document.createElement("div");
    item.className = "furniture-legend-item";
    item.append(
      image("icons/furniture-" + object.type, ""),
      document.createTextNode(
        s().objectNames[object.type] + " · " + coord(object.cell),
      ),
    );
    $("furniture-legend").append(item);
  }
  for (const room of [...new Set(game.puzzle.rooms)].sort((a, b) => a - b)) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.backgroundImage = `url(assets/rooms/${textures[room]}.png)`;
    const fixtures = document.createElement("span");
    fixtures.className = "room-fixtures";
    for (const object of game.puzzle.objects ?? [])
      if (game.puzzle.rooms[object.cell] === room) {
        const icon = image(
          "icons/furniture-" + object.type,
          s().objectNames[object.type],
        );
        icon.title = s().objectNames[object.type] + " · " + coord(object.cell);
        fixtures.append(icon);
      }
    item.append(swatch, document.createTextNode(s().roomNames[room]), fixtures);
    $("legend").append(item);
  }
}
function updateControls() {
  for (const id of ["new", "undo", "reset", "mark", "check"]) {
    $(id).disabled =
      loading ||
      (id !== "new" && !game) ||
      (id === "undo" && !game?.history.length);
    $(id).querySelector("span").textContent = s()[id];
  }
  for (const radio of document.querySelectorAll("[data-size]")) {
    const active = Number(radio.dataset.size) === size;
    radio.disabled = loading;
    radio.setAttribute("aria-checked", String(active));
    radio.tabIndex = active ? 0 : -1;
    radio.title = s().sizeOptions[radio.dataset.size];
    radio.setAttribute("aria-label", radio.title);
  }
  $("size-selector").setAttribute("aria-label", s().sizeLabel);
  $("language").disabled = loading;
  $("start").disabled = loading;
  $("mark").setAttribute("aria-pressed", String(marking));
  $("counter").textContent = game
    ? format(s().sizeCounter, {
        remaining: game.positions.filter((x) => x < 0).length,
        total: size,
      })
    : "";
  $("case-label").textContent = game
    ? `${s().case} № ${game.puzzle.seed.toString(16).toUpperCase().padStart(8, "0")}`
    : s().noCase;
  $("welcome").hidden = !!game;
  document
    .querySelectorAll(".filters button,.view-tabs button")
    .forEach((b) => (b.disabled = loading));
}
function render() {
  const t = s();
  document.documentElement.lang = locale;
  document.documentElement.style.setProperty("--grid-size", size);
  document.documentElement.style.setProperty("--person-count", size);
  document.body.dataset.gridSize = size;
  document.title = "Murdoku · " + t.subtitle;
  for (const [id, key] of Object.entries({
    subtitle: "subtitle",
    "language-label": "language",
    "welcome-title": "welcomeTitle",
    "welcome-text": "welcome",
    start: "start",
    "tray-title": "tray",
    "clues-title": "clues",
    "toggle-dossier": "dossierToggle",
    "dossier-label": "dossier",
    "rooms-title": "rooms",
    "furniture-title": "furnitureTitle",
    instructions: "instructions",
    rules: "rules",
    "reset-question": "resetQuestion",
    "confirm-reset": "confirm",
    "cancel-reset": "cancel",
    "footer-copy": "footer",
    "board-tab": "boardTab",
    "clues-tab": "cluesTab",
  }))
    $(id).textContent = format(t[key], { total: size });
  for (const b of document.querySelectorAll(".filters button"))
    b.textContent =
      t[
        b.dataset.filter === "all"
          ? "all"
          : b.dataset.filter === "room"
            ? "roomFilter"
            : b.dataset.filter === "object"
              ? "objectFilter"
              : "position"
      ];
  for (const key of ["board", "clues"])
    $(key + "-tab").setAttribute("aria-pressed", String(key === view));
  document.body.dataset.view = view;
  renderBoard();
  renderTray();
  renderClues();
  renderLegend();
  updateControls();
}
function announceConflicts() {
  const t = s(),
    c = game.conflicts();
  $("conflicts").textContent = [
    ...c.rows.map((value) =>
      format(t.conflictRow, { value: String.fromCharCode(65 + value) }),
    ),
    ...c.cols.map((value) => format(t.conflictCol, { value: value + 1 })),
  ].join(" ");
}
function action(cell, mark = marking, clear = false) {
  if (!game || loading) return;
  if (game.act(cell, selected, mark, clear)) {
    located = -1;
    $("feedback").textContent = "";
    announceConflicts();
    renderBoard(cell);
    renderTray();
    updateControls();
  }
}
function showModal(kind, title, body, detail = "") {
  modalKind = kind;
  $("modal-title").textContent = title;
  $("modal-body").textContent = body;
  $("modal-detail").textContent = detail;
  $("modal-symbol").textContent =
    kind === "loading" ? "⌕" : kind === "victory" ? "✦" : "!";
  $("modal-primary").hidden = kind === "loading";
  $("modal-close").hidden = kind === "loading";
  $("modal-primary").textContent =
    kind === "size"
      ? s().sizeContinue
      : kind === "error"
        ? s().retry
        : s().another;
  $("modal-close").textContent =
    kind === "size"
      ? s().cancel
      : kind === "error"
        ? s().sizeRevert
        : s().close;
  if (!$("modal").open) $("modal").showModal();
}
function newCase(nextSize = size) {
  if (loading) return;
  if (nextSize !== size) game = null;
  size = nextSize;
  loading = true;
  document.body.classList.add("loading");
  $("reset-confirm").hidden = true;
  render();
  showModal(
    "loading",
    s().furnitureGenerating,
    format(s().generating, { size }) + " " + s().verifying,
  );
  setTimeout(() => {
    try {
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      game = new window.MurdokuGame(E.generate(random[0], 100, size));
      selected = 0;
      marking = false;
      resolved.clear();
      filter = "all";
      located = -1;
      view = "board";
      $("feedback").textContent = s().ready;
      $("conflicts").textContent = "";
      $("modal").close();
      modalKind = "";
    } catch (error) {
      console.error(error);
      showModal("error", format(s().sizeError, { size }), s().furnitureError);
    } finally {
      loading = false;
      document.body.classList.remove("loading");
      render();
      document
        .querySelectorAll(".filters button")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.filter === filter)),
        );
      if (!modalKind) $("tray").querySelector("button")?.focus();
    }
  }, 80);
}
function requestSize(next) {
  if (loading || next === size) return;
  if (
    game &&
    (game.positions.some((x) => x >= 0) || game.marks.length || resolved.size)
  ) {
    pendingSize = next;
    showModal("size", s().sizeLabel, s().sizeConfirm);
  } else newCase(next);
}
for (const radio of document.querySelectorAll("[data-size]")) {
  radio.addEventListener("click", () =>
    requestSize(Number(radio.dataset.size)),
  );
  radio.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const sizes = [5, 6, 7],
      index = sizes.indexOf(Number(radio.dataset.size));
    const next = sizes[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3];
    requestSize(next);
    if (!$("modal").open)
      document.querySelector(`[data-size="${next}"]`).focus();
  });
}
$("new").addEventListener("click", () => newCase());
$("start").addEventListener("click", () => newCase());
$("undo").addEventListener("click", () => {
  if (game?.undo()) {
    located = -1;
    $("feedback").textContent = "";
    announceConflicts();
    render();
  }
});
$("reset").addEventListener("click", () => {
  $("reset-confirm").hidden = false;
  $("confirm-reset").focus();
});
$("cancel-reset").addEventListener("click", () => {
  $("reset-confirm").hidden = true;
  $("reset").focus();
});
$("confirm-reset").addEventListener("click", () => {
  game.reset();
  located = -1;
  $("reset-confirm").hidden = true;
  $("feedback").textContent = s().ready;
  $("conflicts").textContent = "";
  render();
  $("reset").focus();
});
$("mark").addEventListener("click", () => {
  marking = !marking;
  located = -1;
  renderTray();
  renderBoard();
  updateControls();
});
$("check").addEventListener("click", () => {
  const result = game.check();
  $("feedback").textContent = format(s().checkResult, result);
  announceConflicts();
  if (result.solved) {
    const room = game.puzzle.rooms[game.positions[0]],
      seconds = Math.floor((Date.now() - game.started) / 1000),
      time =
        String(Math.floor(seconds / 60)).padStart(2, "0") +
        ":" +
        String(seconds % 60).padStart(2, "0");
    showModal(
      "victory",
      s().solved,
      format(s().murderer, {
        name: s().names[result.murderer],
        room: s().roomNames[room],
      }),
      `${s().time}: ${time} · ${s().moves}: ${game.moves}`,
    );
  }
});
$("language").addEventListener("change", () => {
  locale = $("language").value;
  $("feedback").textContent = game ? s().ready : "";
  render();
  if (game) announceConflicts();
});
$("modal-primary").addEventListener("click", () => {
  $("modal").close();
  const next = modalKind === "size" ? pendingSize : size;
  pendingSize = null;
  modalKind = "";
  newCase(next);
});
$("modal-close").addEventListener("click", () => {
  $("modal").close();
  const wasError = modalKind === "error";
  pendingSize = null;
  modalKind = "";
  if (wasError) {
    game = null;
    newCase(6);
  } else document.querySelector(`[data-size="${size}"]`).focus();
});
$("modal").addEventListener("cancel", (event) => {
  if (loading) event.preventDefault();
  else {
    pendingSize = null;
    modalKind = "";
  }
});
for (const b of document.querySelectorAll(".filters button"))
  b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document
      .querySelectorAll(".filters button")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderClues();
  });
for (const id of ["board", "clues"])
  $(id + "-tab").addEventListener("click", () => {
    view = id;
    document.body.dataset.view = view;
    for (const key of ["board", "clues"])
      $(key + "-tab").setAttribute("aria-pressed", String(key === view));
  });
$("toggle-dossier").addEventListener("click", () => {
  const collapsed = $("dossier").classList.toggle("collapsed");
  $("toggle-dossier").setAttribute("aria-expanded", String(!collapsed));
});
document.addEventListener("keydown", (event) => {
  if (
    !loading &&
    game &&
    !$("modal").open &&
    /^[1-7]$/.test(event.key) &&
    Number(event.key) <= size &&
    !event.target.closest(".cell, input, select")
  ) {
    selected = Number(event.key) - 1;
    marking = false;
    renderTray();
    updateControls();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "z" &&
    !loading &&
    game &&
    !$("modal").open
  ) {
    event.preventDefault();
    $("undo").click();
  }
});
render();
