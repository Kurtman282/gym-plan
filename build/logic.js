const ORDER = ["long", "legs", "recovery", "torso", "tempo", "hiit", "arms"];
const NAMES = { long: "Long Zone 2 run", legs: "Legs", recovery: "Heat/cold + recovery", torso: "Torso + neck", tempo: "Tempo run", hiit: "Intervals (HIIT)", arms: "Arms, calves + neck" };
const TAGS = ["Poor sleep", "Sore", "Sick", "Stressed", "Low fuel", "Great sleep"];
const OFF_TAGS = ["Poor sleep", "Sick", "Stressed", "Low fuel"];
const LIFTS = [{ label: "Bench", ids: ["bench"] }, { label: "Deadlift / RDL", ids: ["dl", "rdl"] }, { label: "Row", ids: ["row"] }];
const KEY = "kurt-gym-plan-v2";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOWF = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const p = s.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};
const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const diff = (a, b) => {
  const x = parse(a);
  const y = parse(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5);
};
const mod = (n, m) => (n % m + m) % m;
const r5 = (x) => Math.round(x / 5) * 5;
const fmtPace = (sec) => `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60) % 60)}`;
const parsePace = (s) => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};
const short = (s) => {
  const d = parse(s);
  return `${DOW[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
};
const numOr = (s, fb) => {
  if (s === void 0 || s.trim() === "") return fb;
  const v = Number(s);
  return isFinite(v) ? v : fb;
};
function defState(today) {
  const dow = parse(today).getDay();
  return { v: 2, settings: { dl: 370, benchW: 135, benchR: 16, row1: 165, pull: 18, pace: 570, longBase: 3.5, start: addDays(today, -dow), startPhase: "B", saunaDefault: false, poolDefault: false }, pushes: [], days: {}, steps: {}, misses: {}, runLv: {} };
}
function loadState(today) {
  let s = defState(today);
  let ok = false;
  try {
    const ls = window.localStorage;
    ls.setItem(KEY + "_t", "1");
    ls.removeItem(KEY + "_t");
    ok = true;
    const raw = ls.getItem(KEY) || ls.getItem("kurt-gym-plan-v1");
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.settings) s = { ...s, ...p, v: 2, settings: { ...s.settings, ...p.settings } };
    }
  } catch (e) {
    ok = false;
  }
  return { s, ok };
}
function sessionFor(date, st) {
  const start = st.settings.start;
  const before = st.pushes.filter((p) => p >= start && p < date).length;
  return ORDER[mod(diff(start, date) - before, 7)];
}
function phaseFor(date, st) {
  const days = Math.max(0, diff(st.settings.start, date));
  const block = Math.floor(days / 28);
  const other = st.settings.startPhase === "A" ? "B" : "A";
  const week = Math.floor(days % 28 / 7) + 1;
  return { phase: block % 2 === 0 ? st.settings.startPhase : other, block: block + 1, week, deload: week === 4 };
}
function nextPending(from, st) {
  for (let i = 0; i < 21; i++) {
    const d = addDays(from, i);
    const x = st.days[d];
    if (st.pushes.indexOf(d) >= 0) continue;
    if (x && x.status) continue;
    return d;
  }
  return from;
}
function isOff(d) {
  return d.feel !== void 0 && d.feel <= 2 || !!d.light || (d.tags || []).some((t) => OFF_TAGS.indexOf(t) >= 0);
}
function mk(o, c) {
  const step = c.steps[`${c.phase}:${o.id}`] || 0;
  const sets = c.light || c.deload ? Math.max(2, o.sets - 1) : o.sets;
  let repsN = o.reps;
  let load = "";
  let w = null;
  let prog = "w";
  const baseW = r5(o.base);
  if (o.kind === "bw") {
    repsN = Math.max(3, o.reps + step - (c.light ? 2 : 0));
    load = "Bodyweight";
    prog = "r";
  } else if (o.kind === "fixed") {
    w = o.base > 0 ? o.base : null;
    load = o.base > 0 ? `${o.base} lb plate` : "Bodyweight";
    prog = "none";
  } else {
    let x = Math.max(5, baseW + 5 * step);
    if (c.deload) x = Math.max(5, r5(x * 0.9));
    if (c.light) x = Math.max(5, r5(x * 0.9));
    w = x;
    load = o.kind === "lb" ? `${x} lb` : o.kind === "db" ? `${x} lb each hand` : `+${x} lb`;
  }
  const rest = o.rest >= 120 ? `${o.rest / 60} min` : `${o.rest} s`;
  return { id: o.id, name: o.name, sets, repsN, reps: `${repsN}${o.perLeg ? "/leg" : ""}`, load, w, baseW, kind: o.kind, rest, restSec: o.rest, note: o.note, prog, perLeg: o.perLeg };
}
function liftList(key, s, c) {
  const A = c.phase === "A";
  const b1 = r5(s.benchW * (1 + s.benchR / 30));
  const L = [];
  const m = (o) => {
    L.push(mk(o, c));
  };
  const neck = { id: "neck", name: "Neck flexion + extension", sets: 2, reps: 15, base: 10, kind: "fixed", rest: 60, note: "Lie on a bench, plate on forehead, then face-down for extension. Slow and light; skip if your neck feels off." };
  if (key === "legs") {
    if (A) {
      m({ id: "dl", name: "Deadlift", sets: 4, reps: 5, base: s.dl * 0.8, kind: "lb", rest: 180, note: "Conventional or trap bar. Stop each set with 1-2 reps in the tank." });
      m({ id: "bss", name: "Bulgarian split squat", sets: 3, reps: 6, base: s.dl * 0.135, kind: "db", rest: 120, perLeg: true, note: "Goblet squat is a fine swap." });
      m({ id: "curl", name: "Leg curl", sets: 3, reps: 8, base: s.dl * 0.3, kind: "lb", rest: 120, note: "Machines vary, so adjust the stack." });
      m({ id: "ext", name: "Leg extension", sets: 3, reps: 8, base: s.dl * 0.35, kind: "lb", rest: 90 });
      m({ id: "calf", name: "Standing calf raise", sets: 3, reps: 10, base: s.dl * 0.4, kind: "lb", rest: 60, note: "Full stretch at the bottom." });
    } else {
      m({ id: "rdl", name: "Romanian deadlift", sets: 3, reps: 10, base: s.dl * 0.55, kind: "lb", rest: 120, note: "Slow 3-second lower, soft knees." });
      m({ id: "bss", name: "Bulgarian split squat", sets: 3, reps: 10, base: s.dl * 0.1, kind: "db", rest: 90, perLeg: true, note: "Goblet squat or leg press are fine swaps." });
      m({ id: "curl", name: "Leg curl", sets: 3, reps: 12, base: s.dl * 0.25, kind: "lb", rest: 75, note: "Machines vary, so adjust the stack." });
      m({ id: "ext", name: "Leg extension", sets: 3, reps: 12, base: s.dl * 0.3, kind: "lb", rest: 75 });
      m({ id: "calf", name: "Standing calf raise", sets: 3, reps: 15, base: s.dl * 0.3, kind: "lb", rest: 60 });
    }
    m({ id: "tib", name: "Tibialis raise", sets: 2, reps: 15, base: 0, kind: "fixed", rest: 45, note: "Back against a wall, heels forward, lift your toes." });
  } else if (key === "torso") {
    if (A) {
      m({ id: "bench", name: "Bench press", sets: 4, reps: 5, base: b1 * 0.82, kind: "lb", rest: 90, note: "Superset with pull-ups: bench, 90 s, pull-ups, 90 s." });
      if (s.pull >= 10) m({ id: "pull", name: "Weighted pull-up", sets: 4, reps: 5, base: s.pull * 1.25, kind: "add", rest: 90, note: "Dip belt or a dumbbell between the feet." });
      else m({ id: "pullbw", name: "Pull-up", sets: 4, reps: Math.max(3, Math.round(s.pull * 0.6)), base: 0, kind: "bw", rest: 90 });
      m({ id: "row", name: "Barbell row", sets: 3, reps: 6, base: s.row1 * 0.8, kind: "lb", rest: 120, note: "Starting guess. Log what you actually use and the plan follows." });
      m({ id: "incl", name: "Incline dumbbell press", sets: 3, reps: 8, base: b1 * 0.25, kind: "db", rest: 90 });
      m({ id: "lat", name: "Lateral raise", sets: 3, reps: 10, base: b1 * 0.1, kind: "db", rest: 60 });
    } else {
      m({ id: "bench", name: "Bench press", sets: 3, reps: 10, base: b1 * 0.7, kind: "lb", rest: 90 });
      m({ id: "pullbw", name: "Pull-up", sets: 3, reps: Math.max(3, Math.round(s.pull * 0.6)), base: 0, kind: "bw", rest: 90, note: "Full hang at the bottom, chin over the bar." });
      m({ id: "row", name: "Barbell row", sets: 3, reps: 10, base: s.row1 * 0.7, kind: "lb", rest: 90, note: "Starting guess. Log what you actually use and the plan follows." });
      m({ id: "incl", name: "Incline dumbbell press", sets: 3, reps: 12, base: b1 * 0.2, kind: "db", rest: 75 });
      m({ id: "lat", name: "Lateral raise", sets: 3, reps: 15, base: b1 * 0.075, kind: "db", rest: 60 });
    }
    m(neck);
  } else if (key === "arms") {
    if (A) {
      m({ id: "dip", name: "Weighted dip", sets: 3, reps: 6, base: s.pull * 0.7, kind: "add", rest: 120 });
      m({ id: "ohe", name: "Overhead triceps extension", sets: 3, reps: 8, base: b1 * 0.25, kind: "lb", rest: 90, note: "Cable or one dumbbell." });
      m({ id: "icurl", name: "Incline dumbbell curl", sets: 3, reps: 8, base: b1 * 0.14, kind: "db", rest: 90 });
      m({ id: "pcurl", name: "EZ-bar preacher curl", sets: 3, reps: 8, base: b1 * 0.3, kind: "lb", rest: 90 });
      m({ id: "scalf", name: "Seated calf raise", sets: 4, reps: 8, base: s.dl * 0.25, kind: "lb", rest: 60 });
    } else {
      m({ id: "dipbw", name: "Dip", sets: 3, reps: Math.max(5, Math.round(s.pull * 0.8)), base: 0, kind: "bw", rest: 75 });
      m({ id: "ohe", name: "Overhead triceps extension", sets: 3, reps: 12, base: b1 * 0.2, kind: "lb", rest: 60, note: "Cable or one dumbbell." });
      m({ id: "icurl", name: "Incline dumbbell curl", sets: 3, reps: 12, base: b1 * 0.11, kind: "db", rest: 60 });
      m({ id: "pcurl", name: "EZ-bar preacher curl", sets: 3, reps: 12, base: b1 * 0.22, kind: "lb", rest: 60 });
      m({ id: "scalf", name: "Seated calf raise", sets: 3, reps: 15, base: s.dl * 0.2, kind: "lb", rest: 60 });
    }
    m(neck);
  }
  return L;
}
const WARM = {
  long: "5 min brisk walk, leg swings and ankle circles, then ease into the run.",
  legs: "8 min: easy bike or incline walk, leg swings, 10 bodyweight split squats, then 2 ramp-up sets of the first lift.",
  recovery: "",
  torso: "8 min: rower, 20 band pull-aparts, arm circles, then 2 ramp-up bench sets.",
  tempo: "",
  hiit: "",
  arms: "6 min: rower or bike, then light band curls and pushdowns x15."
};
function runPlan(key, s, lv, light, deload) {
  const p = s.pace;
  if (key === "long") {
    const n = lv.long || 0;
    let d = Math.min(s.longBase * Math.pow(1.1, n), 3600 / (p + 15));
    if (deload) d *= 0.8;
    if (light) d *= 0.7;
    d = Math.max(1, Math.round(d * 4) / 4);
    const t = Math.round(d * (p + 15) / 60);
    return {
      est: t + 10,
      plan: { dist: d, time: t },
      lines: [
        { title: "Warm up", detail: "5 min brisk walk, leg swings, ankle circles." },
        { title: `Run ${d} miles easy`, detail: `About ${t} min at ${fmtPace(p)}-${fmtPace(p + 30)}/mi. Conversational: full sentences.` },
        { title: "Cool down", detail: "5 min walk, then 5 min of static stretches (30-60 s each)." }
      ]
    };
  }
  if (key === "tempo") {
    const n = lv.tempo || 0;
    let T = Math.min(15 + 2 * n, 30);
    if (deload) T = Math.round(T * 0.8);
    if (light) T = Math.round(T * 0.6);
    const dist = Math.round((10 * 60 / p + T * 60 / (p - 67) + 6 * 60 / p) * 4) / 4;
    return {
      est: 10 + T + 8,
      plan: { dist, time: 16 + T, main: T, mainLabel: "tempo min" },
      lines: [
        { title: "Warm up: 10 min easy", detail: `About 1 mile at ${fmtPace(p)}/mi.` },
        { title: `Tempo: ${T} min steady`, detail: `${fmtPace(p - 75)}-${fmtPace(p - 60)}/mi, about 75-80% effort. A few words at a time.${T >= 20 ? ` OK to split into 2 x ${Math.round(T / 2)} min with 2 min easy between.` : ""}` },
        { title: "Cool down: 5-8 min easy", detail: "Then 3-5 min of slow breathing." }
      ]
    };
  }
  if (key === "hiit") {
    const n = lv.hiit || 0;
    let rounds = Math.min(6 + n, 10);
    if (deload) rounds = Math.max(4, rounds - 2);
    if (light) rounds = Math.max(4, rounds - 3);
    const fin = n >= 4 && !light && !deload;
    return {
      est: Math.round(10 + rounds * 2.5 + (fin ? 4 : 0) + 13),
      plan: { main: rounds, mainLabel: "rounds" },
      lines: [
        { title: "Warm up: 10 min easy", detail: "Jog or bike, with three 20 s pickups." },
        { title: `${rounds} rounds: 60 s hard / 90 s easy`, detail: "About 90% effort. Bike or rower is easiest on your legs while mileage rebuilds; hill sprints if you feel fresh." },
        ...fin ? [{ title: "Finisher: 8 x 20 s all-out / 10 s easy", detail: "Bike or rower only." }] : [],
        { title: "Core: 8 min", detail: "Hanging knee or leg raises 3 x 10, plank 2 x 45 s." },
        { title: "Cool down: 5 min easy", detail: "Walk or spin until your breathing settles." }
      ]
    };
  }
  return { lines: [], est: 0 };
}
function recoveryLines(key, sauna, pool) {
  const heat = sauna ? "Sauna at 176-200\xB0F" : "Hot tub at 102-104\xB0F, water up to your neck";
  if (key === "recovery") {
    return [
      pool ? { title: "15-20 min easy swim or pool walking", detail: "Active recovery. Pools are too warm to count as cold exposure." } : { title: "20-30 min easy walk", detail: "Outside if you can. Keep it truly easy." },
      { title: "10 min mobility", detail: "Static stretches, 30-60 s per muscle group, long slow exhales." },
      sauna ? { title: "Contrast x3: 12-15 min sauna, 1-3 min cold shower", detail: "Sauna at 176-200\xB0F. End on cold. About 40 min of heat." } : { title: "Contrast x3: 10-12 min hot tub, 1-2 min cold shower", detail: "Hot tub at 102-104\xB0F. End on cold. Sit out a minute between rounds if lightheaded." },
      { title: "5 min downshift", detail: "Slow breathing or a short NSDR session." }
    ];
  }
  const lift = key === "legs" || key === "torso" || key === "arms";
  const out = [];
  if (lift) {
    out.push({ title: "3-5 min slow breathing right after", detail: "Helps you downshift after lifting." });
    out.push({ title: sauna ? "Optional: 15 min sauna" : "Optional: 12-15 min hot tub", detail: `${heat}. After lifting or later in the day.` });
    out.push({ title: "No cold plunge for 6-8 hours", detail: "Ice baths right after lifting can blunt strength and size gains. A cool shower is fine." });
  } else {
    out.push({ title: key === "hiit" ? "Cool down until breathing settles" : "5 min stretch after the run", detail: "Calves, hamstrings, hip flexors, 30-60 s each." });
    if (key !== "hiit") out.push({ title: sauna ? "15 min sauna" : "12-15 min hot tub", detail: heat + "." });
    out.push({ title: "1-3 min cold shower", detail: "OK on run days. Counts toward about 11 min of cold for the week." });
  }
  if (pool) out.push({ title: "Optional: 10 min easy swim or water walking", detail: "Loosens up the legs." });
  return out;
}
const SAFETY = [
  { title: "Weekly target", detail: "About 57 min of heat and 11 min of cold, split across sessions. Build up from shorter bouts." },
  { title: "Hydrate", detail: "16-24 oz of water with electrolytes for each heat session." },
  { title: "Limits", detail: "Hot tub no hotter than 104\xB0F and 15-20 min per bout. Sauna rounds 20 min max. Get out if you feel dizzy, nauseous, or your heart races." },
  { title: "Be smart", detail: "No alcohol with heat. Stand up slowly. Never do cold water immersion alone. Check with a doctor if you have heart or blood pressure issues." }
];
const fill = (vals) => {
  const first = vals.find((v) => v !== null);
  let last = first === void 0 || first === null ? 0 : first;
  return vals.map((v) => {
    if (v !== null) last = v;
    return last;
  });
};
const wkLabel = (i, n, w) => n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0 ? `W${w}` : "";
