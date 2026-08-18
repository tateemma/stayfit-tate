/* Workout program data model.
   Adapted from the user's old trainer program (Trainerize screenshots) to the
   equipment available at the current (smaller) gym: Matrix cable/functional
   trainer, dumbbells, barbell + bumper plates, kettlebells, plyo boxes,
   bench, rings/straps, rowing machine, treadmill, elliptical.
   Same training intensity/structure, different machines. */

const CARDIO_DEFAULTS = {
  stairmaster: { label: 'Stairmaster (warm-up)', minutes: 5, intensity: 5, incline: 5, unit: 'level' },
  walk: { label: 'Treadmill Walk', minutes: 20, intensity: 4, incline: 4, unit: 'incline' },
  elliptical: { label: 'Elliptical', minutes: 20, intensity: 5, incline: 5, unit: 'resistance' }
};

const HABITS = [
  { id: 'lowCalDrinks', label: 'Low-calorie drinks only' },
  { id: 'steps', label: 'Steps ≥ 6,000' },
  { id: 'water', label: 'Water ≥ 1.5L' }
];

// Habits are tracked daily, independent of workout sessions, against a weekly target.
const WEEKLY_HABIT_TARGET = 5;

// MET values used for calorie estimation (calories.js)
const MET = {
  fullBody: 8,      // circuit / HIIT style, matches old "circuit of 3 rounds"
  strength: 5,      // moderate-vigorous superset strength work
  stairmaster: 8,    // stair climbing, vigorous even as a short warm-up
  walk: 4.3,         // treadmill incline ~4
  elliptical: 5.0    // elliptical moderate resistance
};

