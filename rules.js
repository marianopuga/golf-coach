// Scratch Golfer Dreams: the swing manual.
// Every rule comes from Mariano's "Golf bible" playlist, except the ones marked src "extra".
// setup: checked while you stand still, before you hit (pre-shot check, spoken as `fix`).
// motion: checked after the swing (post-shot feedback, spoken as `cue` plus `why`).
// conf "high": can be spoken and become your focus. conf "low": weak camera measurement, shown
// in the report and in "up to 3" mode, never your focus, until calibration proves it.

export const VIDEOS = {
  grip:    { title: "How To Grip A Golf Club Properly", who: "Videojug", url: "https://www.youtube.com/watch?v=mDNQ_hwQc3w" },
  setup:   { title: "How To Master Golf Set Up", who: "Videojug", url: "https://www.youtube.com/watch?v=JgObFR-d0Dw" },
  mistakes:{ title: "4 Most Common Golf Set Up Mistakes", who: "Videojug", url: "https://www.youtube.com/watch?v=HV7jRgHhUzY" },
  putting: { title: "How To Position Your Stance And Grip For Successful Putting", who: "Videojug", url: "https://www.youtube.com/watch?v=-z4eUptsYZc" },
  chipping:{ title: "How To Be Better At Your Chipping Technique", who: "Videojug", url: "https://www.youtube.com/watch?v=8o--AaG6M8k" },
  bunker:  { title: "How To Do The Greenside Bunker Shot", who: "Videojug", url: "https://www.youtube.com/watch?v=nOnVGAO5dVw" },
  maude:   { title: "To Hit Driver Straight Always Do This Before Every Swing", who: "Danny Maude", url: "https://www.youtube.com/watch?v=pGU1H5mXm98" },
  shiels:  { title: "Top 5 Driver Golf Tips", who: "Rick Shiels", url: "https://www.youtube.com/watch?v=r5u52YuNVG8" },
  irons:   { title: "How to Stop Hitting Bad Iron Shots, 3 Simple Tips", who: "Rick Shiels", url: "https://www.youtube.com/watch?v=d5M7Tc2mZCc" },
  extra:   { title: "Not from the playlist: added because you asked for it", who: "Coach", url: "" },
};

// Rule groups
export const GROUPS = { driver: "Driver", hybrid: "Hybrid", iron: "Irons", chip: "Chipping", bunker: "Bunker", putt: "Putting", warmup: "Warm up" };
export const CLUBS = GROUPS; // older name

// Mariano's bag. group: which rules apply. cat: practice category used by plans.
export const BAG = [
  { id: "driver", name: "Driver", group: "driver", cat: "driver" },
  { id: "hybrid", name: "Hybrid", group: "hybrid", cat: "hybrid" },
  { id: "4i", name: "4 iron", group: "iron", cat: "long" },
  { id: "5i", name: "5 iron", group: "iron", cat: "long" },
  { id: "6i", name: "6 iron", group: "iron", cat: "mid" },
  { id: "7i", name: "7 iron", group: "iron", cat: "mid" },
  { id: "8i", name: "8 iron", group: "iron", cat: "short" },
  { id: "9i", name: "9 iron", group: "iron", cat: "short" },
  { id: "PW", name: "Pitching wedge", group: "iron", cat: "short" },
  { id: "SW", name: "Sand wedge", group: "chip", cat: "chip" },
  { id: "PT", name: "Putter", group: "putt", cat: "putt" },
];
export const clubById = (id) => BAG.find((c) => c.id === id) || BAG[5];

// Ball position targets from Rick Shiels (irons video): 0 = trail ankle, 1 = lead ankle, 0.5 = centre.
export const BALL_POS = { SW: 0.5, PW: 0.5, "9i": 0.52, "8i": 0.54, "7i": 0.57, "6i": 0.6, "5i": 0.63, "4i": 0.65, hybrid: 0.7, driver: 0.9, PT: 0.68 };

