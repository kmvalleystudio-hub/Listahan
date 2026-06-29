const data = await fetch("/checklist-data.json").then((r) => r.json());

let progress = await fetch("/api/progress").then((r) => r.json());
let saveTimer = null;

const mainEl = document.getElementById("main");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const saveStatus = document.getElementById("save-status");
const lastSavedEl = document.getElementById("last-saved");

document.getElementById("app-title").textContent = data.title;
document.getElementById("app-subtitle").textContent =
  `${data.subtitle} Last updated ${data.lastUpdated}.`;

function allItems() {
  const items = [];
  for (const section of data.sections) {
    if (section.items) items.push(...section.items);
    if (section.subsections) {
      for (const sub of section.subsections) {
        items.push(...sub.items);
      }
    }
  }
  return items;
}

const ITEMS = allItems();
const REQUIRED = ITEMS.filter((i) => !i.optional);

function isChecked(id) {
  return Boolean(progress.checked?.[id]);
}

function updateProgress() {
  const doneRequired = REQUIRED.filter((i) => isChecked(i.id)).length;
  const doneAll = ITEMS.filter((i) => isChecked(i.id)).length;
  const pct = REQUIRED.length ? Math.round((doneRequired / REQUIRED.length) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressFill.parentElement.setAttribute("aria-valuenow", String(pct));
  progressText.textContent = `${doneRequired} / ${REQUIRED.length} required complete · ${doneAll} / ${ITEMS.length} total`;
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const prev = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove("copied");
    }, 1600);
  } catch {
    window.prompt("Copy this command:", text);
  }
}

function renderActions(actions) {
  if (!actions?.length) return null;
  const box = document.createElement("div");
  box.className = "item-actions";

  for (const action of actions) {
    if (action.type === "note" || action.type === "manual") {
      const p = document.createElement("p");
      p.className = action.type === "note" ? "action-note" : "action-manual";
      if (action.type === "manual" && !action.label) {
        p.innerHTML = `<strong>What you do:</strong> ${action.text}`;
      } else {
        p.textContent = action.text;
      }
      box.appendChild(p);
      continue;
    }

    if (action.type === "terminal") {
      const wrap = document.createElement("div");
      wrap.className = "action-terminal";
      if (action.label) {
        const lbl = document.createElement("p");
        lbl.className = "action-label";
        lbl.textContent = action.label;
        wrap.appendChild(lbl);
      }
      const row = document.createElement("div");
      row.className = "cmd-row";
      const code = document.createElement("pre");
      code.className = "cmd-code";
      code.textContent = action.command;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-copy";
      btn.textContent = "Copy";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        void copyText(action.command, btn);
      });
      row.appendChild(code);
      row.appendChild(btn);
      wrap.appendChild(row);
      box.appendChild(wrap);
      continue;
    }

    if (action.type === "browser") {
      const wrap = document.createElement("div");
      wrap.className = "action-browser";
      if (action.label) {
        const lbl = document.createElement("p");
        lbl.className = "action-label";
        lbl.textContent = action.label;
        wrap.appendChild(lbl);
      }
      const a = document.createElement("a");
      a.href = action.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = action.urlText ?? action.url;
      a.addEventListener("click", (e) => e.stopPropagation());
      wrap.appendChild(a);
      box.appendChild(wrap);
    }
  }

  return box;
}

function renderItem(item) {
  const wrap = document.createElement("div");
  wrap.className = "item-wrap" + (isChecked(item.id) ? " done" : "") + (item.optional ? " optional" : "");
  wrap.dataset.id = item.id;

  const row = document.createElement("div");
  row.className = "item-row";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = isChecked(item.id);
  input.addEventListener("change", () => {
    progress.checked[item.id] = input.checked;
    wrap.classList.toggle("done", input.checked);
    updateProgress();
    updateSectionMeta(wrap.closest(".section"));
    scheduleSave();
  });

  row.addEventListener("click", (e) => {
    if (e.target === input || e.target.closest(".btn-copy") || e.target.closest("a")) return;
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change"));
  });

  const textWrap = document.createElement("div");
  textWrap.style.flex = "1";
  const title = document.createElement("div");
  title.className = "item-label";
  title.textContent = item.label;
  textWrap.appendChild(title);

  if (item.detail && !item.actions?.length) {
    const detail = document.createElement("p");
    detail.className = "item-detail";
    detail.textContent = item.detail;
    textWrap.appendChild(detail);
  }

  row.appendChild(input);
  row.appendChild(textWrap);
  wrap.appendChild(row);

  const actionsEl = renderActions(item.actions);
  if (actionsEl) {
    wrap.appendChild(actionsEl);
  } else if (item.detail) {
    const detailOnly = document.createElement("div");
    detailOnly.className = "item-actions";
    const p = document.createElement("p");
    p.className = "action-note";
    p.textContent = item.detail;
    detailOnly.appendChild(p);
    wrap.appendChild(detailOnly);
  }

  return wrap;
}

