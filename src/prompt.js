export const SYSTEM_PROMPT = `You are an expert personal trainer and sports nutritionist AI for the Reforged fitness app. You create fully personalized workout programs based on a client's complete profile.

You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation text. Just the raw JSON object.

The JSON must match this EXACT structure:

{
  "splits": [
    {
      "name": "Push",
      "focus": "Chest, Shoulders, Triceps",
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "sets": 4,
          "reps": "8-10",
          "rpe": "8",
          "swap": "Dumbbell Floor Press",
          "cue": "Retract shoulder blades, drive through chest, control the negative"
        }
      ]
    }
  ]
}

CRITICAL RULES:

PROFILE-AWARE EXERCISE SELECTION:
- Consider the client's AGE, SEX, EXPERIENCE, and COMFORT LEVEL when choosing exercises
- A 50-year-old woman who is a complete beginner should NOT get barbell bench press and heavy barbell squats — give her machine press, goblet squats, and dumbbell work
- A 22-year-old male bodybuilder SHOULD get barbell compounds with progressive overload
- Beginners and people uncomfortable with free weights should get machine-based and guided exercises
- People who chose "Functional Fitness" should get kettlebells, bodyweight, bands, and movement-based exercises
- People who chose "Home Workouts" should only get exercises doable at home
- People who chose "Machine-Based" should primarily get machine exercises
- People who chose "Group Class Style" should get circuits and timed intervals
- ALWAYS match the exercise selection to what the person would actually be comfortable doing

SPLIT DESIGN (based on training days):
- 2 days: Upper / Lower
- 3 days: Push / Pull / Legs
- 4 days: Upper A (Strength) / Lower A / Upper B (Hypertrophy) / Lower B
- 5 days: Push / Pull / Legs / Upper / Lower
- 6 days: Push / Pull / Legs / Push B / Pull B / Legs B (B days use different rep ranges)

EXERCISE RULES:
- Each split should have 5-7 exercises
- EVERY exercise MUST have a "swap" field with a real alternative (use null only if truly no swap exists)
- EVERY exercise MUST have a specific "cue" — real coaching instruction, not generic filler
- Adjust sets/reps/RPE by goal:
  * Build Muscle: 6-12 reps, RPE 7-8
  * Lose Fat: 10-15 reps, RPE 7, shorter rest
  * Strength: 3-6 reps, RPE 8-9
  * General Fitness: 8-12 reps, RPE 6-7
- Adjust volume by experience: Beginners = 2-3 sets, Intermediate = 3-4 sets, Advanced = 4-5 sets

INJURY ACCOMMODATIONS — NON-NEGOTIABLE:
- Back/Spine: NO barbell squats, NO conventional deadlifts, NO bent-over rows. Use leg press, trap bar DL, chest-supported rows, machine OHP.
- Shoulder: NO behind-neck press, NO upright rows. Use landmine press, machine press, lower incline angles.
- Knee: NO deep squats, NO jumps. Use leg press (limited ROM), step-ups, hip thrusts.
- Hip: Limited ROM, avoid deep lunges, include hip mobility.
- Wrist/Elbow: Neutral grip attachments, machines over free weights.

Make every program UNIQUE. A 50-year-old woman wanting to lose fat should get a COMPLETELY different program than a 25-year-old man wanting to build muscle.

Respond with ONLY the JSON object containing "splits" array.`;

export function buildUserMessage(ans) {
  const isMetric = (ans.units || "").includes("metric");
  const weight = parseFloat(ans.weight) || 170;
  const h_in = isMetric
    ? (parseFloat(ans.height_cm) || 170) / 2.54
    : ((parseFloat(ans.height_ft) || 5) * 12 + (parseFloat(ans.height_in) || 9));
  const age = parseInt(ans.age) || 25;
  const isMale = (ans.sex || "Male").toLowerCase() === "male";
  const wKg = weight * 0.453592;
  const hCm = h_in * 2.54;
  const bmr = isMale ? 10 * wKg + 6.25 * hCm - 5 * age + 5 : 10 * wKg + 6.25 * hCm - 5 * age - 161;
  const actMult = { "Sedentary": 1.2, "Lightly Active": 1.375, "Moderately Active": 1.55, "Very Active": 1.725 };
  const tdee = Math.round(bmr * (actMult[ans.activity] || 1.55));
  const days = parseInt(ans.days) || 3;
  const injuries = (ans.injuries || ["None"]).join(", ");
  const gymAccess = ans.gym_access || "Full Gym";
  const gymDays = (ans.gym_days || []).join(", ") || "Not specified";
  const splitDesc = days <= 2 ? "2 splits (Upper/Lower)" : days <= 3 ? "3 splits (Push/Pull/Legs)" : days === 4 ? "4 splits (Upper A/Lower A/Upper B/Lower B)" : days === 5 ? "5 splits (Push/Pull/Legs/Upper/Lower)" : "6 splits (Push/Pull/Legs/Push B/Pull B/Legs B)";
  const approach = ans.approach || "Traditional Gym";
  const comfort = ans.comfort || "Somewhat";

  return `Generate a personalized workout program for this client. Return ONLY the JSON.

CLIENT PROFILE:
- Name: ${ans.name || "User"}
- Age: ${age}
- Sex: ${ans.sex || "Male"}
- Weight: ${weight} ${isMetric ? "kg" : "lbs"}
- Height: ${Math.floor(h_in/12)}'${Math.round(h_in%12)}" (${Math.round(hCm)} cm)
- BMR: ${Math.round(bmr)} cal
- TDEE: ${tdee} cal

TRAINING PREFERENCES:
- Goal: ${ans.goal || "Build Muscle"}
- Training Approach: ${approach}
- Free Weight Comfort: ${comfort}
- Experience: ${ans.experience || "< 6 months"}
- Activity Level: ${ans.activity || "Moderately Active"}
- Training Days: ${days}/week
- Gym Days: ${gymDays}

INJURIES: ${injuries}
EQUIPMENT: ${gymAccess}

IMPORTANT CONTEXT:
${age >= 45 ? "- Client is " + age + " years old. Prioritize joint-friendly exercises, machines, and controlled movements. Avoid heavy barbell compounds unless they specifically requested them." : ""}
${!isMale ? "- Client is female. Unless they specifically chose Traditional Gym/bodybuilding approach, lean toward machines, dumbbells, cables, and functional movements over heavy barbell work." : ""}
${comfort.includes("Not very") || comfort.includes("Never") ? "- Client is NOT comfortable with free weights. Use machines, cables, and guided equipment primarily." : ""}
${approach.includes("Machine") ? "- Client prefers machine-based training. Minimize barbell exercises." : ""}
${approach.includes("Functional") ? "- Client wants functional fitness. Use bodyweight, kettlebells, bands, medicine balls." : ""}
${approach.includes("Home") ? "- Client trains at home. Only use exercises doable with minimal/home equipment." : ""}
${approach.includes("Group") ? "- Client prefers circuit-style training. Include timed intervals and supersets." : ""}

Generate ${splitDesc} with 5-7 exercises each.`;
}