// Practice categories
export const CATS = {
  warmup: { name: "Warm up", pick: ["PW", "9i", "SW"], base: 0, short: "Half swings, hands to hip height, about 40 to 60 m." },
  short:  { name: "Short irons", pick: ["9i", "8i", "PW"], base: 12 },
  mid:    { name: "Mid irons", pick: ["7i", "6i"], base: 25 },
  long:   { name: "Long irons", pick: ["5i", "4i"], base: 8 },
  hybrid: { name: "Hybrid", pick: ["hybrid"], base: 15 },
  driver: { name: "Driver", pick: ["driver"], base: 22 },
  random: { name: "Random", pick: [], base: 0, short: "New club every ball, like on the course." },
  chip:   { name: "Chipping", pick: ["SW", "PW"], base: 10, short: "Chips onto the green from up to 5 m off it." },
  bunker: { name: "Bunker", pick: ["SW"], base: 6, short: "Greenside bunker shots." },
  putt:   { name: "Putting", pick: ["PT"], base: 10, short: "Putts on the putting green." },
};
export const RANGE_ORDER = ["short", "mid", "long", "hybrid", "driver"];
export const SHORT_ORDER = ["chip", "bunker", "putt"];

// Practice venues (from the questionnaire)
export const VENUES = {
  sf: { id: "sf", name: "Swing Factory", place: "Terrey Hills", mode: "time", minutes: 60, rate: 1.1, tracer: true, short: [],
        about: "Toptracer bays, pay by time, unlimited balls. Say the distance on the screen after each shot." },
  pw: { id: "pw", name: "Pittwater Golf Centre", place: "Warriewood", mode: "balls", balls: 100, tracer: false, short: ["chip", "bunker", "putt"],
        about: "Pay per ball, mats and grass. Chipping green, bunker and putting green after the range." },
};

const FULL = ["driver", "hybrid", "iron"];
const SWINGS = ["driver", "hybrid", "iron", "chip", "bunker"];

