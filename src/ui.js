/* ---------- UI layer (vanilla JS port of the Page) ---------- */
const $app = document.getElementById("app");
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let today = ymd(new Date());
const boot = loadState(today);
let storageOk = boot.ok;
let st = boot.s;
let sel = nextPending(today, st);
let view = "day";
let tab = "progress";
let liftMetric = "e1";
let histSel = "";
let msg = "";
let confirmReset = false;

function save() {
  if (!storageOk) return;
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { storageOk = false; }
}
function setSt(f) { st = f(st); save(); }
function upDay(d, f) { setSt((p) => ({ ...p, days: { ...p.days, [d]: f(p.days[d] || {}) } })); }

function planFor(d) {
  const s = st.settings;
  const day = st.days[d] || {};
  const pushed = st.pushes.indexOf(d) >= 0;
  const key = sessionFor(d, st);
  const ph = phaseFor(d, st);
  const light = !!day.light;
  const sauna = day.sauna !== undefined ? day.sauna : s.saunaDefault;
  const pool = day.pool !== undefined ? day.pool : s.poolDefault;
  const ex = liftList(key, s, { phase: ph.phase, steps: st.steps, light, deload: ph.deload });
  const run = runPlan(key, s, st.runLv, light, ph.deload);
  const liftEst = ex.length ? Math.round(8 + ex.reduce((a, e) => a + (e.sets * ((e.perLeg ? 80 : 40) + e.restSec)) / 60, 0)) : 0;
  const est = key === "recovery" ? (pool ? 60 : 65) : ex.length ? Math.round(liftEst / 5) * 5 : Math.round(run.est / 5) * 5;
  const status = pushed ? "pushed" : day.status || "open";
  const shownKey = day.session && status === "done" ? day.session : key;
  const prevDates = Object.keys(st.days).filter((x) => { const q = st.days[x]; return x < d && q.status === "done" && q.session === key && !!q.planned && q.planned.phase === ph.phase; }).sort();
  const prev = prevDates.length ? st.days[prevDates[prevDates.length - 1]] : null;
  const prevAny = Object.keys(st.days).filter((x) => { const q = st.days[x]; return x < d && q.status === "done" && q.session === key && !!q.planned; }).sort();
  const prevRun = prevAny.length ? st.days[prevAny[prevAny.length - 1]] : null;
  return { d, s, day, pushed, key, ph, light, sauna, pool, ex, run, est, status, shownKey, prev, prevRun, off: isOff(day), locked: status !== "open" };
}

const defSet = (e) => ({ r: String(e.repsN), w: e.w !== null ? String(e.w) : "", done: false });
function setVal(day, e, i) { const a = ((day.act || {})[e.id] || [])[i]; return a && a.done ? a : defSet(e); }
function editSet(d, e, i, patch) {
  upDay(d, (x) => {
    const act = { ...(x.act || {}) };
    const arr = (act[e.id] || []).slice();
    while (arr.length < e.sets) arr.push(defSet(e));
    const cur = arr[i] && arr[i].done ? arr[i] : defSet(e);
    arr[i] = { ...cur, ...patch };
    act[e.id] = arr;
    return { ...x, act };
  });
}

function markDone() {
  const P = planFor(sel);
  const { ex, run, ph, light, key } = P;
  const cur = sel;
  setSt((p) => {
    const d = p.days[cur] || {};
    const snap = { steps: { ...p.steps }, misses: { ...p.misses }, runLv: { ...p.runLv } };
    const steps = { ...p.steps }, misses = { ...p.misses }, runLv = { ...p.runLv };
    const outcomes = [];
    const dOff = isOff(d);
    const act = d.act || {};
    const anyDone = ex.some((e) => (act[e.id] || []).some((x) => !!x && x.done));
    const final = {};
    ex.forEach((e) => {
      const arr = [];
      for (let i = 0; i < e.sets; i++) {
        const a = (act[e.id] || [])[i];
        if (!anyDone) arr.push({ r: e.repsN, w: e.w });
        else if (a && a.done) { const nw = numOr(a.w, e.w); arr.push({ r: Number(a.r) || 0, w: e.w === null ? null : (nw != null ? nw : e.w) }); }
      }
      final[e.id] = arr;
    });
    if (ex.length && !anyDone) outcomes.push("No sets logged, so everything counts as done as planned.");
    if (ph.deload && ex.length) outcomes.push("Deload week: lift progression paused, it resumes next week.");
    else if (light && ex.length) outcomes.push("Lighter version: weights held for next time.");
    else ex.filter((e) => e.prog !== "none").forEach((e) => {
      const k = `${ph.phase}:${e.id}`;
      const sets = final[e.id];
      const hit = sets.filter((x) => x.r >= e.repsN && (e.w === null || (x.w || 0) >= e.w));
      const cs = steps[k] || 0;
      if (hit.length >= e.sets) {
        misses[k] = 0;
        if (e.prog === "w" && e.w !== null) {
          const top = Math.max(e.w, ...hit.map((x) => x.w || 0));
          const next = top + 5;
          steps[k] = Math.round((next - e.baseW) / 5);
          outcomes.push(`${e.name}: hit it${top > e.w ? ` (up to ${top})` : ""}, next time ${next} lb.`);
        } else { steps[k] = cs + 1; outcomes.push(`${e.name}: hit it, next time ${e.repsN + 1} reps.`); }
      } else if (dOff) {
        if (sets.length * 2 >= e.sets) { steps[k] = cs + 1; outcomes.push(`${e.name}: off day, progression kept.`); }
        else outcomes.push(`${e.name}: off day, gentle hold.`);
      } else {
        misses[k] = (misses[k] || 0) + 1;
        if (misses[k] >= 2) { steps[k] = cs - 1; misses[k] = 0; outcomes.push(`${e.name}: missed twice on good days, back off 5 lb.`); }
        else outcomes.push(`${e.name}: missed reps, repeat this weight next time.`);
      }
    });
    let runAct;
    if (run.plan) {
      const ri0 = d.runIn || {};
      runAct = { dist: numOr(ri0.dist, run.plan.dist), time: numOr(ri0.time, run.plan.time), main: numOr(ri0.main, run.plan.main) };
      const ratio = key === "long" ? (runAct.dist || 0) / (run.plan.dist || 1) : (runAct.main || 0) / (run.plan.main || 1);
      if (ph.deload) outcomes.push("Deload week: run level held.");
      else if (light) outcomes.push("Lighter run: run level held.");
      else if (ratio >= 0.9) { runLv[key] = (runLv[key] || 0) + 1; outcomes.push("Run done as planned. Next one steps up about 10%."); }
      else if (dOff && ratio >= 0.6) { runLv[key] = (runLv[key] || 0) + 1; outcomes.push("Off day, run progression kept."); }
      else outcomes.push("Came in short, so next time repeats this run.");
    }
    if (key === "recovery") outcomes.push("Recovery day logged.");
    const planned = { phase: ph.phase, deload: ph.deload, ex: ex.map((e) => ({ id: e.id, name: e.name, sets: e.sets, reps: e.repsN, w: e.w, kind: e.kind, load: e.load, perLeg: e.perLeg })), run: run.plan };
    return { ...p, steps, misses, runLv, days: { ...p.days, [cur]: { ...d, status: "done", session: key, outcomes, snap, planned, final, runAct } } };
  });
  sel = nextPending(addDays(cur, 1), st);
  render(true);
}
function undoStatus() {
  setSt((p) => {
    const d = { ...(p.days[sel] || {}) };
    const snap = d.snap;
    ["status", "outcomes", "snap", "session", "planned", "final", "runAct"].forEach((k) => delete d[k]);
    const base = { ...p, days: { ...p.days, [sel]: d } };
    return snap ? { ...base, steps: snap.steps, misses: snap.misses, runLv: snap.runLv } : base;
  });
  render();
}
function skip() { const cur = sel; const key = sessionFor(cur, st); upDay(cur, (d) => ({ ...d, status: "skipped", session: key })); sel = nextPending(addDays(cur, 1), st); render(true); }
function push() { const cur = sel; setSt((p) => ({ ...p, pushes: [...p.pushes.filter((x) => x !== cur), cur] })); sel = addDays(cur, 1); render(true); }
function unpush() { setSt((p) => ({ ...p, pushes: p.pushes.filter((x) => x !== sel) })); render(); }
function go(d) { sel = d; view = "day"; render(true); }

