/* ---------- Mobility & static stretching ---------- */
// side: true = do each side. hold in seconds.
const STRETCH = {
  couch: { name: "Couch stretch", hold: 45, side: true, cues: ["Back knee on the floor against a wall or couch, shin up the wall, other foot forward.", "Squeeze the glute of the back leg and stay tall.", "Feel it in the front of the thigh and hip; back off if it pinches."] },
  kneelhf: { name: "Half-kneeling hip flexor stretch", hold: 45, side: true, cues: ["One knee down, other foot forward, like a lunge.", "Tuck your hips under and squeeze the back glute.", "Shift forward a little until you feel the front of the hip."] },
  ninety: { name: "90/90 hip stretch", hold: 45, side: true, cues: ["Sit with the front leg bent 90 degrees in front, back leg bent 90 degrees out to the side.", "Sit tall, then lean your chest over the front shin.", "Feel it in the outside of the front hip."] },
  butterfly: { name: "Butterfly stretch", hold: 45, side: false, cues: ["Sit with the soles of your feet together, knees out.", "Hold your feet, sit tall, then fold forward slightly.", "Feel it in the inner thighs."] },
  pigeon: { name: "Pigeon stretch", hold: 45, side: true, cues: ["From hands and knees, bring one knee forward behind your wrist, shin angled across.", "Slide the other leg straight back.", "Fold forward over the front leg; feel it deep in the glute."] },
  fig4: { name: "Lying figure-4 stretch", hold: 45, side: true, cues: ["On your back, cross one ankle over the opposite knee.", "Pull the bottom thigh toward your chest.", "Keep the crossed foot flexed; feel it in the glute."] },
  seatham: { name: "Seated hamstring stretch", hold: 45, side: true, cues: ["Sit with one leg straight, the other foot against your inner thigh.", "Hinge from the hips with a flat back and reach toward the foot.", "Feel it behind the thigh, not the low back."] },
  strapham: { name: "Lying hamstring stretch (towel)", hold: 45, side: true, cues: ["On your back, loop a towel or band around one foot.", "Raise the straight leg until you feel the back of the thigh.", "Keep the other leg flat on the floor."] },
  calfwall: { name: "Calf wall stretch", hold: 45, side: true, cues: ["Hands on a wall, one foot stepped back.", "Back knee straight, heel down, toes pointing forward.", "Lean in until you feel the calf."] },
  soleus: { name: "Bent-knee calf stretch", hold: 45, side: true, cues: ["Same wall position, but bend the back knee.", "Keep that heel down.", "Feel it low in the calf, near the Achilles."] },
  quadstand: { name: "Standing quad stretch", hold: 45, side: true, cues: ["Hold a wall and pull one heel toward your glute.", "Keep knees together and hips pushed slightly forward.", "Feel it in the front of the thigh."] },
  sidequad: { name: "Side-lying quad stretch", hold: 45, side: true, cues: ["Lie on your side and grab your top ankle.", "Pull the heel to your glute with the knee slightly behind your hip.", "Feel it in the front of the thigh."] },
  itband: { name: "Standing outer hip stretch", hold: 30, side: true, cues: ["Cross one leg behind the other.", "Push that back hip out to the side.", "Reach the same arm overhead and lean the other way."] },
  twist: { name: "Lying spinal twist", hold: 45, side: true, cues: ["On your back, pull one knee across your body toward the floor.", "Arm out to the side, look the other way.", "Keep both shoulders down; breathe into the side."] },
  doorway: { name: "Doorway chest stretch", hold: 45, side: true, cues: ["Forearm on a door frame, elbow at shoulder height.", "Step through with the same-side foot.", "Feel it across the chest; keep the shoulder down."] },
  latrack: { name: "Lat stretch at a rack", hold: 45, side: true, cues: ["Hold a rack post or bench with one hand, arm straight.", "Sit your hips back and away.", "Let the side of your back lengthen."] },
  latbench: { name: "Kneeling bench lat stretch", hold: 45, side: false, cues: ["Kneel, elbows on a bench, hands together behind your head.", "Sit your hips back toward your heels.", "Let your chest sink to the floor; feel it in the lats."] },
  openbook: { name: "Open-book upper back stretch", hold: 30, side: true, cues: ["Lie on your side, knees bent, arms straight out in front.", "Open the top arm across to the other side, eyes following the hand.", "Keep knees together and hold at the end."] },
  needle: { name: "Thread the needle", hold: 45, side: true, cues: ["On hands and knees, slide one arm under your body along the floor.", "Rest that shoulder and the side of your head down.", "Feel it in the upper back and shoulder."] },
  child: { name: "Child's pose", hold: 60, side: false, cues: ["Knees wide, sit hips back toward your heels.", "Reach arms long in front, forehead down.", "Breathe slowly into your back."] },
  crossbody: { name: "Cross-body shoulder stretch", hold: 30, side: true, cues: ["Bring one arm straight across your chest.", "Pull it in just above the elbow with the other hand.", "Keep the shoulder down, away from your ear."] },
  sleeper: { name: "Sleeper stretch", hold: 30, side: true, cues: ["Lie on one side, bottom arm out at shoulder height, elbow bent 90 degrees.", "Use the top hand to gently press the forearm toward the floor.", "Keep it light; stop at a mild stretch."] },
  biceps: { name: "Biceps wall stretch", hold: 30, side: true, cues: ["Palm flat on a wall behind you at shoulder height, thumb up.", "Slowly turn your body away from the wall.", "Feel it in the front of the arm and shoulder."] },
  triceps: { name: "Overhead triceps stretch", hold: 30, side: true, cues: ["Reach one arm up, bend the elbow, hand down your back.", "Ease the elbow back with the other hand.", "Keep your ribs down; don't arch."] },
  wristflex: { name: "Wrist flexor stretch", hold: 30, side: true, cues: ["Arm straight in front, palm up.", "Gently pull your fingers back with the other hand.", "Feel it on the inside of the forearm."] },
  wristext: { name: "Wrist extensor stretch", hold: 30, side: true, cues: ["Arm straight in front, palm down.", "Bend the wrist down and gently pull the hand toward you.", "Feel it on the top of the forearm."] },
  neckside: { name: "Neck side bend", hold: 30, side: true, cues: ["Sit tall and drop one ear toward your shoulder.", "Reach the opposite hand down toward the floor.", "Light pressure only; breathe slowly."] },
  levator: { name: "Upper neck/trap stretch", hold: 30, side: true, cues: ["Turn your head about 45 degrees and look down toward your armpit.", "Rest the same-side hand on the back of your head; let its weight do the work.", "Feel it at the back of the neck and top of the shoulder."] },
  frog: { name: "Frog stretch", hold: 45, side: false, cues: ["On hands and knees, slide your knees wide, feet out to the sides.", "Rock your hips back slowly.", "Feel it in the inner thighs; stay gentle."] },
  sphinx: { name: "Sphinx", hold: 45, side: false, cues: ["Lie face down, propped on your forearms.", "Let your hips and low back relax into the floor.", "Feel a gentle stretch through the abs and hips."] },
};
// Each slot lists variations; the week number rotates through them.
const MOB_PLAN = {
  legs: [["couch", "kneelhf"], ["ninety", "butterfly"], ["seatham", "strapham"], ["pigeon", "fig4"], ["calfwall", "soleus"]],
  torso: [["doorway"], ["latrack", "latbench"], ["openbook", "needle"], ["child"], ["crossbody", "sleeper"]],
  arms: [["biceps"], ["triceps"], ["wristflex"], ["wristext"], ["neckside", "levator"], ["doorway", "crossbody"]],
  run: [["calfwall", "soleus"], ["kneelhf", "couch"], ["strapham", "seatham"], ["fig4", "pigeon"], ["quadstand", "sidequad"], ["itband", "twist"]],
  recovery: [["couch", "kneelhf"], ["pigeon", "ninety"], ["strapham", "seatham"], ["calfwall", "soleus"], ["butterfly", "frog"], ["doorway"], ["needle", "openbook"], ["child"], ["neckside", "levator"], ["twist"], ["sphinx"]],
};
function mobilityFor(key, d, st) {
  const plan = MOB_PLAN[key === "long" || key === "tempo" || key === "hiit" ? "run" : key] || MOB_PLAN.recovery;
  const wk = Math.floor(Math.max(0, diff(st.settings.start, d)) / 7);
  const list = plan.map((slot, i) => { const id = slot[(wk + i) % slot.length]; return { id, ...STRETCH[id] }; });
  const secs = list.reduce((a, s) => a + s.hold * (s.side ? 2 : 1) + 15, 0);
  return { list, min: Math.round(secs / 60) };
}