// Your priorities, in your order: consistency, direction, contact, driver, short game, distance.
// Post-shot focus order follows them; your own main problem (arms, swinging too hard) comes first.
export const RULES = [
  // ---------------- Setup (pre-shot check) ----------------
  {
    id: "stance", kind: "setup", auto: true, conf: "high", view: "face", clubs: FULL, priority: 1, src: "shiels",
    title: "Stance width",
    rule: "Irons and hybrid: feet about shoulder width apart. Driver: a much wider stance than with your irons, so you can make speed.",
    fix: (m, g) => (g === "driver" ? (m.stanceRatio < 1.2 ? "Feet wider for the driver." : "Feet a bit closer.") : (m.stanceRatio < 0.85 ? "Feet a bit wider." : "Feet a bit closer.")),
    why: "A stable base lets you turn instead of sway.",
    check: (m, g) => (m.stanceRatio == null ? null : g === "driver" ? m.stanceRatio >= 1.2 && m.stanceRatio <= 2.1 : m.stanceRatio >= 0.85 && m.stanceRatio <= 1.5),
  },
  {
    id: "chipstance", kind: "setup", auto: true, conf: "high", view: "face", clubs: ["chip"], priority: 1, src: "chipping",
    title: "Chipping: feet close together",
    rule: "For a chip, stand with your feet close together and turn feet, hips and shoulders slightly left of the target (an open stance), so the follow through is easy even on a short swing.",
    fix: () => "Feet closer together for the chip.",
    why: "A narrow, open stance makes the short follow through easy.",
    check: (m) => (m.stanceRatio == null ? null : m.stanceRatio <= 0.95),
  },
  {
    id: "ballpos", kind: "setup", auto: true, conf: "high", view: "face", clubs: ["driver", "hybrid", "iron", "chip", "putt"], priority: 2, src: "irons",
    title: "Ball position for this club",
    rule: "Wedges: ball in the middle of the stance. 7 iron: about one ball left of centre. 4 and 5 iron: about two balls left of centre. Driver: just inside your left heel. Putter: forward, toward the left foot. Chip: middle of the stance, so the loft lifts the ball.",
    fix: (m) => (m.ballPosErr > 0 ? "Ball a little back." : "Ball a little forward."),
    why: "With the ball too far forward the low point comes before the ball: thin or fat.",
    check: (m) => (m.ballPosErr == null ? null : Math.abs(m.ballPosErr) <= 0.12),
  },
  {
    id: "hinge", kind: "setup", auto: true, conf: "high", view: "dtl", clubs: SWINGS, priority: 3, src: "setup",
    title: "Lean from the hips, back straight",
    rule: "Lean your upper body forward from the hips. Do not bend your back. You cannot turn around a bent spine, so you end up swinging with your arms.",
    fix: (m) => (m.hingeDeg < 20 ? "Hips back, lean from the hips." : "Stand a bit taller."),
    why: "You can only turn around a straight spine.",
    check: (m) => (m.hingeDeg == null ? null : m.hingeDeg >= 20 && m.hingeDeg <= 55),
  },
  {
    id: "knees", kind: "setup", auto: true, conf: "high", view: "dtl", clubs: [...SWINGS, "putt"], priority: 4, src: "setup",
    title: "Unlock your knees",
    rule: "Flex your knees slightly. Not locked straight, not sitting down.",
    fix: (m) => (m.kneeDeg > 172 ? "Soft knees." : "Stand up a little, less knee bend."),
    why: "Soft knees keep you balanced on the balls of your feet.",
    check: (m) => (m.kneeDeg == null ? null : m.kneeDeg >= 135 && m.kneeDeg <= 172),
  },
  {
    id: "reach", kind: "setup", auto: true, conf: "high", view: "dtl", clubs: SWINGS, priority: 5, src: "setup",
    title: "Distance to the ball: arms hang",
    rule: "With the right posture your arms hang naturally from your shoulders. If your hands reach out in front of your shoulders you are too far from the ball; if they are tucked behind, you are too close.",
    fix: (m) => (m.reach > 0.3 ? "Step a little closer, let your arms hang." : "Step back a little, give your hands room."),
    why: "Hanging arms put the club on the right plane without effort.",
    check: (m) => (m.reach == null ? null : m.reach >= -0.05 && m.reach <= 0.3),
  },
  {
    id: "weightset", kind: "setup", auto: true, conf: "high", view: "face", clubs: ["iron", "chip"], priority: 6, src: "irons",
    title: "Irons and chips: weight on the left foot",
    rule: "Push the middle of your chest slightly toward the target so about 65% of your weight is on your left foot (Rick Shiels). For a chip, put slightly more weight on the left foot and keep it there the whole swing (Videojug).",
    fix: () => "Chest a bit toward the target, more weight on your front foot.",
    why: "Weight left lets you hit the ball first, then the ground.",
    check: (m) => (m.addrWeight == null ? null : m.addrWeight >= 0.55),
  },
  {
    id: "tilt", kind: "setup", auto: true, conf: "high", view: "face", clubs: FULL, priority: 7, src: "setup",
    title: "Left shoulder higher at setup",
    rule: "Your left hand is above the right on the grip, so your left shoulder sits higher and your upper body leans slightly behind the ball. With the driver, add a bit more tilt so you can hit up on the ball (Rick Shiels).",
    fix: (m, g) => (g === "driver" ? "Tilt away from the target a bit, right shoulder lower." : "Right shoulder a little lower."),
    why: "It sets your arms to hang in the right place for the grip.",
    check: (m, g) => (m.tiltDeg == null ? null : g === "driver" ? m.tiltDeg >= 3 && m.leadShHigher > 0 : m.leadShHigher >= 0.02),
  },
  {
    id: "handsahead", kind: "setup", auto: true, conf: "low", view: "face", clubs: ["iron", "chip"], priority: 8, src: "irons",
    title: "Hands slightly ahead of the ball",
    rule: "Preset the handle slightly forward at setup and return to that position at impact (Rick Shiels). For a chip, rest the shaft against the inside of your left thigh (Videojug).",
    fix: () => "Hands a little ahead of the ball.",
    why: "It helps you strike the ball before the ground.",
    check: (m, g) => (m.handsAhead == null ? null : m.handsAhead >= (g === "chip" ? 0.06 : 0.02)),
  },
  {
    id: "forearms", kind: "setup", auto: true, conf: "low", view: "dtl", clubs: FULL, priority: 9, src: "maude",
    title: "Right arm not above the left",
    rule: "Slicers set up with the right elbow pointing out and the right arm higher than the left, so the face is open to the path. Keep the right elbow pointing down and turn the right palm to face the target. Looking down the line, the right arm should not sit above the left.",
    fix: () => "Right elbow down, right arm under the left.",
    why: "A high right arm opens the face to your path, and the ball slices.",
    check: (m) => (m.forearmGap == null ? null : m.forearmGap <= 0.06),
  },
  {
    id: "heels", kind: "setup", auto: true, conf: "low", view: "dtl", clubs: SWINGS, priority: 10, src: "mistakes",
    title: "Weight on the balls of your feet",
    rule: "Your weight sits on the balls of your feet, not on your heels. Weight on the heels makes the swing go flat around the body and pulls the ball left. The camera can only guess this from where your shoulders sit over your feet.",
    fix: () => "Weight toward the balls of your feet.",
    why: "Weight on the heels makes the swing flat and pulls the ball left.",
    check: (m) => (m.shoulderOverFeet == null ? null : m.shoulderOverFeet >= 0.06),
  },
  {
    id: "eyesover", kind: "setup", auto: true, conf: "high", view: "dtl", clubs: ["putt"], priority: 2, src: "putting",
    title: "Putting: eyes over the ball",
    rule: "Lean forward from your hips until your eyes are directly over the ball, so you can see where you aim. Do not bend too far over: distance is easier to judge.",
    fix: (m) => (m.eyesOver > 0 ? "Lean a little less, eyes over the ball." : "Lean a little more, eyes over the ball."),
    why: "With your eyes over the ball you see the line.",
    check: (m) => (m.eyesOver == null ? null : Math.abs(m.eyesOver) <= 0.12),
  },

  // ---------------- Motion (post-shot feedback) ----------------
  {
    id: "arms", kind: "motion", auto: true, conf: "high", view: "face", clubs: FULL, priority: 1, src: "shiels",
    title: "Use your body, not just your arms",
    rule: "Your shoulders and hips turn and your arms follow what the body allows. On the way down the body turns, the hips fire, and only at the end do the arms add a bit of speed.",
    cue: "All arms. Turn your chest away, arms follow.",
    why: "Your body makes the speed, the arms only follow.",
    ok: "Good turn, the body led.",
    check: (m) => (m.shoulderTurn == null ? null : m.shoulderTurn <= 0.7),
  },
  {
    id: "tempo", kind: "motion", auto: true, conf: "low", view: "both", clubs: FULL, priority: 2, src: "extra",
    title: "Smooth tempo, not a hit",
    rule: "A flowing swing (Videojug) needs a backswing that takes clearly longer than the downswing. You said you swing too hard: the app measures how long your backswing and downswing take and tracks the ratio. Your target is set from your calibration, not from the internet.",
    cue: "Too quick. Slower back, smooth start down.",
    why: "A rushed swing is all arms and no body.",
    ok: "Nice tempo.",
    check: (m) => (m.tempoRatio == null ? null : m.tempoRatio >= 2.5),
  },
  {
    id: "sway", kind: "motion", auto: true, conf: "high", view: "face", clubs: SWINGS, priority: 3, src: "extra",
    title: "Turn, don't sway",
    rule: "On the backswing your hips turn instead of sliding away from the target. Not a playlist tip: included because you said you move from side to side.",
    cue: "Sway. Turn around your right hip, don't slide.",
    why: "Sliding moves the low point, so contact changes every swing.",
    ok: "No sway.",
    check: (m, g) => (m.sway == null ? null : m.sway <= (g === "chip" ? 0.15 : 0.22)),
  },
  {
    id: "posture", kind: "motion", auto: true, conf: "high", view: "both", clubs: SWINGS, priority: 4, src: "bunker",
    title: "Keep your height through the swing",
    rule: "Keep the height of your body constant through the swing. Do not stand up or dip down before impact.",
    cue: (m) => ((m.headRise ?? 0) > 0 || (m.hingeLoss ?? 0) > 10 ? "Stood up. Keep your height until the ball is gone." : "Dipped down. Keep your height."),
    why: "Standing up gives thin and topped shots, dipping gives fat ones.",
    ok: "Kept your height.",
    check: (m) => {
      if (m.headRise == null) return null;
      if (Math.abs(m.headRise) > 0.12) return false;
      if (m.hingeLoss != null && m.hingeLoss > 10) return false;
      return true;
    },
  },
  {
    id: "feet", kind: "motion", auto: true, conf: "high", view: "face", clubs: SWINGS, priority: 5, src: "extra",
    title: "Stay stable on your feet",
    rule: "Your feet stay planted through the swing. Not a playlist tip: included because you said you feel unstable.",
    cue: "Feet moved. Stay planted, swing easier.",
    why: "If your feet move, nothing else can repeat.",
    ok: "Stable feet.",
    check: (m) => (m.feetMoved == null ? null : m.feetMoved <= 0.15),
  },
  {
    id: "stayleft", kind: "motion", auto: true, conf: "high", view: "face", clubs: ["iron", "chip"], priority: 6, src: "irons",
    title: "Stay on the left side through impact",
    rule: "Keep your weight on your left foot through the backswing and impact. Hanging back on the right foot to lift the ball gives thin and fat shots (Rick Shiels). For a chip, the weight stays on the left foot the whole swing (Videojug).",
    cue: "Fell back. Stay on your left side.",
    why: "Weight back means you hit the ground or the top of the ball.",
    ok: "Weight stayed left.",
    check: (m) => (m.impWeight == null ? null : m.impWeight >= 0.5),
  },
  {
    id: "transfer", kind: "motion", auto: true, conf: "high", view: "face", clubs: FULL, priority: 7, src: "setup",
    title: "Finish on your left side",
    rule: "Shift your weight to the right for the backswing and to the left for the follow through. Finish with your whole body facing the target.",
    cue: "Finished on your back foot. Finish on the left, facing the target.",
    why: "A full finish shows the body led the swing.",
    ok: "Good finish.",
    check: (m) => (m.transfer == null ? null : m.transfer >= 0.65),
  },
  {
    id: "upper", kind: "motion", auto: true, conf: "low", view: "face", clubs: ["driver", "hybrid"], priority: 8, src: "maude",
    title: "Driver: upper body behind the ball",
    rule: "Imagine one dot in the middle of your chest and one in the middle of your pelvis. If the upper dot gets ahead of the lower dot coming through, you are in slice territory. Keep your head feeling behind the ball through impact (Danny Maude), with a slight tilt back so you hit up (Rick Shiels).",
    cue: "Upper body got ahead. Head behind the ball.",
    why: "Chest ahead of the hips is slice territory.",
    ok: "Stayed behind the ball.",
    check: (m) => (m.upperAhead == null ? null : m.upperAhead <= 0.02),
  },
  {
    id: "flip", kind: "motion", auto: true, conf: "low", view: "face", clubs: ["iron", "chip"], priority: 9, src: "irons",
    title: "No scooping at impact",
    rule: "At impact the grip is ahead of the ball and the left arm, wrist and shaft make one straight line. Do not flip or cup the wrist trying to lift the ball: the club gets it in the air (Rick Shiels). In a chip, arms and wrists stay passive (Videojug).",
    cue: "Wrists flipped. Keep the handle ahead through the ball.",
    why: "Scooping makes thin and fat shots and costs distance.",
    ok: "Wrists stayed quiet.",
    check: (m) => (m.wristFlip == null ? null : m.wristFlip <= 25),
  },
  {
    id: "vshape", kind: "motion", auto: true, conf: "low", view: "face", clubs: ["chip"], priority: 3, src: "chipping",
    title: "Chipping: keep the V",
    rule: "The swing comes from your body rotating, leading the arms and hands. Check the V between your shoulders and hands: it stays the same through the swing.",
    cue: "The V broke. Turn the body, quiet hands.",
    why: "Hands and wrists change the loft and the distance.",
    ok: "Kept the V.",
    check: (m) => (m.vChange == null ? null : m.vChange <= 0.15),
  },
  {
    id: "pendulum", kind: "motion", auto: true, conf: "high", view: "face", clubs: ["chip", "putt"], priority: 2, src: "chipping",
    title: "Back and through the same length",
    rule: "The chip and the putt are like a pendulum: the backswing is as long as the follow through. A common mistake is to hit the ball and stop instead of swinging through it.",
    cue: (m) => (m.pendulum < 1 ? "Short finish. Swing through as far as you went back." : "Long backswing, then you slowed down. Shorter back, same through."),
    why: "Equal lengths give you control of the distance.",
    ok: "Nice pendulum.",
    check: (m) => (m.pendulum == null ? null : m.pendulum >= 0.75 && m.pendulum <= 1.5),
  },
  {
    id: "headstill", kind: "motion", auto: true, conf: "high", view: "face", clubs: ["putt"], priority: 1, src: "putting",
    title: "Putting: head and knees still",
    rule: "The stroke comes from the shoulders and chest. The arms and hands rock back and forth while the head and knees stay still. No wrists.",
    cue: "Head moved. Keep it still until the ball is gone.",
    why: "A still head keeps the face square.",
    ok: "Head stayed still.",
    check: (m) => (m.headMove == null ? null : m.headMove <= 0.06),
  },

  // ---------------- Read and practise (not measured) ----------------
  { id: "grip-left", auto: false, src: "grip", title: "Left hand grip",
    rule: "Let the arm hang naturally. Put the grip under the heel of the left palm and wrap the fingers around it. Looking down you see two or three knuckles. Left thumb on top of the grip, relaxed, not stretched." },
  { id: "grip-right", auto: false, src: "grip", title: "Right hand grip",
    rule: "Let the right arm hang and put the hand on the grip without bending the hand or wrist. Grip toward the tips of the fingers, not the base. The left thumb sits in the groove of the right hand. Right thumb in line with the right shoulder. Wrist in a straight line with the arm." },
  { id: "grip-style", auto: false, src: "grip", title: "Your grip: Vardon",
    rule: "You use the Vardon grip: the little finger of your right hand rests between the index and middle fingers of your left hand." },
  { id: "grip-check", auto: false, src: "grip", title: "Grip check",
    rule: "Stretch your arm out in front: if the club face stays square, the grip is right. If it turns, adjust. Do not look into your hands while gripping: it twists the wrists." },
  { id: "grip-palm", auto: false, src: "mistakes", title: "Fingers, not palm",
    rule: "Gripping with the palm of the left hand instead of the fingers opens the club face in the downswing and you slice." },
  { id: "aim", auto: false, src: "mistakes", title: "Aim straight",
    rule: "Most golfers aim to the right without knowing it, then open the shoulders to compensate and slice. Aim straight at the target with your shoulders square. The camera needs a club on the ground to check this." },
  { id: "setup-steps", auto: false, src: "setup", title: "Setup in five steps",
    rule: "1. Club behind the ball, face to the target, sole on the ground. 2. Feet shoulder width, ball slightly forward of middle. 3. Lean from the hips. 4. Unlock the knees, weight on the balls of the feet. 5. Take the grip, left shoulder higher." },
  { id: "driver-up", auto: false, src: "shiels", title: "Hit up with the driver",
    rule: "Like a plane taking off, the club moves up into the ball. Keep the upper body slightly tilted back through impact while the hips turn." },
  { id: "speed", auto: false, src: "shiels", title: "Don't slow down with the driver",
    rule: "Do not guide the ball. The club head must be at its fastest through the ball and after it, with your arms fully extending. The camera is too slow to measure this." },
  { id: "strike", auto: false, src: "shiels", title: "Hit the centre of the face",
    rule: "Spray foot powder on the face to see where you strike. After each shot say \"center\", \"toe\" or \"heel\" and the app logs it." },
  { id: "chip-steps", auto: false, src: "chipping", title: "Chipping in three steps",
    rule: "Use chipping up to 5 m from the green. 1. Club flat on its sole, face square to the target, about half a metre behind the ball; feet close together, body slightly open; ball in the middle. 2. Lean from the hips, legs slightly bent, a bit more weight on the left foot, shaft against the inside of the left thigh. 3. Keep the weight left, let the body lead, arms and wrists passive, back as long as through, finish facing the target." },
  { id: "putt-setup", auto: false, src: "putting", title: "Putting setup",
    rule: "Putter on its sole, face square to the target. Feet parallel to the target line, ball forward toward the left foot so you catch it on the upswing. Lean from the hips until your eyes are over the ball, knees slightly flexed, weight on the balls of the feet, arms hanging." },
  { id: "putt-grip", auto: false, src: "putting", title: "Putting grip",
    rule: "Right hand on, thumb straight down. Left index finger over the first two fingers of the right hand, left thumb in the groove of the right hand. Or the reverse grip, left hand below. Very light grip pressure." },
  { id: "putt-stroke", auto: false, src: "putting", title: "Putting stroke",
    rule: "The stroke comes from the shoulders and chest; no hands or wrists, so the face stays square. Short putts go straight back and through; long putts turn a bit inside. Back as long as through, and swing through the ball instead of hitting it." },
  { id: "bunker", auto: false, src: "bunker", title: "Greenside bunker",
    rule: "Sand wedge, face open. Aim about 3 m left with an open stance, ball forward. Do not touch the sand at address. Hit the sand 5 to 8 cm behind the ball, hands passive, no release, swing along your stance line, keep your height, full finish." },
];