/* ---------- text helpers ---------- */
function deltaText(P, e) {
  const prev = P.prev;
  if (!prev || !prev.planned) return "First time this block";
  const pv = prev.planned.ex.find((x) => x.id === e.id);
  if (!pv) return "New this week";
  const tag = P.ph.deload ? " (deload)" : "";
  if (e.kind === "bw") { const dd = e.repsN - pv.reps; return dd > 0 ? `+${dd} rep${dd > 1 ? "s" : ""} vs last week` : dd < 0 ? `${dd} reps vs last week${tag}` : `Same reps as last week${tag}`; }
  if (e.w !== null && pv.w !== null && e.kind !== "fixed") { const dd = e.w - pv.w; return dd > 0 ? `+${dd} lb vs last week` : dd < 0 ? `${dd} lb vs last week${tag}` : `Same weight as last week${tag}`; }
  return "Same as last week";
}
function lastText(P, e) {
  const f = P.prev && P.prev.final ? P.prev.final[e.id] : undefined;
  if (!f || !f.length) return "";
  const topW = Math.max(...f.map((x) => x.w || 0));
  return `Last time: ${f.map((x) => x.r).join(", ")} reps${f[0].w !== null && e.kind !== "fixed" ? ` @ ${e.kind === "add" ? "+" : ""}${topW} lb` : ""}`;
}
function runDelta(P) {
  const { run, prevRun, ph, key } = P;
  if (!run.plan || !prevRun || !prevRun.planned || !prevRun.planned.run) return "";
  const pr = prevRun.planned.run;
  const tag = ph.deload ? " (deload)" : "";
  if (key === "long" && pr.dist !== undefined && run.plan.dist !== undefined) { const dd = Math.round((run.plan.dist - pr.dist) * 100) / 100; return dd > 0 ? `+${dd} mi vs last week` : dd < 0 ? `${dd} mi vs last week${tag}` : `Same distance as last week${tag}`; }
  if (pr.main !== undefined && run.plan.main !== undefined) { const dd = run.plan.main - pr.main; return dd > 0 ? `+${dd} ${run.plan.mainLabel} vs last week` : dd < 0 ? `${dd} ${run.plan.mainLabel} vs last week${tag}` : `Same as last week${tag}`; }
  return "";
}
function pvaFor(x) {
  const out = [];
  if (!x || !x.planned) return out;
  x.planned.ex.forEach((pe) => {
    const f = (x.final || {})[pe.id] || [];
    const plan = `${pe.sets} x ${pe.reps}${pe.perLeg ? "/leg" : ""} @ ${pe.load}`;
    const topW = f.length ? Math.max(...f.map((q) => q.w || 0)) : 0;
    const actual = f.length ? `${f.map((q) => q.r).join(", ")}${f[0].w !== null && pe.kind !== "fixed" ? ` @ ${pe.kind === "add" ? "+" : ""}${topW} lb` : ""}` : "Not logged";
    const miss = f.length < pe.sets || f.some((q) => q.r < pe.reps || (pe.w !== null && (q.w || 0) < pe.w));
    out.push({ name: pe.name, plan, actual, miss });
  });
  const pr = x.planned.run, ra = x.runAct;
  if (pr && ra) {
    if (pr.dist !== undefined) out.push({ name: "Distance", plan: `${pr.dist} mi`, actual: `${ra.dist} mi`, miss: (ra.dist || 0) < pr.dist * 0.9 });
    if (pr.time !== undefined) out.push({ name: "Time", plan: `${pr.time} min`, actual: `${ra.time} min${ra.dist && ra.time ? ` (${fmtPace((ra.time * 60) / ra.dist)}/mi)` : ""}`, miss: false });
    if (pr.main !== undefined) out.push({ name: pr.mainLabel === "rounds" ? "Rounds" : "Tempo minutes", plan: `${pr.main}`, actual: `${ra.main}`, miss: (ra.main || 0) < pr.main });
  }
  return out;
}

