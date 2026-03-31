import { useState, useEffect } from "react";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

// ─── STORAGE LAYER ───
const DB = {
  get: async (k) => { try { const v = localStorage.getItem("rf_" + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: async (k, v) => { try { localStorage.setItem("rf_" + k, JSON.stringify(v)); } catch {} },
  del: async (k) => { try { localStorage.removeItem("rf_" + k); } catch {} },
};

// ─── THEME ───
const themes = {
  dark: { bg:"#0a0a0f", card:"#151520", cardAlt:"#1a1a28", border:"#252535", text:"#e8e8f0", sub:"#9999aa",
    muted:"#666680", accent:"#E94560", accent2:"#0F3460", grad:"linear-gradient(135deg,#0F3460,#E94560)",
    green:"#27AE60", yellow:"#F39C12", red:"#E74C3C", inputBg:"#1e1e2e", inputBorder:"#333350" },
  light: { bg:"#f5f5f8", card:"#ffffff", cardAlt:"#fafafe", border:"#e2e2ea", text:"#1a1a2e", sub:"#555570",
    muted:"#8888a0", accent:"#E94560", accent2:"#0F3460", grad:"linear-gradient(135deg,#0F3460,#E94560)",
    green:"#27AE60", yellow:"#F39C12", red:"#E74C3C", inputBg:"#f0f0f5", inputBorder:"#d0d0dd" },
};

// ─── PROGRAM GENERATION ENGINE ───
function generateProgram(ans) {
  const w = parseFloat(ans.weight) || 170;
  const h_in = ans.units === "metric" ? (parseFloat(ans.height_cm) || 170) / 2.54 : ((parseFloat(ans.height_ft) || 5) * 12 + (parseFloat(ans.height_in) || 9));
  const age = parseInt(ans.age) || 25;
  const isMale = (ans.sex || "Male").toLowerCase() === "male";
  const wKg = w * 0.453592;
  const hCm = h_in * 2.54;
  const bmr = isMale ? 10 * wKg + 6.25 * hCm - 5 * age + 5 : 10 * wKg + 6.25 * hCm - 5 * age - 161;
  const actMult = { "Sedentary": 1.2, "Lightly Active": 1.375, "Moderately Active": 1.55, "Very Active": 1.725 };
  const tdee = Math.round(bmr * (actMult[ans.activity] || 1.55));
  const goalAdj = { "Build Muscle": 300, "Lose Fat": -400, "Recomposition": 0, "Strength": 250, "General Fitness": 0 };
  const cals = tdee + (goalAdj[ans.goal] || 0);
  const protG = Math.round(w * (ans.goal === "Build Muscle" || ans.goal === "Strength" ? 1.0 : 0.8));
  const fatG = Math.round(cals * 0.28 / 9);
  const carbG = Math.round((cals - protG * 4 - fatG * 9) / 4);

  const hasBack = (ans.injuries || []).includes("Back/Spine");
  const hasShoulder = (ans.injuries || []).includes("Shoulder");
  const hasKnee = (ans.injuries || []).includes("Knee");
  const isFullGym = (ans.gym_access || "").includes("Full");

  const daysNum = parseInt(ans.days) || 3;
  const gymDays = ans.gym_days || [];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const splits = daysNum <= 2
    ? [
        { name: "Upper", focus: "Chest, Back, Shoulders, Arms", exercises: [
          { name: hasBack ? "Incline DB Press" : "Bench Press", sets: 4, reps: "8-10", rpe: "8", swap: hasShoulder ? "Machine Chest Press" : null, cue: "Retract shoulder blades, drive through chest" },
          { name: hasBack ? "Lat Pulldown" : "Barbell Row", sets: 4, reps: "8-10", rpe: "8", swap: "Cable Row", cue: hasBack ? "Full stretch, squeeze lats" : "Hinge at hips, pull to navel" },
          { name: hasShoulder ? "Lateral Raises" : "Overhead Press", sets: 3, reps: "10-12", rpe: "7-8", cue: "Brace core, controlled movement" },
          { name: "Face Pull", sets: 3, reps: "15-20", rpe: "6-7", cue: "Pull to forehead, externally rotate" },
          { name: "Barbell Curl", sets: 3, reps: "10-12", rpe: "7", cue: "No swinging, control eccentric" },
          { name: "Tricep Pushdown", sets: 3, reps: "10-12", rpe: "7", cue: "Lock elbows at sides" },
        ]},
        { name: "Lower", focus: "Quads, Hamstrings, Glutes, Calves", exercises: [
          { name: hasBack ? "Leg Press" : (hasKnee ? "Box Squat" : "Barbell Squat"), sets: 4, reps: "8-10", rpe: "8", swap: "Goblet Squat", cue: hasBack ? "Feet high & wide" : "Break at hips and knees" },
          { name: hasKnee ? "Leg Press (narrow)" : "Romanian Deadlift", sets: 3, reps: "8-10", rpe: "7-8", swap: hasBack ? "Glute Bridge" : null, cue: "Hinge pattern, slight knee bend" },
          { name: "Leg Extension", sets: 3, reps: "12-15", rpe: "7-8", cue: "Pause at top, control negative" },
          { name: "Leg Curl", sets: 3, reps: "10-12", rpe: "7-8", cue: "Don't let hips rise off pad" },
          { name: "Walking Lunges", sets: 3, reps: "12 each", rpe: "7", swap: hasKnee ? "Step-Ups" : null, cue: "Long stride, upright torso" },
          { name: "Standing Calf Raise", sets: 4, reps: "12-15", rpe: "8", cue: "Full stretch, 2-sec squeeze at top" },
        ]},
      ]
    : daysNum <= 3
    ? [
        { name: "Push", focus: "Chest, Shoulders, Triceps", exercises: [
          { name: hasBack ? "Incline DB Press" : "Barbell Bench Press", sets: 4, reps: "8-10", rpe: "8", swap: hasShoulder ? "Machine Chest Press" : null, cue: "Retract shoulder blades, arch slightly, press through chest" },
          { name: "Incline Dumbbell Press", sets: 3, reps: "10-12", rpe: "7-8", cue: "30° incline, squeeze at top" },
          { name: hasShoulder ? "Lateral Raises" : "Overhead Press", sets: 3, reps: hasShoulder ? "12-15" : "8-10", rpe: "7-8", cue: hasShoulder ? "Slight lean, control the negative" : "Brace core, press overhead" },
          { name: "Cable Lateral Raise", sets: 3, reps: "12-15", rpe: "7", cue: "Lead with elbow, slight pause at top" },
          { name: "Tricep Pushdown", sets: 3, reps: "10-12", rpe: "7-8", cue: "Lock elbows at sides, squeeze at bottom" },
          { name: "Overhead Tricep Extension", sets: 3, reps: "10-12", rpe: "7", cue: "Keep elbows pointing forward" },
        ]},
        { name: "Pull", focus: "Back, Biceps, Rear Delts", exercises: [
          { name: hasBack ? "Lat Pulldown" : "Barbell Row", sets: 4, reps: "8-10", rpe: "8", swap: "Cable Row", cue: hasBack ? "Full stretch at top, squeeze at bottom" : "Hinge at hips, pull to navel" },
          { name: hasBack ? "Chest-Supported Row" : "Pendlay Row", sets: 3, reps: "8-10", rpe: "7-8", cue: "Chest supported removes spinal load" },
          { name: "Face Pull", sets: 3, reps: "15-20", rpe: "6-7", cue: "Pull to forehead, externally rotate" },
          { name: "Lat Pulldown", sets: 3, reps: "10-12", rpe: "7-8", cue: "Wide grip, lean back slightly" },
          { name: "Barbell Curl", sets: 3, reps: "10-12", rpe: "7-8", cue: "No swinging, control eccentric" },
          { name: "Hammer Curl", sets: 3, reps: "10-12", rpe: "7", cue: "Neutral grip, squeeze brachialis" },
        ]},
        { name: "Legs", focus: "Quads, Hamstrings, Glutes, Calves", exercises: [
          { name: hasBack ? "Leg Press" : (hasKnee ? "Box Squat" : "Barbell Squat"), sets: 4, reps: "8-10", rpe: "8", swap: "Goblet Squat", cue: hasBack ? "Feet high & wide, control the negative" : "Break at hips and knees simultaneously" },
          { name: hasKnee ? "Leg Press (narrow)" : "Romanian Deadlift", sets: 3, reps: "8-10", rpe: "7-8", swap: hasBack ? "Glute Bridge" : null, cue: "Hinge pattern, slight knee bend" },
          { name: "Leg Extension", sets: 3, reps: "12-15", rpe: "7-8", cue: "Pause at top, control the negative" },
          { name: "Leg Curl", sets: 3, reps: "10-12", rpe: "7-8", cue: "Don't let hips rise off pad" },
          { name: "Walking Lunges", sets: 3, reps: "12 each", rpe: "7", swap: hasKnee ? "Step-Ups" : null, cue: "Long stride, upright torso" },
          { name: "Standing Calf Raise", sets: 4, reps: "12-15", rpe: "8", cue: "Full stretch, 2-sec squeeze at top" },
        ]},
      ]
    : daysNum === 4
    ? [
        { name: "Upper A", focus: "Chest & Back (Strength)", exercises: [
          { name: hasBack ? "Incline DB Press" : "Bench Press", sets: 4, reps: "6-8", rpe: "8", swap: hasShoulder ? "Machine Chest Press" : null, cue: "Drive feet, arch, chest up" },
          { name: hasBack ? "Chest-Supported Row" : "Barbell Row", sets: 4, reps: "6-8", rpe: "8", swap: "Cable Row", cue: hasBack ? "Chest pad, squeeze lats" : "Hinge, pull to sternum" },
          { name: hasShoulder ? "Lateral Raises" : "Overhead Press", sets: 3, reps: hasShoulder ? "12-15" : "8-10", rpe: "7-8", cue: hasShoulder ? "Lead with elbow, controlled" : "Brace core, strict press" },
          { name: "Lat Pulldown", sets: 3, reps: "10-12", rpe: "7-8", cue: "Full stretch, squeeze lats" },
          { name: "Lateral Raise", sets: 3, reps: "12-15", rpe: "7", cue: "Lead with elbow" },
          { name: "Tricep Pushdown", sets: 3, reps: "10-12", rpe: "7", cue: "Lock elbows" },
        ]},
        { name: "Lower A", focus: "Quads & Glutes", exercises: [
          { name: hasBack ? "Leg Press" : (hasKnee ? "Box Squat" : "Squat"), sets: 4, reps: hasKnee ? "10-12" : "6-8", rpe: "8", swap: "Goblet Squat", cue: hasBack ? "Feet high & wide" : "Break at hips and knees" },
          { name: hasBack ? "Glute Bridge" : (hasKnee ? "Leg Press" : "Romanian Deadlift"), sets: 3, reps: "8-10", rpe: "7-8", swap: "Leg Curl", cue: hasBack ? "Drive through heels" : "Hinge, slight knee bend" },
          { name: "Leg Press", sets: 3, reps: "10-12", rpe: "7-8", cue: "Feet high & wide" },
          { name: "Leg Curl", sets: 3, reps: "10-12", rpe: "7-8", cue: "Don't lift hips" },
          { name: hasKnee ? "Step-Ups" : "Walking Lunges", sets: 3, reps: "12 each", rpe: "7", swap: hasKnee ? "Glute Bridge" : "Step-Ups", cue: "Long stride" },
          { name: "Calf Raise", sets: 4, reps: "12-15", rpe: "8", cue: "Full ROM" },
        ]},
        { name: "Upper B", focus: "Chest & Back (Hypertrophy)", exercises: [
          { name: hasBack ? "Machine Chest Press" : "Incline DB Press", sets: 4, reps: "10-12", rpe: "7-8", swap: hasShoulder ? "Cable Flye" : null, cue: "Squeeze at top" },
          { name: hasBack ? "Machine Row" : "Cable Row", sets: 4, reps: "10-12", rpe: "7-8", cue: "Retract scapulae" },
          { name: hasShoulder ? "Cable Lateral Raise" : "DB Shoulder Press", sets: 3, reps: "10-12", rpe: "7-8", cue: hasShoulder ? "Controlled movement" : "Control path" },
          { name: "Face Pull", sets: 3, reps: "15-20", rpe: "6-7", cue: "External rotate" },
          { name: "EZ Bar Curl", sets: 3, reps: "10-12", rpe: "7", cue: "No swing" },
          { name: "Overhead Extension", sets: 3, reps: "10-12", rpe: "7", cue: "Elbows forward" },
        ]},
        { name: "Lower B", focus: "Hamstrings & Posterior", exercises: [
          { name: hasBack ? "Trap Bar Deadlift" : "Deadlift", sets: 4, reps: "5-6", rpe: "8", swap: hasBack ? "Rack Pull" : "Trap Bar DL", cue: hasBack ? "Push floor away, neutral spine" : "Brace, push floor away" },
          { name: hasBack ? "Leg Press" : (hasKnee ? "Leg Press (narrow)" : "Front Squat"), sets: 3, reps: "8-10", rpe: "7-8", cue: hasBack ? "Moderate foot position" : "Elbows up, upright torso" },
          { name: "Leg Extension", sets: 3, reps: "12-15", rpe: "7-8", cue: hasKnee ? "Partial ROM if needed" : "Pause at top" },
          { name: "Glute Ham Raise", sets: 3, reps: "8-10", rpe: "7-8", swap: "Leg Curl", cue: "Hinge at knee" },
          { name: hasKnee ? "Glute Bridge" : "Hip Thrust", sets: 3, reps: "10-12", rpe: "8", cue: "Full hip extension" },
          { name: "Calf Raise", sets: 4, reps: "12-15", rpe: "8", cue: "2-sec hold" },
        ]},
      ]
    : [
        { name: "Push", focus: "Chest, Shoulders, Triceps", exercises: [
          { name: hasBack ? "Incline DB Press" : "Bench Press", sets: 4, reps: "6-8", rpe: "8", swap: hasShoulder ? "Machine Chest Press" : null, cue: "Drive through chest" },
          { name: hasShoulder ? "Machine Chest Press" : "Incline DB Press", sets: 3, reps: "10-12", rpe: "7-8", cue: "30° angle" },
          { name: hasShoulder ? "Lateral Raises" : "OHP", sets: 3, reps: hasShoulder ? "12-15" : "8-10", rpe: "7-8", cue: hasShoulder ? "Controlled negatives" : "Brace core" },
          { name: "Lateral Raise", sets: 3, reps: "12-15", rpe: "7", cue: "Lead with elbow" },
          { name: "Tricep Pushdown", sets: 3, reps: "10-12", rpe: "7", cue: "Lock elbows" },
        ]},
        { name: "Pull", focus: "Back, Biceps", exercises: [
          { name: hasBack ? "Chest-Supported Row" : "Barbell Row", sets: 4, reps: "6-8", rpe: "8", swap: hasBack ? "Machine Row" : "Cable Row", cue: hasBack ? "Chest pad, squeeze blades" : "Pull to navel" },
          { name: "Lat Pulldown", sets: 3, reps: "10-12", rpe: "7-8", cue: "Squeeze lats" },
          { name: "Face Pull", sets: 3, reps: "15-20", rpe: "6-7", cue: "External rotate" },
          { name: "Barbell Curl", sets: 3, reps: "10-12", rpe: "7", cue: "No swing" },
          { name: "Hammer Curl", sets: 3, reps: "10-12", rpe: "7", cue: "Neutral grip" },
        ]},
        { name: "Legs", focus: "Full Lower Body", exercises: [
          { name: hasBack ? "Leg Press" : (hasKnee ? "Box Squat" : "Squat"), sets: 4, reps: hasKnee ? "10-12" : "6-8", rpe: "8", swap: "Goblet Squat", cue: hasBack ? "Feet high, no spinal load" : "Break at hips" },
          { name: hasBack ? "Glute Bridge" : "RDL", sets: 3, reps: "8-10", rpe: "7-8", swap: "Leg Curl", cue: hasBack ? "Drive through heels" : "Hinge pattern" },
          { name: "Leg Press", sets: 3, reps: "10-12", rpe: "7-8", cue: "Full ROM" },
          { name: "Leg Curl", sets: 3, reps: "10-12", rpe: "7-8", cue: "Control it" },
          { name: "Calf Raise", sets: 4, reps: "12-15", rpe: "8", cue: "2-sec hold" },
        ]},
      ];

  // Assign splits to gym days (cycle if more gym days than splits)
  const schedule = dayNames.map((d, i) => {
    const gIdx = gymDays.indexOf(d);
    if (gIdx >= 0) return { day: d, type: "gym", split: splits[gIdx % splits.length] };
    return { day: d, type: "rest" };
  });

  return {
    user: ans, splits, schedule, macros: { calories: cals, protein: protG, carbs: carbG, fat: fatG },
    bmr: Math.round(bmr), tdee, hasBack, hasShoulder, hasKnee,
    weekNum: 1, startDate: new Date().toISOString().split("T")[0],
    units: ans.units || "imperial",
  };
}

// ─── DATE HELPERS ───
const today = () => new Date().toISOString().split("T")[0];
const dayOfWeek = () => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];

// ─── QUESTIONNAIRE ───
const QUESTIONS = [
  { id:"name", label:"What's your name?", type:"text", placeholder:"Your name" },
  { id:"sex", label:"Biological sex", type:"select", options:["Male","Female"], note:"Used for BMR calculation" },
  { id:"units", label:"Preferred units?", type:"select", options:["Imperial (lb/ft)","Metric (kg/cm)"] },
  { id:"age", label:"How old are you?", type:"number", placeholder:"Age" },
  { id:"height", label:"Height", type:"height" },
  { id:"weight", label:"Current weight", type:"number", placeholder:"Weight" },
  { id:"goal", label:"What's your primary goal?", type:"select", options:["Build Muscle","Lose Fat","Recomposition","Strength","General Fitness"] },
  { id:"approach", label:"What type of training appeals to you?", type:"select", options:["Traditional Gym (barbells, dumbbells, machines)","Machine-Based (guided, joint-friendly)","Functional Fitness (bodyweight, kettlebells, bands)","Group Class Style (circuits, timed intervals)","Home Workouts (minimal equipment)"], note:"This shapes your exercise selection" },
  { id:"comfort", label:"How comfortable are you with free weights?", type:"select", options:["Very comfortable — I know my way around","Somewhat — I've used them but want guidance","Not very — I prefer machines or bodyweight","Never used them — start me on machines"], note:"We'll match exercises to your comfort level" },
  { id:"experience", label:"Training experience?", type:"select", options:["Complete Beginner","< 6 months","6-12 months","1-3 years","3+ years"] },
  { id:"activity", label:"Daily activity level?", type:"select", options:["Sedentary","Lightly Active","Moderately Active","Very Active"] },
  { id:"injuries", label:"Any injuries or limitations?", type:"multi", options:["Back/Spine","Shoulder","Knee","Hip","Wrist/Elbow","None"] },
  { id:"days", label:"How many days can you train?", type:"select", options:["2 days","3 days","4 days","5 days","6 days"] },
  { id:"gym_days", label:"Which days will you train?", type:"dayPicker" },
  { id:"gym_access", label:"What gym setup do you have?", type:"select", options:["Full Gym (barbells, machines, cables)","Home Gym (dumbbells, bench, pull-up bar)","Minimal Equipment (bands, bodyweight)","Planet Fitness Style (machines, dumbbells, no barbells)"] },
  { id:"time_pref", label:"When do you prefer to train?", type:"select", options:["Early Morning","Morning","Afternoon","Evening","Late Night","No Preference"] },
];

function Questionnaire({ onComplete, C }) {
  const [qIdx, setQIdx] = useState(0);
  const [ans, setAns] = useState({});
  const [sel, setSel] = useState([]);
  const q = QUESTIONS[qIdx];
  const totalQ = QUESTIONS.length;
  const isMetric = (ans.units || "").includes("Metric");

  const handleAnswer = (val) => {
    if (q.id === "units") {
      const v = val.includes("Metric") ? "metric" : "imperial";
      setAns(p => ({ ...p, units: v }));
    } else {
      setAns(p => ({ ...p, [q.id]: val }));
    }
  };

  const toggleMulti = (opt) => {
    if (opt === "None") { setSel(["None"]); return; }
    setSel(p => { const w = p.filter(x => x !== "None"); return w.includes(opt) ? w.filter(x => x !== opt) : [...w, opt]; });
  };

  const canNext = () => {
    if (q.type === "multi") return sel.length > 0;
    if (q.type === "height") return isMetric ? ans.height_cm : ans.height_ft;
    if (q.type === "dayPicker") return (ans.gym_days || []).length === parseInt(ans.days);
    return ans[q.id] !== undefined && ans[q.id] !== "";
  };

  const next = () => {
    if (q.type === "multi") { setAns(p => ({ ...p, [q.id]: sel })); setSel([]); }
    if (qIdx < totalQ - 1) setQIdx(qIdx + 1);
    else {
      const final = q.type === "multi" ? { ...ans, [q.id]: sel } : ans;
      onComplete(final);
    }
  };

  const back = () => {
    if (qIdx > 0) {
      const prev = QUESTIONS[qIdx - 1];
      if (prev.type === "multi") setSel(ans[prev.id] || []);
      setQIdx(qIdx - 1);
    }
  };

  const daysNeeded = parseInt(ans.days) || 0;
  const allDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      {/* Progress bar */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: C.sub }}>
          <span>Question {qIdx + 1} of {totalQ}</span>
          <span>{Math.round(((qIdx + 1) / totalQ) * 100)}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: C.border }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.grad, width: `${((qIdx + 1) / totalQ) * 100}%`, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ flex: 1, padding: "30px 20px", display: "flex", flexDirection: "column" }}>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{q.label}</h2>
        {q.note && <p style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>{q.note}</p>}
        {q.id === "weight" && <p style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>In {isMetric ? "kg" : "lbs"}</p>}

        {/* Text / Number input */}
        {(q.type === "text" || q.type === "number") && (
          <input
            type={q.type === "number" ? "number" : "text"}
            value={ans[q.id] || ""}
            onChange={e => handleAnswer(e.target.value)}
            placeholder={q.placeholder}
            style={{ padding: 14, borderRadius: 10, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
              color: C.text, fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
        )}

        {/* Height input */}
        {q.type === "height" && (
          isMetric ? (
            <input type="number" value={ans.height_cm || ""} onChange={e => setAns(p => ({ ...p, height_cm: e.target.value }))}
              placeholder="cm" style={{ padding: 14, borderRadius: 10, border: `1px solid ${C.inputBorder}`,
              background: C.inputBg, color: C.text, fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box" }} />
          ) : (
            <div style={{ display: "flex", gap: 10, width: "100%", boxSizing: "border-box" }}>
              <input type="number" value={ans.height_ft || ""} onChange={e => setAns(p => ({ ...p, height_ft: e.target.value }))}
                placeholder="ft" style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: 10, border: `1px solid ${C.inputBorder}`,
                background: C.inputBg, color: C.text, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
              <input type="number" value={ans.height_in || ""} onChange={e => setAns(p => ({ ...p, height_in: e.target.value }))}
                placeholder="in" style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: 10, border: `1px solid ${C.inputBorder}`,
                background: C.inputBg, color: C.text, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
            </div>
          )
        )}

        {/* Select */}
        {q.type === "select" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map(o => {
              const isActive = q.id === "units" ? (o.includes("Metric") ? ans.units === "metric" : ans.units === "imperial") : ans[q.id] === o;
              return (
                <button key={o} onClick={() => handleAnswer(o)}
                  style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${isActive ? C.accent : C.border}`,
                    background: isActive ? C.accent + "18" : C.card, color: C.text, fontSize: 15, textAlign: "left",
                    cursor: "pointer", fontWeight: isActive ? 600 : 400, transition: "all 0.15s" }}>
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {/* Multi select */}
        {q.type === "multi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map(o => {
              const isActive = sel.includes(o);
              return (
                <button key={o} onClick={() => toggleMulti(o)}
                  style={{ padding: "14px 16px", borderRadius: 10, border: `2px solid ${isActive ? C.accent : C.border}`,
                    background: isActive ? C.accent + "18" : C.card, color: C.text, fontSize: 15, textAlign: "left",
                    cursor: "pointer", fontWeight: isActive ? 600 : 400, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isActive ? C.accent : C.muted}`,
                    background: isActive ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, flexShrink: 0 }}>{isActive ? "✓" : ""}</div>
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {/* Day picker */}
        {q.type === "dayPicker" && (
          <div>
            <p style={{ color: C.sub, fontSize: 13, marginBottom: 12 }}>Select {daysNeeded} day{daysNeeded !== 1 ? "s" : ""} — {(ans.gym_days || []).length} selected</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {allDays.map(d => {
                const isActive = (ans.gym_days || []).includes(d);
                return (
                  <button key={d} onClick={() => {
                    setAns(p => {
                      const cur = p.gym_days || [];
                      if (isActive) return { ...p, gym_days: cur.filter(x => x !== d) };
                      if (cur.length >= daysNeeded) return p;
                      return { ...p, gym_days: [...cur, d] };
                    });
                  }}
                  style={{ padding: "12px 0", borderRadius: 10, border: `2px solid ${isActive ? C.accent : C.border}`,
                    background: isActive ? C.accent + "18" : C.card, color: isActive ? C.accent : C.text,
                    fontSize: 14, fontWeight: isActive ? 700 : 500, cursor: "pointer" }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ padding: "0 20px 30px", display: "flex", gap: 10 }}>
        {qIdx > 0 && (
          <button onClick={back} style={{ flex: 1, padding: 14, borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.card, color: C.text, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Back</button>
        )}
        <button onClick={next} disabled={!canNext()}
          style={{ flex: 2, padding: 14, borderRadius: 10, border: "none", background: canNext() ? C.grad : C.border,
            color: canNext() ? "#fff" : C.muted, fontSize: 15, fontWeight: 700, cursor: canNext() ? "pointer" : "default",
            opacity: canNext() ? 1 : 0.5 }}>
          {qIdx === totalQ - 1 ? "Generate My Program" : "Next"}
        </button>
      </div>
    </div>
  );
}

// ─── GENERATING SCREEN ───
function GeneratingScreen({ C }) {
  const [step, setStep] = useState(0);
  const steps = ["Analyzing your stats...", "Calculating BMR & TDEE...", "Building workout splits...",
    "Selecting exercises for your injuries...", "Computing macros & nutrition...", "Generating with AI...",
    "Personalizing your program...", "Almost there..."];
  useEffect(() => {
    const t = setInterval(() => setStep(p => (p + 1) % steps.length), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent,
        animation: "spin 1s linear infinite", marginBottom: 30 }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Building Your Program</h2>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, opacity: i <= step ? 1 : 0.3, transition: "opacity 0.3s" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: i <= step ? C.green : C.border,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10 }}>{i <= step ? "✓" : ""}</div>
          <span style={{ color: C.text, fontSize: 14 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

// ─── REST TIMER ───
function RestTimer({ seconds, onClose, C }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => { if (left <= 0) return; const t = setInterval(() => setLeft(p => p - 1), 1000); return () => clearInterval(t); }, [left]);
  const pct = ((seconds - left) / seconds) * 100;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <h3 style={{ color: "#fff", fontSize: 18, marginBottom: 20 }}>Rest Timer</h3>
      <div style={{ width: 120, height: 120, borderRadius: "50%", border: `4px solid ${C.border}`, display: "flex",
        alignItems: "center", justifyContent: "center", position: "relative" }}>
        <svg width="120" height="120" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="56" fill="none" stroke={C.accent} strokeWidth="4" strokeDasharray={`${pct * 3.51} 351`} />
        </svg>
        <span style={{ color: "#fff", fontSize: 36, fontWeight: 700, zIndex: 1 }}>{left}s</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {[30, 60, 90, 120].map(t => (
          <button key={t} onClick={() => setLeft(t)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer" }}>{t}s</button>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 20, padding: "10px 30px", borderRadius: 10, border: "none",
        background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        {left <= 0 ? "Done!" : "Skip"}
      </button>
    </div>
  );
}

// ─── WORKOUT TAB ───
function WorkoutTab({ program, workoutLogs, setWorkoutLogs, onTimer, C }) {
  const todayDay = dayOfWeek();
  const todaySchedule = program.schedule.find(s => s.day === todayDay);
  const isGymDay = todaySchedule?.type === "gym";
  const todaySplit = todaySchedule?.split;

  const [expanded, setExpanded] = useState(null);
  const [swaps, setSwaps] = useState({});
  const dateKey = today();

  // Rest day screen
  if (!isGymDay || !todaySplit) {
    // Find next gym day
    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const todayIdx = dayNames.indexOf(todayDay);
    let nextGym = null;
    for (let i = 1; i <= 7; i++) {
      const check = dayNames[(todayIdx + i) % 7];
      const sched = program.schedule.find(s => s.day === check);
      if (sched?.type === "gym") { nextGym = sched; break; }
    }

    return (
      <div style={{ padding: 20 }}>
        <div style={{ background: C.card, borderRadius: 14, padding: 24, textAlign: "center", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😴</div>
          <h3 style={{ color: C.text, fontSize: 20, marginBottom: 8 }}>Rest Day</h3>
          <p style={{ color: C.sub, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            Recovery is when growth happens. Your muscles repair and come back stronger. Focus on nutrition, hydration, and sleep today.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[["💧","Drink 100oz+ water"],["🥗","Hit your protein target"],["😴","Get 7-8 hours sleep"],["🚶","Light walk or stretching"],["🧘","Foam roll tight areas"],["📵","Limit screen time before bed"]].map(([ic,txt],i) => (
              <div key={i} style={{ background: C.cardAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{ic}</div>
                <div style={{ fontSize: 11, color: C.sub }}>{txt}</div>
              </div>
            ))}
          </div>
          {nextGym && (
            <div style={{ background: C.accent + "10", borderRadius: 10, padding: 12, border: `1px solid ${C.accent}20` }}>
              <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>Next Workout</div>
              <div style={{ fontSize: 15, color: C.text, fontWeight: 700, marginTop: 4 }}>{nextGym.day} — {nextGym.split.name}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{nextGym.split.focus}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Gym day — show today's split only
  const split = todaySplit;
  const logKey = `${dateKey}-${split.name}`;
  const setData = workoutLogs[logKey] || {};

  const updateSet = (exIdx, setIdx, field, val) => {
    const key = `${exIdx}-${setIdx}`;
    const updated = { ...workoutLogs, [logKey]: { ...setData, [key]: { ...(setData[key] || {}), [field]: val } } };
    setWorkoutLogs(updated);
  };

  const totalSets = split.exercises.reduce((a, e) => a + e.sets, 0);
  const doneSets = Object.values(setData).filter(s => s?.done).length;
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  // Estimated calories burned (rough: ~5-8 cal per set for resistance training)
  const estCalsBurned = doneSets * 7;

  // Previous session comparison
  const prevSessionKey = Object.keys(workoutLogs).filter(k => k.endsWith(`-${split.name}`) && k !== logKey).sort().reverse()[0];
  const prevSession = prevSessionKey ? workoutLogs[prevSessionKey] : null;
  const prevDate = prevSessionKey ? prevSessionKey.split("-").slice(0,3).join("-") : null;

  // Warmup based on injury profile
  const warmupExercises = program.hasBack
    ? [{ name: "Dead Bugs", detail: "2 × 10 each side", cue: "Press lower back into floor" },
       { name: "Bird Dogs", detail: "2 × 10 each side", cue: "Keep hips level, reach long" },
       { name: "Cat-Cow", detail: "2 × 10 reps", cue: "Inhale cow, exhale cat" }]
    : program.hasShoulder
    ? [{ name: "Band Pull-Aparts", detail: "2 × 15", cue: "Chest height, squeeze blades" },
       { name: "External Rotations", detail: "2 × 12 each", cue: "Elbow at 90°, rotate out" },
       { name: "Arm Circles", detail: "1 × 10 each direction", cue: "Small to large" }]
    : [{ name: "Jumping Jacks", detail: "1 × 30 seconds", cue: "Get heart rate up" },
       { name: "Arm Circles", detail: "1 × 10 each direction", cue: "Loosen shoulders" },
       { name: "Bodyweight Squats", detail: "1 × 15", cue: "Open hips, chest up" }];

  const [warmupDone, setWarmupDone] = useState({});
  const [showNotes, setShowNotes] = useState(false);
  const [sessionNotes, setSessionNotes] = useState(setData._notes || "");

  const saveNotes = () => {
    const updated = { ...workoutLogs, [logKey]: { ...setData, _notes: sessionNotes } };
    setWorkoutLogs(updated);
  };

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {/* Today's workout header */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: C.sub }}>{todayDay}'s Workout</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{split.name} Day</div>
            <div style={{ fontSize: 13, color: C.sub }}>{split.focus}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: pct === 100 ? C.green : C.accent }}>{pct}%</div>
            <div style={{ fontSize: 10, color: C.sub }}>complete</div>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.border }}>
          <div style={{ height: "100%", borderRadius: 3, background: pct === 100 ? C.green : C.accent, width: `${pct}%`, transition: "width 0.3s" }} />
        </div>
        {doneSets > 0 && (
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: C.sub }}>
            <span>🔥 ~{estCalsBurned} cal burned</span>
            <span>✅ {doneSets}/{totalSets} sets</span>
          </div>
        )}
      </div>

      {/* Previous session comparison */}
      {prevSession && (
        <div style={{ background: C.cardAlt, borderRadius: 10, padding: 12, border: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 4 }}>📊 Last {split.name} Session — {prevDate}</div>
          <div style={{ fontSize: 12, color: C.text }}>
            {Object.entries(prevSession).filter(([k,v]) => v?.done && k !== "_notes").length} sets completed
            {prevSession._notes && <span style={{ color: C.muted }}> • "{prevSession._notes}"</span>}
          </div>
        </div>
      )}

      {/* Warmup section */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🔥 Warm-Up</div>
          <div style={{ fontSize: 11, color: C.sub }}>
            {program.hasBack ? "Core stability protocol" : "General warm-up"} • {Object.values(warmupDone).filter(Boolean).length}/{warmupExercises.length} done
          </div>
        </div>
        {warmupExercises.map((w, i) => (
          <button key={i} onClick={() => setWarmupDone(p => ({ ...p, [i]: !p[i] }))}
            style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
              background: warmupDone[i] ? C.green + "08" : "none", border: "none", borderBottom: i < warmupExercises.length - 1 ? `1px solid ${C.border}` : "none",
              cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${warmupDone[i] ? C.green : C.border}`,
              background: warmupDone[i] ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, flexShrink: 0 }}>{warmupDone[i] ? "✓" : ""}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: warmupDone[i] ? C.green : C.text, textDecoration: warmupDone[i] ? "line-through" : "none" }}>{w.name}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{w.detail} — {w.cue}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Exercises */}
      {split.exercises.map((ex, exIdx) => {
        const splitIdx = program.splits.findIndex(s => s.name === split.name);
        const name = swaps[`${splitIdx}-${exIdx}`] || ex.name;
        const isExp = expanded === exIdx;
        const exSets = Array.from({ length: ex.sets }, (_, i) => i);
        const exDone = exSets.filter(s => setData[`${exIdx}-${s}`]?.done).length;

        return (
          <div key={exIdx} style={{ background: C.card, borderRadius: 12, border: `1px solid ${exDone === ex.sets ? C.green + "40" : C.border}`, marginBottom: 8, overflow: "hidden" }}>
            <button onClick={() => setExpanded(isExp ? null : exIdx)}
              style={{ width: "100%", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "none", border: "none", cursor: "pointer", color: C.text }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 15, fontWeight: 600, textDecoration: exDone === ex.sets ? "none" : "none",
                  color: exDone === ex.sets ? C.green : C.text }}>{name} {exDone === ex.sets && "✓"}</div>
                <div style={{ fontSize: 12, color: C.sub }}>{ex.sets} × {ex.reps} • RPE {ex.rpe} • {exDone}/{ex.sets} done</div>
              </div>
              <span style={{ color: C.muted, fontSize: 18, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </button>

            {isExp && (
              <div style={{ padding: "0 16px 14px" }}>
                {ex.cue && <div style={{ fontSize: 12, color: C.accent, marginBottom: 10, padding: "6px 10px", background: C.accent + "10", borderRadius: 6 }}>💡 {ex.cue}</div>}

                {ex.swap && (
                  <button onClick={() => setSwaps(p => ({ ...p, [`${splitIdx}-${exIdx}`]: p[`${splitIdx}-${exIdx}`] === ex.swap ? ex.name : ex.swap }))}
                    style={{ fontSize: 11, color: C.red, background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 6,
                      padding: "4px 10px", cursor: "pointer", marginBottom: 10 }}>
                    🔄 Swap: {swaps[`${splitIdx}-${exIdx}`] === ex.swap ? ex.name : ex.swap}
                  </button>
                )}

                {/* Set-by-set logging */}
                <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 50px", gap: 6, fontSize: 12, color: C.sub, marginBottom: 6 }}>
                  <span>Set</span><span>Weight</span><span>Reps</span><span></span>
                </div>
                {exSets.map(setIdx => {
                  const sd = setData[`${exIdx}-${setIdx}`] || {};
                  return (
                    <div key={setIdx} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 50px", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{setIdx + 1}</span>
                      <input type="number" value={sd.weight || ""} onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)}
                        placeholder="lbs" style={{ padding: "8px 6px", borderRadius: 6, border: `1px solid ${C.inputBorder}`,
                        background: C.inputBg, color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }} />
                      <input type="number" value={sd.reps || ""} onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                        placeholder={ex.reps} style={{ padding: "8px 6px", borderRadius: 6, border: `1px solid ${C.inputBorder}`,
                        background: C.inputBg, color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }} />
                      <button onClick={() => updateSet(exIdx, setIdx, "done", !sd.done)}
                        style={{ padding: "6px 0", borderRadius: 6, border: `1px solid ${sd.done ? C.green : C.border}`,
                          background: sd.done ? C.green + "20" : "transparent", color: sd.done ? C.green : C.muted,
                          fontSize: 14, cursor: "pointer" }}>{sd.done ? "✓" : "○"}</button>
                    </div>
                  );
                })}
                <button onClick={() => onTimer(90)} style={{ marginTop: 8, width: "100%", padding: 8, borderRadius: 8,
                  border: `1px solid ${C.border}`, background: C.cardAlt, color: C.sub, fontSize: 12, cursor: "pointer" }}>⏱ Start Rest Timer</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Session notes */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, marginTop: 8, padding: 14 }}>
        <button onClick={() => setShowNotes(!showNotes)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text, padding: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>📝 Session Notes</span>
          <span style={{ color: C.muted, fontSize: 14 }}>{showNotes ? "▴" : "▾"}</span>
        </button>
        {showNotes && (
          <div style={{ marginTop: 10 }}>
            <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="How did this session feel? Any PRs, struggles, adjustments?"
              rows={3} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            <button onClick={saveNotes} style={{ marginTop: 8, width: "100%", padding: 10, borderRadius: 8, border: "none",
              background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save Notes</button>
          </div>
        )}
      </div>

      {/* Finish workout summary */}
      {pct >= 80 && (
        <div style={{ background: C.green + "12", borderRadius: 12, border: `1px solid ${C.green}30`, padding: 16, marginTop: 12, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 4 }}>💪 Great session!</div>
          <div style={{ fontSize: 12, color: C.sub }}>{doneSets}/{totalSets} sets • ~{estCalsBurned} calories burned</div>
        </div>
      )}
    </div>
  );
}

// ─── MEALS TAB (FOOD LOG) ───
function MealsTab({ program, foodLog, setFoodLog, C }) {
  const dateKey = today();
  const todayLog = foodLog[dateKey] || { meals: [] };
  const [viewDate, setViewDate] = useState(dateKey);
  const [adding, setAdding] = useState(null); // "Breakfast","Lunch","Dinner","Snack"
  const [entry, setEntry] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  const viewLog = foodLog[viewDate] || { meals: [] };
  const mealSlots = ["Breakfast", "Lunch", "Dinner", "Snack"];

  const addMeal = () => {
    if (!entry.name.trim()) return;
    const newEntry = { ...entry, slot: adding, id: Date.now(), calories: parseInt(entry.calories) || 0,
      protein: parseInt(entry.protein) || 0, carbs: parseInt(entry.carbs) || 0, fat: parseInt(entry.fat) || 0 };
    const updated = { ...foodLog, [viewDate]: { meals: [...(foodLog[viewDate]?.meals || []), newEntry] } };
    setFoodLog(updated);
    setEntry({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    setAdding(null);
  };

  const removeMeal = (id) => {
    const updated = { ...foodLog, [viewDate]: { meals: (foodLog[viewDate]?.meals || []).filter(m => m.id !== id) } };
    setFoodLog(updated);
  };

  const totals = (foodLog[viewDate]?.meals || []).reduce((a, m) => ({
    calories: a.calories + (m.calories || 0), protein: a.protein + (m.protein || 0),
    carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const { macros } = program;
  const calPct = Math.min(100, Math.round((totals.calories / macros.calories) * 100));
  const protPct = Math.min(100, Math.round((totals.protein / macros.protein) * 100));

  const logDates = Object.keys(foodLog).sort().reverse();

  // Smart meal progression recommendations
  const mealSlots = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const loggedSlots = mealSlots.filter(slot => (foodLog[viewDate]?.meals || []).some(m => m.slot === slot));
  const nextMeal = mealSlots.find(slot => !loggedSlots.includes(slot) && slot !== "Snack");
  const hasSnack = loggedSlots.includes("Snack");

  const mealSuggestions = {
    Breakfast: { icon: "🍳", ideas: ["Eggs + toast + fruit (~400 cal, 25g protein)", "Oatmeal + protein powder + banana (~450 cal, 30g protein)", "Greek yogurt + granola + berries (~350 cal, 20g protein)"] },
    Lunch: { icon: "🥗", ideas: ["Chicken wrap + veggies (~500 cal, 35g protein)", "Rice bowl + protein + avocado (~550 cal, 30g protein)", "Turkey sandwich + side salad (~450 cal, 28g protein)"] },
    Dinner: { icon: "🍽️", ideas: ["Salmon + sweet potato + greens (~550 cal, 40g protein)", "Stir-fry with protein + rice (~500 cal, 35g protein)", "Lean steak + roasted veggies (~500 cal, 42g protein)"] },
  };
  const snackSuggestions = ["Protein shake (~150 cal, 25g protein)", "Apple + peanut butter (~250 cal, 8g protein)", "Trail mix + jerky (~300 cal, 15g protein)"];

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {/* Daily summary */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: 0 }}>Today's Nutrition</h3>
          <span style={{ fontSize: 12, color: C.sub }}>{viewDate}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Calories", val: totals.calories, target: macros.calories, color: C.accent },
            { label: "Protein", val: totals.protein, target: macros.protein, unit: "g", color: C.green },
            { label: "Carbs", val: totals.carbs, target: macros.carbs, unit: "g", color: C.yellow },
            { label: "Fat", val: totals.fat, target: macros.fat, unit: "g", color: "#9b59b6" },
          ].map((m, i) => (
            <div key={i} style={{ background: C.cardAlt, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{m.val}<span style={{ fontSize: 12, color: C.sub }}>/{m.target}{m.unit || ""}</span></div>
              <div style={{ height: 4, borderRadius: 2, background: C.border, marginTop: 6 }}>
                <div style={{ height: "100%", borderRadius: 2, background: m.color, width: `${Math.min(100, (m.val / m.target) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart meal recommendation */}
      {nextMeal && mealSuggestions[nextMeal] && (
        <div style={{ background: C.green + "12", border: `1px solid ${C.green}30`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 6 }}>{mealSuggestions[nextMeal].icon} Time for {nextMeal}!</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {mealSuggestions[nextMeal].ideas.map((idea, i) => (
              <div key={i} style={{ fontSize: 12, color: C.sub, paddingLeft: 8, borderLeft: `2px solid ${C.green}30` }}>{idea}</div>
            ))}
          </div>
        </div>
      )}

      {/* Snack recommendation alongside meals */}
      {!hasSnack && loggedSlots.length > 0 && (
        <div style={{ background: C.yellow + "12", border: `1px solid ${C.yellow}30`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.yellow, fontWeight: 600, marginBottom: 6 }}>🍎 Don't forget a snack!</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {snackSuggestions.map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: C.sub, paddingLeft: 8, borderLeft: `2px solid ${C.yellow}30` }}>{s}</div>
            ))}
          </div>
        </div>
      )}

      {/* All meals logged */}
      {loggedSlots.length >= 3 && !nextMeal && (
        <div style={{ background: C.accent + "12", border: `1px solid ${C.accent}30`, borderRadius: 10, padding: 12, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>✅ All main meals logged!</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{totals.protein}g / {macros.protein}g protein • {totals.calories} / {macros.calories} cal</div>
        </div>
      )}

      {/* Meal slots */}
      {mealSlots.map(slot => {
        const slotMeals = (foodLog[viewDate]?.meals || []).filter(m => m.slot === slot);
        return (
          <div key={slot} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{slot}</div>
                {slotMeals.length > 0 && (
                  <div style={{ fontSize: 11, color: C.sub }}>{slotMeals.reduce((a, m) => a + m.calories, 0)} cal • {slotMeals.reduce((a, m) => a + m.protein, 0)}g protein</div>
                )}
              </div>
              <button onClick={() => setAdding(adding === slot ? null : slot)}
                style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${C.border}`, background: adding === slot ? C.accent : C.cardAlt,
                  color: adding === slot ? "#fff" : C.accent, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {adding === slot ? "×" : "+"}
              </button>
            </div>

            {slotMeals.map(m => (
              <div key={m.id} style={{ padding: "8px 16px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, color: C.text }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{m.calories}cal • P:{m.protein}g • C:{m.carbs}g • F:{m.fat}g</div>
                </div>
                <button onClick={() => removeMeal(m.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 14, cursor: "pointer" }}>✕</button>
              </div>
            ))}

            {adding === slot && (
              <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
                <input value={entry.name} onChange={e => setEntry(p => ({ ...p, name: e.target.value }))} placeholder="What did you eat?"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                    color: C.text, fontSize: 14, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                  {[["calories","Cal"],["protein","Prot"],["carbs","Carb"],["fat","Fat"]].map(([k,l]) => (
                    <input key={k} type="number" value={entry[k]} onChange={e => setEntry(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={l} style={{ padding: 8, borderRadius: 6, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                        color: C.text, fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
                  ))}
                </div>
                <button onClick={addMeal} disabled={!entry.name.trim()}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: entry.name.trim() ? C.accent : C.border,
                    color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Add to {slot}</button>
              </div>
            )}
          </div>
        );
      })}

      {/* History moved to Settings tab */}
    </div>
  );
}

// ─── PROGRESS TAB ───
function ProgressTab({ progressLogs, setProgressLogs, program, workoutLogs, C }) {
  const dateKey = today();
  const [view, setView] = useState("log");
  const todayLog = progressLogs[dateKey] || {};
  const [form, setForm] = useState({ weight: todayLog.weight || "", sleep: todayLog.sleep || "", energy: todayLog.energy || "", soreness: todayLog.soreness || "", notes: todayLog.notes || "" });
  const [saved, setSaved] = useState(false);

  const submitLog = () => {
    const updated = { ...progressLogs, [dateKey]: { ...form, date: dateKey } };
    setProgressLogs(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sortedDates = Object.keys(progressLogs).sort().reverse();
  const weights = sortedDates.map(d => ({ date: d, weight: parseFloat(progressLogs[d]?.weight) })).filter(w => w.weight);

  // PR detection from workout logs
  const prs = {};
  Object.entries(workoutLogs).forEach(([key, data]) => {
    Object.entries(data).forEach(([setKey, setInfo]) => {
      if (setInfo?.done && setInfo?.weight) {
        const w = parseFloat(setInfo.weight);
        const [exIdx] = setKey.split("-");
        // Simple PR tracking by set key pattern
        if (!prs[exIdx] || w > prs[exIdx].weight) prs[exIdx] = { weight: w, date: key.split("-").slice(0, 3).join("-") };
      }
    });
  });

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {/* View toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["log","Daily Log"],["measurements","Body"]].map(([k,l]) => (
          <button key={k} onClick={() => setView(k)} style={{ flex: 1, padding: "8px 0", borderRadius: 8,
            border: `1px solid ${view === k ? C.accent : C.border}`, background: view === k ? C.accent + "18" : C.card,
            color: view === k ? C.accent : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {view === "log" && (
        <>
          <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>Daily Check-In</h3>

            <label style={{ fontSize: 13, color: C.sub, marginBottom: 4, display: "block" }}>Weight ({program.units === "metric" ? "kg" : "lbs"})</label>
            <input type="number" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                color: C.text, fontSize: 15, outline: "none", marginBottom: 14, boxSizing: "border-box" }} />

            <label style={{ fontSize: 13, color: C.sub, marginBottom: 6, display: "block" }}>Sleep (hours)</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {["<5","5-6","6-7","7-8","8+"].map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, sleep: s }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8,
                  border: `1px solid ${form.sleep === s ? C.accent : C.border}`, background: form.sleep === s ? C.accent + "18" : C.card,
                  color: form.sleep === s ? C.accent : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
              ))}
            </div>

            <label style={{ fontSize: 13, color: C.sub, marginBottom: 6, display: "block" }}>Energy Level</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[["😴","Low"],["😐","OK"],["😊","Good"],["🔥","Great"]].map(([ic,l]) => (
                <button key={l} onClick={() => setForm(p => ({ ...p, energy: l }))} style={{ flex: 1, padding: "8px 4px", borderRadius: 8,
                  border: `1px solid ${form.energy === l ? C.accent : C.border}`, background: form.energy === l ? C.accent + "18" : C.card,
                  color: form.energy === l ? C.accent : C.sub, fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 2 }}><span style={{ fontSize: 16 }}>{ic}</span>{l}</button>
              ))}
            </div>

            <label style={{ fontSize: 13, color: C.sub, marginBottom: 6, display: "block" }}>Soreness</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {["None","Mild","Moderate","Severe"].map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, soreness: s }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8,
                  border: `1px solid ${form.soreness === s ? C.accent : C.border}`, background: form.soreness === s ? C.accent + "18" : C.card,
                  color: form.soreness === s ? C.accent : C.sub, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{s}</button>
              ))}
            </div>

            <label style={{ fontSize: 13, color: C.sub, marginBottom: 4, display: "block" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="How are you feeling?"
              rows={3} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />

            <button onClick={submitLog} style={{ marginTop: 12, width: "100%", padding: 13, borderRadius: 10, border: "none",
              background: saved ? C.green : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {saved ? "✓ Saved!" : todayLog.weight ? "Update Today's Log" : "Save Today's Log"}
            </button>
          </div>
        </>
      )}

      {view === "history" && (
        <div>
          {weights.length > 1 && (
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <h4 style={{ color: C.text, fontSize: 14, margin: "0 0 10px" }}>Weight Trend</h4>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
                {weights.slice(0, 14).reverse().map((w, i) => {
                  const min = Math.min(...weights.map(x => x.weight));
                  const max = Math.max(...weights.map(x => x.weight));
                  const range = max - min || 1;
                  const h = ((w.weight - min) / range) * 80 + 20;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: 9, color: C.sub, marginBottom: 2 }}>{w.weight}</div>
                      <div style={{ width: "100%", height: h, borderRadius: 4, background: C.accent + "60" }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "measurements" && (
        <MeasurementsView progressLogs={progressLogs} setProgressLogs={setProgressLogs} C={C} />
      )}
    </div>
  );
}

function MeasurementsView({ progressLogs, setProgressLogs, C }) {
  const dateKey = today();
  const todayLog = progressLogs[dateKey] || {};
  const existingMeas = todayLog.measurements || {};
  const fields = [["chest","Chest"],["waist","Waist"],["hips","Hips"],["arms","Arms"],["thighs","Thighs"]];
  const [showHistory, setShowHistory] = useState(false);
  const [measForm, setMeasForm] = useState({ chest: existingMeas.chest || "", waist: existingMeas.waist || "", hips: existingMeas.hips || "", arms: existingMeas.arms || "", thighs: existingMeas.thighs || "" });
  const [measSaved, setMeasSaved] = useState(false);

  const submitMeas = () => {
    const updated = { ...progressLogs, [dateKey]: { ...todayLog, date: dateKey, measurements: measForm } };
    setProgressLogs(updated);
    setMeasSaved(true);
    setTimeout(() => setMeasSaved(false), 2000);
  };

  // Gather all dates that have measurements
  const measDates = Object.keys(progressLogs).filter(d => {
    const m = progressLogs[d]?.measurements;
    return m && Object.values(m).some(v => v);
  }).sort().reverse();

  return (
    <div>
      {/* Today's log */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Body Measurements</h3>
        <p style={{ color: C.sub, fontSize: 12, margin: "0 0 6px" }}>Optional — log whatever you want to track</p>
        <p style={{ color: C.muted, fontSize: 11, margin: "0 0 14px", fontStyle: "italic" }}>Waist = narrowest point above belly button • Hips = widest point around glutes</p>
        {fields.map(([k, l]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, color: C.sub, marginBottom: 4, display: "block" }}>{l}</label>
            <input type="number" value={measForm[k] || ""} onChange={e => setMeasForm(p => ({ ...p, [k]: e.target.value }))}
              placeholder="optional" style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.inputBorder}`,
                background: C.inputBg, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
        <button onClick={submitMeas} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none",
          background: measSaved ? C.green : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {measSaved ? "✓ Saved!" : "Save Measurements"}
        </button>
      </div>

      {/* History toggle */}
      <button onClick={() => setShowHistory(!showHistory)}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card,
          color: C.sub, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
        {showHistory ? "Hide" : "View"} Measurement History ({measDates.length} entries)
      </button>

      {showHistory && measDates.length > 0 && (
        <div>
          {/* Change over time for each field */}
          {measDates.length >= 2 && (
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 8 }}>
              <h4 style={{ color: C.text, fontSize: 14, margin: "0 0 10px" }}>Changes</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fields.map(([k, l]) => {
                  const latest = parseFloat(progressLogs[measDates[0]]?.measurements?.[k]);
                  const oldest = parseFloat(progressLogs[measDates[measDates.length - 1]]?.measurements?.[k]);
                  if (!latest || !oldest) return null;
                  const diff = (latest - oldest).toFixed(1);
                  const isPos = diff > 0;
                  return (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, color: C.sub }}>{l}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: C.text }}>{latest}"</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isPos ? C.green : C.accent,
                          background: isPos ? C.green + "15" : C.accent + "15", padding: "2px 8px", borderRadius: 6 }}>
                          {isPos ? "+" : ""}{diff}"
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual entries */}
          {measDates.map(d => {
            const m = progressLogs[d]?.measurements || {};
            const entries = fields.filter(([k]) => m[k]).map(([k, l]) => `${l}: ${m[k]}"`);
            return (
              <div key={d} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{d}</div>
                <div style={{ fontSize: 12, color: C.sub }}>{entries.join(" • ")}</div>
              </div>
            );
          })}
        </div>
      )}

      {showHistory && measDates.length === 0 && (
        <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 20 }}>No measurements logged yet.</div>
      )}
    </div>
  );
}

// ─── SCHEDULE TAB ───
function ScheduleTab({ program, workoutLogs, C }) {
  const todayDay = dayOfWeek();
  return (
    <div style={{ padding: "12px 16px 100px" }}>
      <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Weekly Schedule</h3>
      {program.schedule.map((s, i) => {
        const isToday = s.day === todayDay;
        return (
          <div key={i} style={{ background: isToday ? C.accent + "12" : C.card, borderRadius: 10,
            border: `1px solid ${isToday ? C.accent + "40" : C.border}`, padding: "12px 16px", marginBottom: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.day}{isToday ? " (Today)" : ""}</div>
              <div style={{ fontSize: 12, color: C.sub }}>{s.type === "gym" ? `${s.split.name} — ${s.split.focus}` : "Rest Day"}</div>
            </div>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.type === "gym" ? C.green : C.muted }} />
          </div>
        );
      })}

      {/* Streak */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Current Streak</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.accent }}>{Object.keys(workoutLogs).length}</div>
        <div style={{ fontSize: 12, color: C.sub }}>sessions logged</div>
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ───
function SettingsTab({ program, setProgram, onReset, workoutLogs, progressLogs, foodLog, theme, setTheme, C }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPicModal, setShowPicModal] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [historyView, setHistoryView] = useState(null); // null, "progress", "meals", "workouts"

  useEffect(() => { DB.get("profilePic").then(v => v && setProfilePic(v)); }, []);

  const avatars = ["👤","💪","🏋️","🧑‍💻","🦾","🏃","⚡","🎯"];

  const saveProfile = () => {
    const mergedUser = { ...program.user, ...editData };
    // Regenerate program with updated stats so AI adapts workouts + macros
    const regenerated = generateProgram(mergedUser);
    // Preserve week number and start date from original
    regenerated.weekNum = program.weekNum;
    regenerated.startDate = program.startDate;
    setProgram(regenerated);
    setEditing(false);
  };

  const selectAvatar = async (av) => {
    setProfilePic(av);
    await DB.set("profilePic", av);
    setShowPicModal(false);
  };

  const totalWorkouts = Object.keys(workoutLogs).length;
  const totalLogs = Object.keys(progressLogs).length;

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {/* Profile card */}
      <div style={{ background: C.card, borderRadius: 14, padding: 20, border: `1px solid ${C.border}`, marginBottom: 12, textAlign: "center" }}>
        <button onClick={() => setShowPicModal(true)} style={{ width: 70, height: 70, borderRadius: "50%", background: C.accent + "20",
          border: `2px solid ${C.accent}`, fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", margin: "0 auto 10px" }}>
          {profilePic || "👤"}
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{program.user.name || "User"}</div>
        <div style={{ fontSize: 13, color: C.sub }}>{program.user.goal} • {program.user.experience}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12 }}>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{totalWorkouts}</div><div style={{ fontSize: 11, color: C.sub }}>Workouts</div></div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{totalLogs}</div><div style={{ fontSize: 11, color: C.sub }}>Check-ins</div></div>
        </div>
      </div>

      {/* Avatar picker modal */}
      {showPicModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 24, width: "80%", maxWidth: 300 }}>
            <h3 style={{ color: C.text, fontSize: 16, marginBottom: 16, textAlign: "center" }}>Choose Avatar</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {avatars.map(a => (
                <button key={a} onClick={() => selectAvatar(a)}
                  style={{ width: "100%", aspectRatio: "1", borderRadius: 12, border: `2px solid ${profilePic === a ? C.accent : C.border}`,
                    background: profilePic === a ? C.accent + "20" : C.cardAlt, fontSize: 28, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>{a}</button>
              ))}
            </div>
            <button onClick={() => setShowPicModal(false)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`,
              background: "transparent", color: C.sub, fontSize: 13, cursor: "pointer", marginTop: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit profile */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: 0 }}>Profile</h3>
          <button onClick={() => { if (editing) saveProfile(); else setEditData(program.user); setEditing(!editing); }}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.accent}`, background: "transparent",
              color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{editing ? "Save" : "Edit"}</button>
        </div>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[["name","Name"],["age","Age"],["weight","Weight"]].map(([k,l]) => (
              <div key={k}>
                <label style={{ fontSize: 12, color: C.sub }}>{l}</label>
                <input value={editData[k] || ""} onChange={e => setEditData(p => ({ ...p, [k]: e.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                    color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 12, color: C.sub }}>Goal</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {["Build Muscle","Lose Fat","Recomposition","Strength","General Fitness"].map(g => (
                  <button key={g} onClick={() => setEditData(p => ({ ...p, goal: g }))}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${editData.goal === g ? C.accent : C.border}`,
                      background: editData.goal === g ? C.accent + "18" : "transparent", color: editData.goal === g ? C.accent : C.sub,
                      fontSize: 12, cursor: "pointer", fontWeight: editData.goal === g ? 600 : 400 }}>{g}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: C.sub }}>Injuries (tap to toggle)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {["Back/Spine","Shoulder","Knee","Hip","Wrist/Elbow","None"].map(inj => {
                  const injuries = editData.injuries || [];
                  const active = injuries.includes(inj);
                  return (
                    <button key={inj} onClick={() => {
                      if (inj === "None") { setEditData(p => ({ ...p, injuries: ["None"] })); return; }
                      setEditData(p => {
                        const cur = (p.injuries || []).filter(x => x !== "None");
                        return { ...p, injuries: active ? cur.filter(x => x !== inj) : [...cur, inj] };
                      });
                    }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${active ? C.accent : C.border}`,
                      background: active ? C.accent + "18" : "transparent", color: active ? C.accent : C.sub,
                      fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>{inj}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: C.sub }}>Gym Access</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {["Full Gym (barbells, machines, cables)","Home Gym (dumbbells, bench, pull-up bar)","Minimal Equipment (bands, bodyweight)","Planet Fitness Style (machines, dumbbells, no barbells)"].map(g => (
                  <button key={g} onClick={() => setEditData(p => ({ ...p, gym_access: g }))}
                    style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${editData.gym_access === g ? C.accent : C.border}`,
                      background: editData.gym_access === g ? C.accent + "18" : "transparent", color: editData.gym_access === g ? C.accent : C.sub,
                      fontSize: 12, cursor: "pointer", textAlign: "left", fontWeight: editData.gym_access === g ? 600 : 400 }}>{g}</button>
                ))}
              </div>
            </div>

            <div style={{ background: C.accent + "10", borderRadius: 8, padding: 10, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>💡 Saving will regenerate your program</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>Workouts, macros, and exercise selection will update based on your changes. Your logged data is preserved.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[["Age", program.user.age],["Weight", `${program.user.weight} ${program.units === "metric" ? "kg" : "lbs"}`],
              ["Goal", program.user.goal],["Experience", program.user.experience],["Gym Access", program.user.gym_access],
              ["Training Days", (program.user.gym_days || []).join(", ")]
            ].map(([l, v]) => v && (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.sub }}>{l}</span>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Macros summary */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Your Targets</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["Calories", program.macros.calories],["Protein", program.macros.protein + "g"],
            ["Carbs", program.macros.carbs + "g"],["Fat", program.macros.fat + "g"]].map(([l,v]) => (
            <div key={l} style={{ background: C.cardAlt, borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.sub }}>{l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* App settings */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>App Settings</h3>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 14, color: C.text }}>Dark Mode</div>
            <div style={{ fontSize: 11, color: C.sub }}>Toggle light/dark theme</div>
          </div>
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            style={{ width: 50, height: 28, borderRadius: 14, border: "none", background: theme === "dark" ? C.accent : C.border,
              cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute",
              top: 3, left: theme === "dark" ? 25 : 3, transition: "left 0.2s" }} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          <div>
            <div style={{ fontSize: 14, color: C.text }}>Units</div>
            <div style={{ fontSize: 11, color: C.sub }}>{program.units === "metric" ? "Metric (kg/cm)" : "Imperial (lbs/ft)"}</div>
          </div>
        </div>
      </div>

      {/* History Logs */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <h3 style={{ color: C.text, fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>History & Logs</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[["progress","📊 Daily Check-In History"],["meals","🍽️ Meal Log History"],["workouts","🏋️ Workout History"]].map(([k,l]) => (
            <button key={k} onClick={() => setHistoryView(historyView === k ? null : k)}
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${historyView === k ? C.accent : C.border}`,
                background: historyView === k ? C.accent + "12" : C.cardAlt, color: C.text, fontSize: 14, fontWeight: 600,
                cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{l}</span>
              <span style={{ color: C.muted, fontSize: 14 }}>{historyView === k ? "▴" : "▾"}</span>
            </button>
          ))}
        </div>

        {/* Progress history */}
        {historyView === "progress" && (
          <div style={{ marginTop: 10 }}>
            {Object.keys(progressLogs).sort().reverse().map(d => {
              const log = progressLogs[d];
              return (
                <div key={d} style={{ background: C.cardAlt, borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{d}</span>
                    {log.weight && <span style={{ color: C.accent, fontSize: 13, fontWeight: 700 }}>{log.weight} {program.units === "metric" ? "kg" : "lbs"}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.sub, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {log.sleep && <span>😴 {log.sleep}</span>}
                    {log.energy && <span>⚡ {log.energy}</span>}
                    {log.soreness && <span>💪 {log.soreness}</span>}
                  </div>
                  {log.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{log.notes}</div>}
                </div>
              );
            })}
            {Object.keys(progressLogs).length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 16 }}>No logs yet</div>}
          </div>
        )}

        {/* Meal history */}
        {historyView === "meals" && (
          <div style={{ marginTop: 10 }}>
            {Object.keys(foodLog || {}).sort().reverse().slice(0, 14).map(d => {
              const dayMeals = foodLog[d]?.meals || [];
              const totals = dayMeals.reduce((a, m) => ({ cal: a.cal + (m.calories || 0), prot: a.prot + (m.protein || 0) }), { cal: 0, prot: 0 });
              return (
                <div key={d} style={{ background: C.cardAlt, borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{d}</span>
                    <span style={{ color: C.sub, fontSize: 12 }}>{totals.cal} cal • {totals.prot}g protein</span>
                  </div>
                  {dayMeals.length > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{dayMeals.map(m => m.name).join(", ")}</div>}
                </div>
              );
            })}
            {Object.keys(foodLog || {}).length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 16 }}>No meals logged yet</div>}
          </div>
        )}

        {/* Workout history */}
        {historyView === "workouts" && (
          <div style={{ marginTop: 10 }}>
            {Object.keys(workoutLogs).sort().reverse().slice(0, 20).map(k => {
              const data = workoutLogs[k];
              const doneSets = Object.values(data).filter(s => s?.done).length;
              const splitName = k.split("-").slice(3).join("-") || k;
              const dateStr = k.split("-").slice(0, 3).join("-");
              return (
                <div key={k} style={{ background: C.cardAlt, borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{splitName}</span>
                    <span style={{ color: C.sub, fontSize: 12 }}>{dateStr}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{doneSets} sets completed{data._notes ? ` • "${data._notes}"` : ""}</div>
                </div>
              );
            })}
            {Object.keys(workoutLogs).length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 16 }}>No workouts logged yet</div>}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <button onClick={() => { if (confirm("Reset all data? This can't be undone.")) onReset(); }}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: `1px solid ${C.red}40`, background: C.red + "10",
          color: C.red, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Reset All Data
      </button>

      <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 16 }}>
        Engine v0.2 • Reforged • Powered by Claude AI
      </div>
    </div>
  );
}

// ─── AI COACH BUBBLE ───
function CoachBubble({ program, workoutLogs, foodLog, progressLogs, C }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const buildContext = () => {
    const u = program.user;
    const dateKey = today();
    const todayFood = foodLog[dateKey]?.meals || [];
    const todayProgress = progressLogs[dateKey] || {};
    const recentWorkouts = Object.entries(workoutLogs).slice(-5);

    const foodTotals = todayFood.reduce((a, m) => ({
      cal: a.cal + (m.calories || 0), prot: a.prot + (m.protein || 0),
      carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0),
    }), { cal: 0, prot: 0, carbs: 0, fat: 0 });

    const progressDates = Object.keys(progressLogs).sort().reverse().slice(0, 7);
    const recentWeights = progressDates.map(d => ({ date: d, weight: progressLogs[d]?.weight })).filter(w => w.weight);

    return `You are the Reforged Coach — a concise AI fitness coach inside the Reforged app.

RESPONSE RULES:
- Keep responses under 80 words. Be direct and actionable.
- NEVER use bullet points, asterisks, or markdown formatting. Write in short plain sentences or paragraphs only.
- NEVER use * or ** for emphasis. Just write normally.
- Use the user's actual data below to personalize advice.
- Be encouraging but honest. Don't pad responses with filler.
- If they ask a simple question, give a simple answer.

USER: ${u.name || "User"}, ${u.age}yo ${u.sex}, ${u.weight}${program.units === "metric" ? "kg" : "lbs"}, Goal: ${u.goal}, Experience: ${u.experience}, Injuries: ${(u.injuries || []).join(", ") || "None"}
MACROS: ${program.macros.calories}cal / ${program.macros.protein}g protein / ${program.macros.carbs}g carbs / ${program.macros.fat}g fat
TODAY'S FOOD: ${todayFood.length > 0 ? `${foodTotals.cal}cal, ${foodTotals.prot}g protein (${todayFood.map(m => m.name).join(", ")})` : "Nothing logged"}
TODAY: Sleep ${todayProgress.sleep || "N/A"}, Energy ${todayProgress.energy || "N/A"}, Soreness ${todayProgress.soreness || "N/A"}
SPLITS: ${program.splits.map(s => s.name).join(", ")}`;
  };

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const apiMessages = [...chatHistory, { role: "user", content: userMsg }];

    try {
      // Try the Vercel serverless proxy first (production)
      // Falls back to direct Anthropic API (Claude artifact preview)
      const endpoint = "/api/coach";

      const payload = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: buildContext(),
        messages: apiMessages,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      let assistantText = data.content?.map(b => b.type === "text" ? b.text : "").join("") || "Sorry, I couldn't process that. Try again!";
      // Strip markdown formatting
      assistantText = assistantText.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^[-•]\s/gm, "→ ").replace(/^#{1,3}\s/gm, "");
      setMessages(prev => [...prev, { role: "assistant", text: assistantText }]);
      setChatHistory(prev => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: assistantText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection issue — check your network and try again." }]);
    }
    setLoading(false);
  };

  const suggestions = ["How's my nutrition?", "What should I eat?", "Recovery tips", "Next workout advice"];

  // Floating bubble button
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ position: "fixed", bottom: 70, right: 16, width: 52, height: 52, borderRadius: "50%",
          background: C.grad, border: "none", cursor: "pointer", zIndex: 150,
          boxShadow: "0 4px 20px rgba(233,69,96,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, transition: "transform 0.2s" }}
        onMouseEnter={e => e.target.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.target.style.transform = "scale(1)"}>
        🤖
      </button>
    );
  }

  // Chat panel
  return (
    <div style={{ position: "fixed", bottom: 64, right: 8, left: 8, maxWidth: 400, marginLeft: "auto",
      height: "60vh", maxHeight: 480, borderRadius: 16, background: C.bg, border: `1px solid ${C.border}`,
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)", zIndex: 200, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Reforged Coach</div>
            <div style={{ fontSize: 10, color: C.green }}>● Online</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)}
          style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.cardAlt,
            color: C.sub, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <p style={{ color: C.sub, fontSize: 12, marginBottom: 12 }}>Ask me anything about your training, nutrition, or recovery.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card,
                    color: C.text, fontSize: 11, cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{
              maxWidth: "82%", padding: "8px 12px", borderRadius: 12,
              background: msg.role === "user" ? C.accent : C.card,
              border: msg.role === "user" ? "none" : `1px solid ${C.border}`,
              color: msg.role === "user" ? "#fff" : C.text,
              fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap",
              borderBottomRightRadius: msg.role === "user" ? 3 : 12,
              borderBottomLeftRadius: msg.role === "user" ? 12 : 3,
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
            <div style={{ padding: "8px 12px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
              borderBottomLeftRadius: 3, fontSize: 13, color: C.sub }}>
              <span style={{ animation: "pulse 1.5s infinite" }}>Thinking...</span>
              <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask your coach..."
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.inputBorder}`,
              background: C.inputBg, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            style={{ padding: "0 14px", borderRadius: 10, border: "none", background: input.trim() && !loading ? C.accent : C.border,
              color: "#fff", fontSize: 15, cursor: input.trim() && !loading ? "pointer" : "default", flexShrink: 0 }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── WELCOME SCREEN ───
function WelcomeScreen({ onStart, C }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: C.grad, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 36, marginBottom: 20, boxShadow: "0 8px 30px rgba(233,69,96,0.3)" }}>🏋️</div>
      <h1 style={{ color: C.text, fontSize: 28, fontWeight: 800, marginBottom: 6, textAlign: "center" }}>Reforged</h1>
      <p style={{ color: C.sub, fontSize: 15, marginBottom: 30, textAlign: "center", maxWidth: 280 }}>
        AI-powered workout programming built around your body, goals, and schedule.
      </p>
      <button onClick={onStart} style={{ padding: "14px 40px", borderRadius: 12, border: "none", background: C.grad,
        color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(233,69,96,0.3)" }}>
        Get Started
      </button>
      <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>Takes ~2 minutes</div>
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [program, setProgram] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState({});
  const [foodLog, setFoodLog] = useState({});
  const [progressLogs, setProgressLogs] = useState({});
  const [tab, setTab] = useState("workout");
  const [timerTime, setTimerTime] = useState(null);
  const [theme, setTheme] = useState("dark");

  const C = themes[theme];

  // Load from storage
  useEffect(() => {
    (async () => {
      const p = await DB.get("program");
      const wl = await DB.get("workoutLogs");
      const fl = await DB.get("foodLog");
      const pl = await DB.get("progressLogs");
      const th = await DB.get("theme");
      if (p) { setProgram(p); setScreen("app"); } else { setScreen("welcome"); }
      if (wl) setWorkoutLogs(wl);
      if (fl) setFoodLog(fl);
      if (pl) setProgressLogs(pl);
      if (th) setTheme(th);
    })();
  }, []);

  // Auto-save
  useEffect(() => { if (program) DB.set("program", program); }, [program]);
  useEffect(() => { if (Object.keys(workoutLogs).length) DB.set("workoutLogs", workoutLogs); }, [workoutLogs]);
  useEffect(() => { if (Object.keys(foodLog).length) DB.set("foodLog", foodLog); }, [foodLog]);
  useEffect(() => { if (Object.keys(progressLogs).length) DB.set("progressLogs", progressLogs); }, [progressLogs]);
  useEffect(() => { DB.set("theme", theme); }, [theme]);

  const handleComplete = async (answers) => {
    setScreen("generating");

    // Try AI generation first
    let aiSplits = null;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userMessage: buildUserMessage(answers),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const cleaned = data.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.splits && parsed.splits.length > 0) {
          aiSplits = parsed.splits;
        }
      }
    } catch (err) {
      console.error("AI generation failed, using fallback:", err);
    }

    // Build program — use AI splits if available, otherwise fallback
    const prog = generateProgram(answers);
    if (aiSplits) {
      prog.splits = aiSplits;
      prog._aiGenerated = true;
      // Rebuild schedule with AI splits
      const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const gymDays = answers.gym_days || [];
      prog.schedule = dayNames.map((d) => {
        const gIdx = gymDays.indexOf(d);
        if (gIdx >= 0) return { day: d, type: "gym", split: aiSplits[gIdx % aiSplits.length] };
        return { day: d, type: "rest" };
      });
    }

    // Program is ready — set it directly and switch to app
    setProgram(prog);
    setScreen("app");
  };

  const handleReset = async () => {
    await DB.del("program"); await DB.del("workoutLogs"); await DB.del("foodLog");
    await DB.del("progressLogs"); await DB.del("profilePic");
    setProgram(null); setWorkoutLogs({}); setFoodLog({}); setProgressLogs({});
    setScreen("welcome");
  };

  const totalWorkouts = Object.keys(workoutLogs).length;
  const streakCount = (() => { let s = 0; const dates = [...new Set(Object.keys(workoutLogs).map(k => k.split("-").slice(0,3).join("-")))].sort().reverse(); for (let i = 0; i < dates.length; i++) { const d = new Date(dates[i]); const exp = new Date(); exp.setDate(exp.getDate() - i); if (d.toISOString().split("T")[0] === exp.toISOString().split("T")[0]) s++; else break; } return s; })();
  const latestWeight = (() => { const dates = Object.keys(progressLogs).sort().reverse(); for (const d of dates) { if (progressLogs[d]?.weight) return parseFloat(progressLogs[d].weight); } return program.user?.weight || null; })();
  const [profilePic, setProfilePic] = useState(null);
  useEffect(() => { DB.get("profilePic").then(v => v && setProfilePic(v)); }, []);

  const tabs = [
    { key: "workout", label: "Workout", icon: "🏋️" },
    { key: "meals", label: "Meals", icon: "🍽️" },
    { key: "progress", label: "Progress", icon: "📊" },
    { key: "schedule", label: "Schedule", icon: "📅" },
    { key: "settings", label: "Settings", icon: "⚙️" },
  ];

  if (screen === "loading") return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: C.sub }}>Loading...</div></div>;
  if (screen === "welcome") return <WelcomeScreen onStart={() => setScreen("questionnaire")} C={C} />;
  if (screen === "questionnaire") return <Questionnaire onComplete={handleComplete} C={C} />;
  if (screen === "generating") return <GeneratingScreen C={C} />;

  if (!program) return null;

  const targetW = program.user?.targetWeight || null;
  const unitLabel = program.units === "metric" ? "kg" : "lbs";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
      {timerTime && <RestTimer seconds={timerTime} onClose={() => setTimerTime(null)} C={C} />}

      {/* Header with profile */}
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <button onClick={() => setTab("settings")} style={{ width: 42, height: 42, borderRadius: "50%", background: C.accent + "20",
          border: `2px solid ${C.accent}`, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0 }}>{profilePic || "👤"}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{program.user?.name || "User"}</div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.sub, marginTop: 2 }}>
            <span>🔥 {streakCount}d streak</span>
            {latestWeight && <span>⚖️ {latestWeight}{unitLabel}{targetW ? ` → ${targetW}${unitLabel}` : ""}</span>}
          </div>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>REFORGED</span>
      </div>

      {/* Tab content */}
      <div style={{ paddingBottom: 70 }}>
        {tab === "workout" && <WorkoutTab program={program} workoutLogs={workoutLogs} setWorkoutLogs={setWorkoutLogs} onTimer={setTimerTime} C={C} />}
        {tab === "meals" && <MealsTab program={program} foodLog={foodLog} setFoodLog={setFoodLog} C={C} />}
        {tab === "progress" && <ProgressTab progressLogs={progressLogs} setProgressLogs={setProgressLogs} program={program} workoutLogs={workoutLogs} C={C} />}
        {tab === "schedule" && <ScheduleTab program={program} workoutLogs={workoutLogs} C={C} />}
        {tab === "settings" && <SettingsTab program={program} setProgram={setProgram} onReset={handleReset}
          workoutLogs={workoutLogs} progressLogs={progressLogs} foodLog={foodLog} theme={theme} setTheme={setTheme} C={C} />}
      </div>

      {/* Reforged Coach floating bubble */}
      <CoachBubble program={program} workoutLogs={workoutLogs} foodLog={foodLog} progressLogs={progressLogs} C={C} />

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480,
        background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", padding: "6px 0 10px", zIndex: 100 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 1, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <span style={{ fontSize: 19 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? C.accent : C.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