function sectionCounts(section) {
  const items = section.items ?? [];
  const subItems = (section.subsections ?? []).flatMap((s) => s.items);
  const all = [...items, ...subItems];
  const done = all.filter((i) => isChecked(i.id)).length;
  return { done, total: all.length };
}

function updateSectionMeta(sectionEl) {
  const id = sectionEl.dataset.sectionId;
  const section = data.sections.find((s) => s.id === id);
  if (!section) return;
  const { done, total } = sectionCounts(section);
  const meta = sectionEl.querySelector(".section-meta");
  if (meta) meta.textContent = `${done}/${total}`;
}

function renderSection(section) {
  const wrap = document.createElement("article");
  wrap.className = "section open";
  wrap.dataset.sectionId = section.id;

  const { done, total } = sectionCounts(section);
  const header = document.createElement("button");
  header.type = "button";
  header.className = "section-header";
  header.innerHTML = `
    <span class="section-title">${section.title}</span>
    <span style="display:flex;align-items:center;gap:0.5rem">
      <span class="section-meta">${done}/${total}</span>
      <span class="section-chevron" aria-hidden="true">▶</span>
    </span>
  `;
  header.addEventListener("click", () => {
    wrap.classList.toggle("open");
  });

  const body = document.createElement("div");
  body.className = "section-body";

  if (section.items) {
    for (const item of section.items) {
      body.appendChild(renderItem(item));
    }
  }

  if (section.subsections) {
    for (const sub of section.subsections) {
      const subTitle = document.createElement("h3");
      subTitle.className = "subsection-title";
      subTitle.textContent = sub.title;
      body.appendChild(subTitle);
      for (const item of sub.items) {
        body.appendChild(renderItem(item));
      }
    }
  }

  wrap.appendChild(header);
  wrap.appendChild(body);
  return wrap;
}

function renderGettingStarted() {
  const gs = data.gettingStarted;
  if (!gs) return;
  const host = document.getElementById("getting-started");
  host.hidden = false;
  const inner = document.createElement("div");
  inner.className = "getting-started-inner";
  const h2 = document.createElement("h2");
  h2.textContent = gs.title;
  inner.appendChild(h2);
  const actions = renderActions(gs.steps);
  if (actions) inner.appendChild(actions);
  host.appendChild(inner);
}

renderGettingStarted();

for (const section of data.sections) {
  mainEl.appendChild(renderSection(section));
}

updateProgress();

// Sign-off fields
const signoff = progress.signoff ?? {};
const managerEl = document.getElementById("signoff-manager");
const dateEl = document.getElementById("signoff-date");
const buildEl = document.getElementById("signoff-build");
const notesEl = document.getElementById("signoff-notes");

managerEl.value = signoff.manager ?? "";
dateEl.value = signoff.date ?? "";
buildEl.value = signoff.build ?? "";
notesEl.value = signoff.notes ?? "";

for (const track of signoff.tracks ?? []) {
  const cb = document.querySelector(`input[name="track"][value="${track}"]`);
  if (cb) cb.checked = true;
}

function collectSignoff() {
  const tracks = [...document.querySelectorAll('input[name="track"]:checked')].map((el) => el.value);
  return {
    manager: managerEl.value,
    date: dateEl.value,
    build: buildEl.value,
    notes: notesEl.value,
    tracks,
  };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveStatus.textContent = "Saving…";
  saveTimer = setTimeout(async () => {
    progress.signoff = collectSignoff();
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progress),
      });
      const saved = await res.json();
      if (saved.updatedAt) {
        const d = new Date(saved.updatedAt);
        lastSavedEl.textContent = `Last saved ${d.toLocaleString()}`;
      }
      saveStatus.textContent = "Saved";
      setTimeout(() => {
        if (saveStatus.textContent === "Saved") saveStatus.textContent = "";
      }, 1500);
    } catch {
      saveStatus.textContent = "Save failed — is the server running?";
    }
  }, 350);
}

for (const el of [managerEl, dateEl, buildEl, notesEl]) {
  el.addEventListener("input", scheduleSave);
}
for (const el of document.querySelectorAll('input[name="track"]')) {
  el.addEventListener("change", scheduleSave);
}

if (progress.updatedAt) {
  lastSavedEl.textContent = `Last saved ${new Date(progress.updatedAt).toLocaleString()}`;
}

document.getElementById("btn-expand").addEventListener("click", () => {
  document.querySelectorAll(".section").forEach((s) => s.classList.add("open"));
});

document.getElementById("btn-collapse").addEventListener("click", () => {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("open"));
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("Clear all checkboxes and sign-off fields?")) return;
  progress = { checked: {}, signoff: {} };
  fetch("/api/progress", { method: "DELETE" }).then(() => location.reload());
});