/* ---------- small renderers ---------- */
const toggleHtml = (label, on, action) => `<button class="toggle ${on ? "on" : ""}" data-action="${action}" role="switch" aria-checked="${on}"><span class="tlabel">${esc(label)}</span><span class="sw"><span class="knob"></span></span></button>`;
const lineList = (ls) => `<div class="lines">${ls.map((l) => `<div><div class="t2">${esc(l.title)}</div><div class="sm">${esc(l.detail)}</div></div>`).join("")}</div>`;
const field = (label, id, value, attrs = "") => `<label class="field"><span>${esc(label)}</span><input id="${id}" value="${esc(value)}" ${attrs}></label>`;

function stripBar() {
  const wkStart = addDays(sel, -parse(sel).getDay());
  const strip = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));
  const a = parse(wkStart), b = parse(strip[6]);
  const range = `${MON[a.getMonth()]} ${a.getDate()} - ${a.getMonth() === b.getMonth() ? "" : MON[b.getMonth()] + " "}${b.getDate()}`;
  const pills = strip.map((d) => {
    const x = st.days[d] || {};
    const isSel = d === sel && view === "day";
    const isToday = d === today;
    const mark = st.pushes.indexOf(d) >= 0 ? "\u21b7" : x.status === "done" ? "\u2713" : x.status === "skipped" ? "\u2013" : "\u00b7";
    return `<button class="daypill ${isSel ? "sel" : ""} ${isToday ? "today" : ""} ${x.status === "done" ? "done" : ""}" data-action="go" data-d="${d}" aria-label="${DOWF[parse(d).getDay()]} ${esc(NAMES[sessionFor(d, st)])}">
      <span class="dw">${DOW[parse(d).getDay()].slice(0, 2)}</span><span class="dn">${parse(d).getDate()}</span><span class="dm">${mark}</span></button>`;
  }).join("");
  return `<header class="bar"><div class="barin">
    <div class="barrow">
      <div class="grp"><button class="sbtn" data-action="wk" data-n="-7" aria-label="Previous week">\u2039</button><span class="range">${range}</span><button class="sbtn" data-action="wk" data-n="7" aria-label="Next week">\u203a</button></div>
      <div class="grp">${sel !== today || view !== "day" ? `<button class="sbtn" data-action="go" data-d="${today}">Today</button>` : ""}<button class="sbtn ${view === "menu" ? "on" : ""}" data-action="menu">${view === "menu" ? "Close" : "Menu"}</button></div>
    </div>
    <div class="pills">${pills}</div></div></header>`;
}

