/* Calorie estimation.
   Formula: calories = MET x bodyWeightKg x hours
   Only counts items the user actually marked as done, so the estimate
   reflects the real session, not the planned one. */

const DEFAULT_BODYWEIGHT_KG = 75;

function secondsForExercise(superset) {
  // rough time-per-exercise = sets * (assumed work time + rest time)
  const workSec = 40;
  return superset.sets * (workSec + (superset.restSeconds || 60));
}

async function getCurrentBodyWeight() {
  const logs = await getAllBodyLogs();
  if (logs.length) return logs[logs.length - 1].weightKg;
  return await getSetting('defaultBodyWeight', DEFAULT_BODYWEIGHT_KG);
}

function cardioCalories(cardioState, bodyWeightKg) {
  let total = 0;
  const breakdown = {};
  for (const key of Object.keys(cardioState)) {
    const c = cardioState[key];
    if (!c || !c.done) continue;
    const met = MET[key] ?? (key === 'walk' ? MET.walk : MET.elliptical);
    const hours = (c.minutes || 0) / 60;
    const kcal = met * bodyWeightKg * hours;
    breakdown[key] = Math.round(kcal);
    total += kcal;
  }
  return { total: Math.round(total), breakdown };
}

function strengthCalories(program, doneExerciseKeys, bodyWeightKg) {
  // doneExerciseKeys: Set of "supersetIdx:exerciseIdx" strings that are marked done
  const met = MET[program.metKey] ?? MET.strength;
  let totalSeconds = 0;
  program.supersets.forEach((ss, ssIdx) => {
    ss.exercises.forEach((ex, exIdx) => {
      const key = `${ssIdx}:${exIdx}`;
      if (doneExerciseKeys.has(key)) {
        totalSeconds += secondsForExercise(ss) / ss.exercises.length;
      }
    });
  });
  const hours = totalSeconds / 3600;
  return Math.round(met * bodyWeightKg * hours);
}

async function estimateSessionCalories(program, cardioState, doneExerciseKeys) {
  const bodyWeightKg = await getCurrentBodyWeight();
  const cardio = cardioCalories(cardioState, bodyWeightKg);
  const strength = strengthCalories(program, doneExerciseKeys, bodyWeightKg);
  return {
    total: cardio.total + strength,
    cardio: cardio.total,
    cardioBreakdown: cardio.breakdown,
    strength,
    bodyWeightKg
  };
}