const PROGRAMS = [
  {
    id: 'full-body',
    title: 'Full Body',
    shortTitle: 'Full Body',
    focus: 'Full Body · Metabolic Conditioning',
    metKey: 'fullBody',
    note: 'A full-body circuit that blends strength moves with short bursts of explosive cardio. Keeps your heart rate elevated the whole session, so you keep burning calories for hours afterward (the "afterburn"/EPOC effect). Best for overall fat loss since it hits legs, glutes, shoulders, arms and core in one session.',
    fatBurn: 'Whole-body & visceral fat · highest total calorie burn of the 4 sessions',
    supersets: [
      {
        name: 'Superset 1',
        sets: 3,
        exercises: [
          { name: 'Dumbbell Jumping Jack Press', target: '45s work', equipment: 'Light dumbbells (4–6kg)', oldEquivalent: 'Jumping Jack Press', workSeconds: 45 },
          { name: 'Bodyweight Burpee', target: '40s work', equipment: 'Bodyweight', oldEquivalent: 'Battle Rope Burpee (no ropes at this gym)', workSeconds: 40 },
          { name: 'Dumbbell Thruster', target: '45s work', equipment: 'Dumbbells (6kg)', oldEquivalent: 'Dumbbell Thruster', workSeconds: 45 }
        ],
        restSeconds: 30
      },
      {
        name: 'Superset 2',
        sets: 3,
        exercises: [
          { name: 'Double Kettlebell Swing', target: '15 reps', equipment: 'Kettlebells (6–10kg)', oldEquivalent: 'Double Kettlebell Swing' },
          { name: 'Box Jump', target: '12 reps', equipment: 'Plyo box', oldEquivalent: 'Box Jump' },
          { name: 'Weighted Plate Russian Twist', target: '20 reps', equipment: 'Bumper plate (5kg)', oldEquivalent: 'Plate Russian Twist' }
        ],
        restSeconds: 45
      }
    ],
    finisherRestSeconds: 90
  },
  {
    id: 'upper-a',
    title: 'Upper Body — Push',
    shortTitle: 'Upper A (Push)',
    focus: 'Upper Body · Chest, Shoulders & Triceps',
    metKey: 'strength',
    note: 'Push-focused upper body session targeting chest, shoulders and triceps. Builds upper-body strength and shape while cardio + diet handle the fat loss — this session\'s main job is toning/building the "push" muscles you see in the mirror (chest, front shoulders, arms).',
    fatBurn: 'Upper body (chest/shoulder/arm) toning · moderate calorie burn',
    supersets: [
      {
        name: 'Superset 1',
        sets: 3,
        exercises: [
          { name: 'Dumbbell Incline Bench Press', target: '12 reps x 5–6kg dumbbells', equipment: 'Bench + dumbbells', oldEquivalent: 'Dumbbell Incline Bench Press' },
          { name: 'Barbell Overhead Press', target: '12 reps x 12kg barbell', equipment: 'Barbell + plates', oldEquivalent: 'Barbell Overhead Press' },
          { name: 'High Plank Jacks', target: '30s work', equipment: 'Bodyweight / mat', oldEquivalent: 'High Plank Jacks (core finisher)', workSeconds: 30 }
        ],
        restSeconds: 60
      },
      {
        name: 'Superset 2',
        sets: 3,
        exercises: [
          { name: 'Cable Chest Press (functional trainer)', target: '12 reps', equipment: 'Matrix cable trainer', oldEquivalent: 'Machine Seated Chest Press' },
          { name: 'Dumbbell Lateral Raise', target: '12 reps x 3kg dumbbells', equipment: 'Dumbbells', oldEquivalent: 'Dumbbell Lateral Raise' },
          { name: 'Dumbbell Overhead Tricep Extension', target: '12 reps x 5kg dumbbell', equipment: 'Dumbbells', oldEquivalent: 'Dumbbell Overhead Tricep Extension' }
        ],
        restSeconds: 60
      }
    ],
    finisherRestSeconds: 60
  },
  {
    id: 'upper-b',
    title: 'Upper Body — Pull',
    shortTitle: 'Upper B (Pull)',
    focus: 'Upper Body · Back & Biceps',
    metKey: 'strength',
    note: 'Pull-focused upper body session targeting back and biceps. Strengthens posture muscles (lats, rhomboids, rear delts) and balances out the push session — a strong back is what keeps shoulders healthy and posture upright as chest/arm strength increases.',
    fatBurn: 'Upper body (back/bicep) toning & posture · moderate calorie burn',
    supersets: [
      {
        name: 'Superset 1',
        sets: 3,
        exercises: [
          { name: 'Cable Wide Grip Lat Pulldown', target: '12 reps', equipment: 'Matrix cable trainer', oldEquivalent: 'Lat Machine Wide Grip Row' },
          { name: 'Dumbbell Single Arm Bent Over Row', target: '12 reps per arm x 10–14kg', equipment: 'Dumbbells', oldEquivalent: 'Dumbbell Single Arm Bent Over Row' },
          { name: 'V-Tuck', target: '20 reps', equipment: 'Bodyweight / mat', oldEquivalent: 'V Tuck (core finisher)' }
        ],
        restSeconds: 60
      },
      {
        name: 'Superset 2',
        sets: 3,
        exercises: [
          { name: 'Barbell Bent Over Row', target: '12–15 reps x 20kg barbell', equipment: 'Barbell + plates', oldEquivalent: 'Barbell Bent Over Row' },
          { name: 'Barbell Bicep Curl', target: '12 reps x 12–16kg barbell', equipment: 'Barbell', oldEquivalent: 'Barbell Bicep Curl' },
          { name: 'Plank Russian Twist', target: '20 reps', equipment: 'Bodyweight / mat', oldEquivalent: 'Russian Twist (core finisher)' }
        ],
        restSeconds: 60
      }
    ],
    finisherRestSeconds: 60
  },
  {
    id: 'lower-body',
    title: 'Lower Body',
    shortTitle: 'Lower Body',
    focus: 'Lower Body · Glutes, Hamstrings & Quads',
    metKey: 'strength',
    note: 'Combines glute/hamstring work (hip thrust, RDL) with quad/calf work (squats, lunges) into one session since only one lower-body day is programmed per week. Legs are the biggest muscle group, so this session drives the most strength gain and a strong metabolic boost even though it\'s "just" strength work.',
    fatBurn: 'Lower body (glutes, hamstrings, quads) & overall metabolic rate boost',
    supersets: [
      {
        name: 'Superset 1',
        sets: 3,
        exercises: [
          { name: 'Barbell Back Squat', target: '15 reps, add plates as it gets easier', equipment: 'Barbell + plates / squat rack', oldEquivalent: 'Barbell Back Squat' },
          { name: 'Dumbbell Walking Lunge', target: '20 reps x 8kg dumbbells', equipment: 'Dumbbells', oldEquivalent: 'Dumbbell Walking Lunge' },
          { name: 'Dumbbell Sumo Squat', target: '15 reps x 15–20kg dumbbell', equipment: 'Dumbbell (held vertically)', oldEquivalent: 'Dumbbell Sumo Squat' }
        ],
        restSeconds: 60
      },
      {
        name: 'Superset 2',
        sets: 3,
        exercises: [
          { name: 'Dumbbell Romanian Deadlift (RDL)', target: '15 reps x 14–15kg dumbbells', equipment: 'Dumbbells', oldEquivalent: 'Dumbbell Deadlift (RDL)' },
          { name: 'Dumbbell Hip Thrust', target: '15 reps, hold last rep 10s', equipment: 'Bench + dumbbell', oldEquivalent: 'Barbell Banded Hip Thrust' },
          { name: 'Standing Calf Raise (holding dumbbells)', target: '15 reps', equipment: 'Dumbbells / plyo box edge', oldEquivalent: 'Leg Press Machine Calf Raise' }
        ],
        restSeconds: 60
      }
    ],
    finisherRestSeconds: 60
  }
];

// Default weekly schedule mapping day-of-week (0=Sun..6=Sat) to a program id or null (rest day)
const DEFAULT_SCHEDULE = {
  0: null,           // Sun - rest
  1: 'full-body',    // Mon
  2: 'upper-a',       // Tue
  3: null,           // Wed - rest
  4: 'lower-body',    // Thu
  5: 'upper-b',       // Fri
  6: null            // Sat - rest
};

function getProgram(id) {
  return PROGRAMS.find(p => p.id === id) || null;
}