function dayView() {
  const P = planFor(sel);
  const { day, pushed, key, ph, light, sauna, pool, ex, run, est, status, shownKey, off, locked } = P;
  const sd = parse(sel);
  const rp = run.plan;
  const ri = day.runIn || {};
  let h = `<main class="wrap" id="day">`;
  h += `<h1>${DOWF[sd.getDay()]}, ${MON[sd.getMonth()]} ${sd.getDate()}${sel === today ? " (today)" : ""}</h1>`;
  h += `<div class="head"><div class="h3">${esc(pushed ? `Rest day. ${NAMES[key]} moved to tomorrow.` : NAMES[shownKey])}</div>
    <div class="row"><span class="sm">${ph.phase === "A" ? "Strength" : "Hypertrophy"} \u00b7 Block ${ph.block}, week ${ph.week} of 4</span>
    ${ph.deload ? `<span class="tag accent">Deload week</span>` : ""}${status === "done" ? `<span class="tag ok">Done</span>` : ""}${status === "skipped" ? `<span class="tag">Skipped</span>` : ""}</div>
    ${!pushed && status !== "done" ? `<div class="sm">About ${est} min including warm-up${light ? " (lighter version)" : ""}</div>` : ""}
    ${ph.deload && status === "open" ? `<div class="sm">Deload: one fewer set, about 10% lighter, runs about 20% shorter. Progression resumes next week.</div>` : ""}</div>`;

  if (status === "done") {
    h += `<section class="card"><div class="lbl">Result</div><div class="sm">${esc((day.outcomes || []).join(" "))}</div></section>`;
    const rows = pvaFor(day);
    h += `<section class="card"><div class="lbl">Logged</div>${rows.map((r, i) => `<div class="logrow ${i ? "sep" : ""}"><div class="t2">${esc(r.name)}</div><div class="sm">Planned ${esc(r.plan)}</div><div class="sm ${r.miss ? "warn" : "pri"}">Did ${esc(r.actual)}</div></div>`).join("")}
      ${day.feel !== undefined || (day.tags && day.tags.length) ? `<div class="tiny">Feel: ${day.feel !== undefined ? day.feel + "/5" : "not rated"}${day.tags && day.tags.length ? " \u00b7 " + esc(day.tags.join(", ")) : ""}${isOff(day) ? " \u00b7 off day" : ""}</div>` : ""}
      ${day.note ? `<div class="tiny">Note: ${esc(day.note)}</div>` : ""}${day.mob && Object.keys(day.mob).length ? `<div class="tiny">Mobility: ${Object.keys(day.mob).length} stretches done</div>` : ""}</section>`;
  }
  if (!pushed && status !== "done" && WARM[key]) h += `<section class="card"><div class="lbl">Warm-up</div><div class="t2">${esc(WARM[key])}</div></section>`;
  if (!pushed && status !== "done") {
    ex.forEach((e) => {
      const hasW = e.kind === "lb" || e.kind === "db" || e.kind === "add";
      const lt = lastText(P, e);
      let sets = "";
      for (let i = 0; i < e.sets; i++) {
        const v = setVal(day, e, i);
        sets += `<div class="setrow"><span class="sm setn">Set ${i + 1}</span>
          <input class="num" type="number" inputmode="numeric" aria-label="Set ${i + 1} reps" data-set="${e.id}:${i}:r" value="${esc(v.r)}" ${locked ? "disabled" : ""}><span class="tiny">reps</span>
          ${hasW ? `<input class="num" type="number" inputmode="decimal" aria-label="Set ${i + 1} weight" data-set="${e.id}:${i}:w" value="${esc(v.w)}" ${locked ? "disabled" : ""}><span class="tiny">${e.kind === "add" ? "+lb" : "lb"}</span>` : ""}
          <button class="pill ${v.done ? "on" : ""}" data-action="log" data-ex="${e.id}" data-i="${i}" data-logbtn="${e.id}:${i}" ${locked ? "disabled" : ""}>${v.done ? "\u2713" : "Log"}</button></div>`;
      }
      h += `<section class="card"><div class="h3">${esc(e.name)}</div><div class="t2">${e.sets} x ${esc(e.reps)} @ ${esc(e.load)}</div>
        <div class="sm">Rest ${esc(e.rest)} \u00b7 ${esc(deltaText(P, e))}</div>${lt ? `<div class="sm">${esc(lt)}</div>` : ""}${e.note ? `<div class="tiny">${esc(e.note)}</div>` : ""}
        <div class="sets">${sets}</div></section>`;
    });
    if (run.lines.length) { const rd = runDelta(P); h += `<section class="card"><div class="lbl">${esc(NAMES[key])}</div>${lineList(run.lines)}${rd ? `<div class="sm">${esc(rd)}</div>` : ""}</section>`; }
    if (rp) {
      const dd = numOr(ri.dist, rp.dist) || 0, tt = numOr(ri.time, rp.time) || 0;
      h += `<section class="card"><div class="lbl">What you actually did</div>
        ${rp.dist !== undefined ? field("Distance (mi)", "run-dist", ri.dist !== undefined ? ri.dist : rp.dist, `type="number" inputmode="decimal" data-run="dist" ${locked ? "disabled" : ""}`) : ""}
        ${rp.time !== undefined ? field("Time (min)", "run-time", ri.time !== undefined ? ri.time : rp.time, `type="number" inputmode="decimal" data-run="time" ${locked ? "disabled" : ""}`) : ""}
        ${rp.main !== undefined ? field(rp.mainLabel === "rounds" ? "Hard rounds completed" : "Tempo minutes completed", "run-main", ri.main !== undefined ? ri.main : rp.main, `type="number" inputmode="numeric" data-run="main" ${locked ? "disabled" : ""}`) : ""}
        ${rp.dist !== undefined && rp.time !== undefined ? `<div class="sm" id="pace">${dd > 0 && tt > 0 ? `Average pace: ${fmtPace((tt * 60) / dd)}/mi` : ""}</div>` : ""}</section>`;
    }
  }
  { const mob = mobilityFor(pushed ? "recovery" : shownKey, sel, st); const done = day.mob || {}; const n = mob.list.filter((x) => done[x.id]).length;
    h += `<section class="card"><div class="lbl">Mobility & stretching</div><div class="t2">About ${mob.min} min \u00b7 ${n}/${mob.list.length} done</div>
      <div class="tiny">Static holds after training only; warm-ups stay dynamic. Ease into a mild stretch, never pain, and breathe slowly. Add a second round if you have time.${(pushed || shownKey === "recovery") ? " Great right after the hot tub or sauna while you're warm; hamstring and calf stretches work sitting on the hot tub step." : ""}</div>
      ${mob.list.map((x) => `<div class="stretch ${done[x.id] ? "on" : ""}"><button class="chk ${done[x.id] ? "on" : ""}" data-action="mob" data-id="${x.id}" aria-label="Mark ${esc(x.name)} done">${done[x.id] ? "\u2713" : ""}</button>
        <div class="sbody"><div class="t2">${esc(x.name)}</div><div class="sm">${x.hold} s${x.side ? " each side" : ""}</div><ul>${x.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div></div>`).join("")}</section>`; }
  const recov = recoveryLines(pushed ? "recovery" : shownKey, sauna, pool);
  h += `<section class="card"><div class="lbl">${key === "recovery" || pushed ? "Recovery" : "After the workout"}</div>${lineList(recov)}
    <div class="tiny">Drink 16-24 oz with electrolytes per heat session. Hot tub max 104\u00b0F, 15-20 min per bout. No alcohol. Get out if dizzy.</div>
    ${toggleHtml("Sauna available today", sauna, "sauna")}${toggleHtml("Pool available today", pool, "pool")}</section>`;
  if (status === "open") {
    h += `<section class="card"><div class="lbl">How do you feel?</div><div class="tiny">Fill this in before you mark complete. A low rating or an off-day tag protects your progression.</div>
      <div class="row">${[1, 2, 3, 4, 5].map((n) => `<button class="pill rate ${day.feel === n ? "on" : ""}" data-action="feel" data-n="${n}">${n}</button>`).join("")}</div>
      <div class="tiny">1 = wrecked, 5 = great</div>
      <div class="row">${TAGS.map((t) => { const on = (day.tags || []).indexOf(t) >= 0; return `<button class="pill ${on ? "on" : ""}" data-action="tag" data-t="${esc(t)}">${on ? "\u2713 " : ""}${esc(t)}</button>`; }).join("")}</div>
      ${off ? `<div class="sm pri">${light ? "Off day: lighter version on. Missed reps won't cut your progression." : "Off day flagged. Missed reps won't cut your progression. Want the lighter version?"}</div>` : ""}
      ${toggleHtml("Lighter version (1 fewer set, 10% lighter, shorter run)", light, "light")}
      <label class="field"><span>Note</span><textarea rows="2" data-note="1" placeholder="Optional">${esc(day.note || "")}</textarea></label></section>`;
  }
  h += `<div class="actions">${status === "open" ? `<button class="big" data-action="push">Push to tomorrow</button><button class="big primary" data-action="done">Mark complete</button>`
    : status === "pushed" ? `<button class="big" data-action="unpush">Undo push</button>` : `<button class="big" data-action="undo">${status === "done" ? "Undo done" : "Undo skip"}</button>`}</div>`;
  if (status === "open") h += `<div class="row"><button class="sbtn" data-action="skip">Skip this session</button></div>`;
  h += `<div class="tiny center">Swipe left or right to change days.</div></main>`;
  return h;
}

/* ---------- charts (inline SVG) ---------- */
const PAL = ["var(--c1)", "var(--c2)", "var(--c3)"];
function lineChart(labels, series, fmt, unit) {
  const W = 360, H = 200, L = 44, R = 12, T = 12, B = 28;
  const all = series.flatMap((s) => s.values);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padv = (hi - lo) * 0.1; lo -= padv; hi += padv;
  const x = (i) => L + (labels.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (labels.length - 1));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  let g = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${esc(fmt ? fmt(t) : Math.round(t))}</text>`).join("");
  g += labels.map((l, i) => (l ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ax">${esc(l)}</text>` : "")).join("");
  g += series.map((s, si) => `<polyline fill="none" stroke="${PAL[si % 3]}" stroke-width="2.5" points="${s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>` + s.values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${PAL[si % 3]}"/>`).join("")).join("");
  const legend = `<div class="legend">${series.map((s, si) => `<span><i style="background:${PAL[si % 3]}"></i>${esc(s.label)}</span>`).join("")}${unit ? `<span class="tiny">${esc(unit)}</span>` : ""}</div>`;
  return `${legend}<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`;
}
function colChart(points) {
  const W = 360, H = 180, T = 22, B = 24, L = 8, R = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const bw = (W - L - R) / points.length;
  const g = points.map((p, i) => {
    const hgt = (p.value / max) * (H - T - B);
    const x0 = L + i * bw + bw * 0.15, w = bw * 0.7, y0 = H - B - hgt;
    return `<rect x="${x0}" y="${y0}" width="${w}" height="${Math.max(hgt, 1)}" rx="3" fill="var(--c1)"/>
      <text x="${x0 + w / 2}" y="${y0 - 5}" text-anchor="middle" class="val">${esc(p.display)}</text>
      <text x="${x0 + w / 2}" y="${H - 8}" text-anchor="middle" class="ax">${esc(p.label)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`;
}
const table = (cols, rows) => `<div class="tblwrap"><table><thead><tr>${cols.map((c, i) => `<th class="${i ? "r" : ""}">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "r" : ""} ${c && c.warn ? "warn" : ""} ${c && c.ok ? "ok" : ""}">${esc(c && typeof c === "object" ? c.text : c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

function menuView() {
  const s = st.settings;
  const doneDates = Object.keys(st.days).filter((d) => st.days[d].status === "done" && !!st.days[d].planned).sort();
  const aggs = {};
  doneDates.forEach((d) => {
    const w = Math.floor(diff(s.start, d) / 7) + 1;
    if (w < 1) return;
    const a = aggs[w] || { e1: {}, top: {}, vol: 0, mi: 0, sec: 0 };
    const x = st.days[d];
    const fin = x.final || {};
    (x.planned ? x.planned.ex : []).forEach((pe) => {
      const sets = fin[pe.id] || [];
      sets.forEach((fs) => { if (fs.w !== null && (pe.kind === "lb" || pe.kind === "db")) a.vol += fs.r * fs.w * (pe.kind === "db" ? 2 : 1) * (pe.perLeg ? 2 : 1); });
      LIFTS.forEach((Lf) => {
        if (Lf.ids.indexOf(pe.id) < 0) return;
        sets.forEach((fs) => { if (fs.w === null || fs.r <= 0) return; a.e1[Lf.label] = Math.max(a.e1[Lf.label] || 0, Math.round(fs.w * (1 + fs.r / 30))); a.top[Lf.label] = Math.max(a.top[Lf.label] || 0, fs.w); });
      });
      if (pe.id === "pull" || pe.id === "pullbw") sets.forEach((fs) => { a.pull = Math.max(a.pull || 0, fs.r); });
    });
    if (x.runAct && x.runAct.dist && x.runAct.time && (x.session === "long" || x.session === "tempo")) { a.mi += x.runAct.dist; a.sec += x.runAct.time * 60; }
    aggs[w] = a;
  });
  const wk = Object.keys(aggs).map(Number).sort((a, b) => a - b);
  const weeks = wk.length ? Array.from({ length: wk[wk.length - 1] - wk[0] + 1 }, (_, i) => wk[0] + i).slice(-12) : [];
  const feelPts = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).filter((d) => (st.days[d] || {}).feel !== undefined)
    .map((d) => { const x = st.days[d]; const f = x.feel || 0; return { label: `${parse(d).getMonth() + 1}/${parse(d).getDate()}`, value: f, display: isOff(x) ? `${f} off` : `${f}` }; });
  const segBtn = (act, val, cur, label) => `<button class="seg ${val === cur ? "on" : ""}" data-action="${act}" data-v="${val}">${label}</button>`;
  let h = `<main class="wrap"><h1>Gym Plan</h1><div class="segs">${segBtn("tab", "progress", tab, "Progress")}${segBtn("tab", "history", tab, "History")}${segBtn("tab", "settings", tab, "Settings")}</div>`;

  if (tab === "progress") {
    if (!doneDates.length && !feelPts.length) h += `<p class="sm">Charts fill in as you mark workouts complete.</p>`;
    const liftSeries = LIFTS.map((Lf) => ({ label: Lf.label, raw: weeks.map((w) => { const a = aggs[w]; const v = a ? (liftMetric === "e1" ? a.e1[Lf.label] : a.top[Lf.label]) : undefined; return v === undefined ? null : v; }) }))
      .filter((x) => x.raw.some((v) => v !== null)).map((x) => ({ label: x.label, values: fill(x.raw) }));
    const latest = LIFTS.map((Lf) => { const w = [...weeks].reverse().find((n) => aggs[n] && aggs[n].top[Lf.label] !== undefined); return w === undefined ? null : [Lf.label, `${aggs[w].top[Lf.label]} lb`, `${aggs[w].e1[Lf.label]} lb`, `W${w}`]; }).filter(Boolean);
    if (latest.length) {
      h += `<section class="card"><div class="h3">Main lifts</div><div class="tiny">Est. 1RM uses the Epley formula on your logged sets. Per plan week.</div>
        <div class="segs">${segBtn("metric", "e1", liftMetric, "Est. 1RM")}${segBtn("metric", "top", liftMetric, "Top set")}</div>
        ${weeks.length >= 2 && liftSeries.length ? lineChart(weeks.map((w, i) => wkLabel(i, weeks.length, w)), liftSeries, null, "lb") : ""}
        ${table(["Lift", "Top set", "Est. 1RM", "Week"], latest)}</section>`;
    }
    const pullPts = weeks.filter((w) => aggs[w] && aggs[w].pull !== undefined).map((w) => ({ label: `W${w}`, value: aggs[w].pull || 0, display: `${aggs[w].pull}` }));
    if (pullPts.length) h += `<section class="card"><div class="h3">Pull-ups, best set</div><div class="tiny">Reps. Strength blocks use weighted pull-ups, so reps run lower there.</div>${colChart(pullPts)}</section>`;
    const volPts = weeks.map((w) => { const v = aggs[w] ? Math.round(aggs[w].vol) : 0; return { label: `W${w}`, value: v, display: v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${v}` }; }).filter((x) => x.value > 0);
    if (volPts.length) h += `<section class="card"><div class="h3">Weekly lifting volume</div><div class="tiny">Reps x weight in lb, both hands and legs counted; bodyweight moves excluded.</div>${colChart(volPts)}</section>`;
    const miPts = weeks.map((w) => { const v = aggs[w] ? Math.round(aggs[w].mi * 10) / 10 : 0; return { label: `W${w}`, value: v, display: `${v}` }; }).filter((x) => x.value > 0);
    const paceWeeks = weeks.filter((w) => aggs[w] && aggs[w].mi > 0);
    const paceVals = paceWeeks.map((w) => Math.round((aggs[w].sec / aggs[w].mi / 60) * 100) / 100);
    if (miPts.length) h += `<section class="card"><div class="h3">Weekly run mileage</div><div class="tiny">Miles, long and tempo runs.</div>${colChart(miPts)}
      ${paceWeeks.length >= 2 ? `<div class="t2">Average pace</div>${lineChart(paceWeeks.map((w, i) => wkLabel(i, paceWeeks.length, w)), [{ label: "Avg pace (min/mi)", values: paceVals }], (v) => fmtPace(v * 60), "")}` : ""}</section>`;
    if (feelPts.length) h += `<section class="card"><div class="h3">Readiness, last 14 days</div>${colChart(feelPts)}</section>`;
  }

  if (tab === "history") {
    const histDates = Array.from(new Set([...Object.keys(st.days), ...st.pushes])).filter((d) => d <= today)
      .filter((d) => { const x = st.days[d]; return st.pushes.indexOf(d) >= 0 || (!!x && (!!x.status || x.feel !== undefined)); }).sort().reverse().slice(0, 21);
    const pvaDates = [...doneDates].reverse().slice(0, 30);
    if (!pvaDates.length && !histDates.length) h += `<p class="sm">Your history shows up after you log your first day.</p>`;
    if (pvaDates.length) {
      const ps = histSel && pvaDates.indexOf(histSel) >= 0 ? histSel : pvaDates[0];
      const pd = st.days[ps];
      const rows = pvaFor(pd).map((r) => [r.name, r.plan, r.miss ? { text: r.actual, warn: true } : r.actual]);
      h += `<section class="card"><div class="h3">Planned vs actual</div><label class="field"><span>Session</span><select data-change="hist">${pvaDates.map((d) => `<option value="${d}" ${d === ps ? "selected" : ""}>${short(d)} \u00b7 ${esc(NAMES[st.days[d].session || "long"])}</option>`).join("")}</select></label>
        ${rows.length ? table(["Exercise", "Planned", "Actual"], rows) : ""}
        <div class="sm">Feel: ${pd.feel !== undefined ? pd.feel + "/5" : "not rated"}${isOff(pd) ? " (off day)" : ""}. ${pd.planned && pd.planned.deload ? "Deload week. " : ""}${esc((pd.outcomes || []).join(" "))}${pd.mob && Object.keys(pd.mob).length ? ` Mobility: ${Object.keys(pd.mob).length} stretches.` : ""}</div></section>`;
    }
    if (histDates.length) {
      const rows = histDates.map((d) => {
        const x = st.days[d] || {};
        const isP = st.pushes.indexOf(d) >= 0;
        const k = x.session || sessionFor(d, st);
        const result = isP ? "Pushed" : x.status === "done" ? { text: "Done", ok: true } : x.status === "skipped" ? "Skipped" : d === today ? "In progress" : "Not logged";
        const feel = x.feel !== undefined ? `${x.feel}/5${isOff(x) ? " off day" : ""}${x.tags && x.tags.length ? " \u00b7 " + x.tags.join(", ") : ""}` : "-";
        const mc = x.mob ? Object.keys(x.mob).length : 0;
        return [short(d), isP ? "Rest" : NAMES[k], result, isOff(x) ? { text: feel, warn: true } : feel, mc ? `\u2713 ${mc}` : "-"];
      });
      const notes = histDates.filter((d) => (st.days[d] || {}).note).slice(0, 7);
      h += `<section class="card"><div class="h3">Log</div>${table(["Date", "Session", "Result", "Feel", "Mobility"], rows)}${notes.map((d) => `<div class="sm"><b>${short(d)}</b> ${esc(st.days[d].note)}</div>`).join("")}</section>`;
    }
  }

  if (tab === "settings") {
    const dr = toDrafts(s);
    h += `<section class="card"><div class="h3">Your numbers</div>
      ${field("Deadlift max (lb)", "s-dl", dr.dl, 'type="number" inputmode="decimal"')}
      ${field("Bench: weight (lb)", "s-benchW", dr.benchW, 'type="number" inputmode="decimal"')}
      ${field("Bench: reps at that weight", "s-benchR", dr.benchR, 'type="number" inputmode="numeric"')}
      ${field("Row estimated max (lb)", "s-row1", dr.row1, 'type="number" inputmode="decimal"')}
      ${field("Max pull-ups (reps)", "s-pull", dr.pull, 'type="number" inputmode="numeric"')}
      ${field("Easy run pace (min:sec per mile)", "s-pace", dr.pace, 'inputmode="numeric"')}
      ${field("Starting long run (miles)", "s-longBase", dr.longBase, 'type="number" inputmode="decimal"')}
      ${field("Plan start date, day 1 = long run", "s-start", dr.start, 'type="date"')}
      <button class="big primary" data-action="savesettings">Save numbers</button>${msg ? `<div class="sm">${esc(msg)}</div>` : ""}
      <label class="field"><span>First 4-week block</span><select data-change="phase"><option value="B" ${s.startPhase === "B" ? "selected" : ""}>Hypertrophy (8-15 reps)</option><option value="A" ${s.startPhase === "A" ? "selected" : ""}>Strength (4-8 reps)</option></select></label>
      ${toggleHtml("Sauna usually available", s.saunaDefault, "saunaDef")}${toggleHtml("Pool usually available", s.poolDefault, "poolDef")}</section>`;
    h += `<details class="card"><summary class="h3">How the plan works</summary>${lineList([
      { title: "Weekly order", detail: "Long run, legs, heat/cold recovery, torso, tempo, intervals, arms, following Huberman's foundational fitness protocol." },
      { title: "Phases and deloads", detail: "4-week blocks alternate hypertrophy and strength. Week 4 of every block is a deload: one fewer set, about 10% lighter, runs about 20% shorter, no progression changes." },
      { title: "Push to tomorrow", detail: "That day becomes rest and every later session slides back one day. Nothing is lost." },
      { title: "Lift progression", detail: "Hit every set at the planned reps and weight: next time is your heaviest logged weight +5 lb (or +1 rep). Missed on a normal day: repeat; twice in a row: back off 5 lb. Off day (feel 1-2, or poor sleep, sick, stressed, low fuel): progression kept, or a gentle hold if you logged less than half the sets." },
      { title: "Run progression", detail: "Hit 90% of the planned distance, tempo minutes, or rounds: the next one steps up about 10%. Short on a normal day: repeat it. Off day: kept if you got 60% or more." },
    ])}</details>`;
    h += `<details class="card"><summary class="h3">Heat and cold safety</summary>${lineList(SAFETY)}</details>`;
    h += `<section class="card"><div class="h3">Backup</div>
      <div class="sm">${storageOk ? "Your data is saved on this phone. Download a backup now and then, or to move to a new phone." : "Saving isn't available in this browser. Download a backup before you close the app."}</div>
      <div class="row"><button class="sbtn" data-action="download">Download backup file</button><button class="sbtn" data-action="copy">Copy backup text</button></div>
      <label class="field"><span>Restore: paste backup text</span><textarea id="restore" rows="3" placeholder="Paste backup here"></textarea></label>
      <div class="row"><button class="sbtn" data-action="restore">Restore pasted backup</button><label class="sbtn filebtn">Restore from file<input type="file" accept="application/json,.json" data-change="file" hidden></label></div>
      <div class="row"><button class="sbtn danger" data-action="reset">${confirmReset ? "Tap again to erase everything" : "Reset all data"}</button></div>
      <div class="tiny">Based on Huberman's foundational fitness protocol (hubermanlab.com/newsletter/foundational-fitness-protocol) and his deliberate heat episode.</div></section>`;
  }
  return h + `</main>`;
}

function render(top) {
  $app.innerHTML = stripBar() + (view === "day" ? dayView() : menuView());
  if (top) window.scrollTo(0, 0);
}

/* ---------- events ---------- */
function restoreFrom(text) {
  try {
    const p = JSON.parse(text);
    if (p && p.settings) { st = { ...defState(today), ...p, v: 2, settings: { ...defState(today).settings, ...p.settings } }; save(); msg = "Backup restored."; sel = nextPending(today, st); }
    else msg = "That backup couldn't be read.";
  } catch (e) { msg = "That backup couldn't be read."; }
  render();
}

$app.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  const P = () => planFor(sel);
  switch (a) {
    case "go": go(b.dataset.d); break;
    case "wk": go(addDays(sel, Number(b.dataset.n))); break;
    case "menu": view = view === "menu" ? "day" : "menu"; render(true); break;
    case "tab": tab = b.dataset.v; render(); break;
    case "metric": liftMetric = b.dataset.v; render(); break;
    case "log": { const p = P(); const e = p.ex.find((x) => x.id === b.dataset.ex); const i = Number(b.dataset.i); const v = setVal(p.day, e, i);
      const row = b.closest(".setrow"); const ins = row.querySelectorAll("input");
      const patch = { done: !v.done }; if (!v.done && ins[0]) { patch.r = ins[0].value; if (ins[1]) patch.w = ins[1].value; }
      editSet(sel, e, i, patch); render(); break; }
    case "feel": { const n = Number(b.dataset.n); upDay(sel, (d) => ({ ...d, feel: d.feel === n ? undefined : n })); render(); break; }
    case "tag": { const t = b.dataset.t; upDay(sel, (d) => { const cur = d.tags || []; const on = cur.indexOf(t) >= 0; return { ...d, tags: on ? cur.filter((x) => x !== t) : [...cur, t] }; }); render(); break; }
    case "light": upDay(sel, (d) => ({ ...d, light: !d.light })); render(); break;
    case "sauna": { const v = P().sauna; upDay(sel, (d) => ({ ...d, sauna: !v })); render(); break; }
    case "pool": { const v = P().pool; upDay(sel, (d) => ({ ...d, pool: !v })); render(); break; }
    case "mob": { const id = b.dataset.id; upDay(sel, (d) => { const m = { ...(d.mob || {}) }; if (m[id]) delete m[id]; else m[id] = true; return { ...d, mob: m }; }); render(); break; }
    case "push": push(); break;
    case "unpush": unpush(); break;
    case "done": markDone(); break;
    case "undo": undoStatus(); break;
    case "skip": skip(); break;
    case "saunaDef": setSt((p) => ({ ...p, settings: { ...p.settings, saunaDefault: !p.settings.saunaDefault } })); render(); break;
    case "poolDef": setSt((p) => ({ ...p, settings: { ...p.settings, poolDefault: !p.settings.poolDefault } })); render(); break;
    case "savesettings": {
      const s = st.settings; const g = (id) => document.getElementById(id).value;
      const num = (id, fb) => { const v = Number(g(id)); return isFinite(v) && v > 0 ? v : fb; };
      const pace = parsePace(g("s-pace") || "");
      const start = /^\d{4}-\d{2}-\d{2}$/.test(g("s-start")) ? g("s-start") : s.start;
      const next = { ...s, dl: num("s-dl", s.dl), benchW: num("s-benchW", s.benchW), benchR: num("s-benchR", s.benchR), row1: num("s-row1", s.row1), pull: num("s-pull", s.pull), longBase: num("s-longBase", s.longBase), pace: pace || s.pace, start };
      setSt((p) => ({ ...p, settings: next })); msg = "Saved. Weights and runs are recalculated."; render(); break; }
    case "download": {
      const blob = new Blob([JSON.stringify(st, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const l = document.createElement("a"); l.href = url; l.download = `gym-plan-backup-${today}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); break; }
    case "copy": { const t = JSON.stringify(st); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { msg = "Backup copied."; render(); }).catch(() => { const ta = document.getElementById("restore"); ta.value = t; ta.select(); msg = "Select-all and copy the text in the box."; }); break; }
    case "restore": restoreFrom(document.getElementById("restore").value); break;
    case "reset": if (confirmReset) { st = defState(today); save(); confirmReset = false; sel = today; msg = "All data erased."; } else confirmReset = true; render(); break;
  }
});

$app.addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.dataset.set) {
    const [id, iS, f] = t.dataset.set.split(":"); const i = Number(iS);
    const p = planFor(sel); const e = p.ex.find((x) => x.id === id);
    const row = t.closest(".setrow"); const ins = row.querySelectorAll("input");
    const patch = { done: true, r: ins[0].value }; if (ins[1]) patch.w = ins[1].value;
    editSet(sel, e, i, patch);
    const btn = row.querySelector("[data-logbtn]"); btn.classList.add("on"); btn.textContent = "\u2713";
  } else if (t.dataset.run) {
    const k = t.dataset.run; upDay(sel, (d) => ({ ...d, runIn: { ...(d.runIn || {}), [k]: t.value } }));
    const pe = document.getElementById("pace"); const rp = planFor(sel).run.plan; const ri = (st.days[sel] || {}).runIn || {};
    if (pe && rp) { const dd = numOr(ri.dist, rp.dist) || 0, tt = numOr(ri.time, rp.time) || 0; pe.textContent = dd > 0 && tt > 0 ? `Average pace: ${fmtPace((tt * 60) / dd)}/mi` : ""; }
  } else if (t.dataset.note) {
    upDay(sel, (d) => ({ ...d, note: t.value }));
  }
});

$app.addEventListener("change", (ev) => {
  const t = ev.target;
  const c = t.dataset && t.dataset.change;
  if (c === "hist") { histSel = t.value; render(); }
  else if (c === "phase") { setSt((p) => ({ ...p, settings: { ...p.settings, startPhase: t.value === "A" ? "A" : "B" } })); render(); }
  else if (c === "file" && t.files && t.files[0]) { const r = new FileReader(); r.onload = () => restoreFrom(String(r.result)); r.readAsText(t.files[0]); }
});

/* swipe between days */
let touch0 = null;
$app.addEventListener("touchstart", (ev) => {
  if (view !== "day" || !ev.target.closest("#day") || ev.target.closest("input,textarea,select,button,label,summary")) { touch0 = null; return; }
  const t = ev.changedTouches[0]; touch0 = { x: t.clientX, y: t.clientY };
}, { passive: true });
$app.addEventListener("touchend", (ev) => {
  if (!touch0) return; const t = ev.changedTouches[0]; const dx = t.clientX - touch0.x, dy = t.clientY - touch0.y; touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(addDays(sel, dx < 0 ? 1 : -1));
}, { passive: true });

/* new day while app stays open */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const now = ymd(new Date());
  if (now !== today) { today = now; sel = nextPending(today, st); render(true); }
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ("serviceWorker" in navigator && location.protocol !== "file:") window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
render();