// Ball flight words, how bad each outcome is, and what your playlist says about it.
export const RESULT_TIPS = {
  slice: "Slices: check your setup forearms (Danny Maude): right elbow down, right palm facing the target. Check you are not aiming right (Videojug) and that your upper body stays behind your hips at impact.",
  hook: "Hooks: Danny Maude says to go toward the opposite feeling. Your forearms may be too closed at setup, with the left hand too far on top.",
  pull: "Pulls left: weight on the heels makes the swing travel flat and pull the ball left (Videojug, set up mistakes).",
  push: "Pushes right: often the aim. Most golfers aim right without knowing it (Videojug, set up mistakes).",
  thin: "Thin shots (Rick Shiels, irons): ball not too far forward, 65% of your weight on the left foot through impact, handle ahead of the ball instead of flipping.",
  top: "Topped shots: keep your height through the swing (Videojug) and stay on your left side (Rick Shiels).",
  fat: "Fat shots (Rick Shiels, irons): ball position for each club, weight on the left foot instead of hanging back, handle ahead at impact.",
  shank: "Shanks: check your distance to the ball at setup, arms hanging naturally.",
  sky: "Skied shots with the driver: tee lower and hit up, not down (Rick Shiels).",
};
export const RESULTS = ["straight", "slice", "hook", "push", "pull", "thin", "top", "fat", "shank", "sky"];
export const BAD_RESULTS = RESULTS.filter((r) => r !== "straight");

export const CAMERA = {
  face: "Camera in front of you, about 3 metres away, at hand height. Whole body and the ball in the picture.",
  dtl: "Camera behind you, on the line from your hands to the target, about 3 metres back, at hand height. Whole body and the ball in the picture.",
};

// Words the app understands through your earphones (English or Spanish).
export const VOICE_HELP = [
  ["straight, slice, hook, push, pull", "How the ball flew. Add \"big\" or \"hard\" if it was bad, \"a bit\" or \"small\" if it was only a little. Spanish works too: \"derecha\", \"muy a la izquierda\"."],
  ["thin, top, fat, shank, sky", "How you hit it. \"Por arriba\" also means top."],
  ["short, a number", "\"Straight but short\". At Swing Factory say the distance on the screen, for example \"one forty\"."],
  ["center, toe, heel", "Where it hit the face, if you use foot powder spray."],
  ["practice", "That was a practice swing. The app also detects most of them on its own."],
  ["wrong", "The last correction was wrong."],
  ["pause, resume", "Stop and start the session, for example when a friend hits."],
  ["skip, repeat, explain", "Change the focus, hear it again, or hear the full tip."],
  ["next, status", "Next block, or how many balls and minutes are left."],
];
