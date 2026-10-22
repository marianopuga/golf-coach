// Golf Bible: the swing manual.
// Every rule comes from Mariano's "Golf bible" YouTube playlist, except the two marked "extra".
// auto: checked by the camera. conf "high": can become your focus. conf "low": the camera
// measurement is weak, so it is only mentioned in "up to 3" mode and in the report.

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
  extra:   { title: "Obvious fault (not in the playlist)", who: "Coach", url: "" },
};

// Rule groups (which rules apply)
export const CLUBS = { driver: "Driver", hybrid: "Hybrid", iron: "Irons", wedge: "Wedge / chip" };

// Mariano's bag. cat = practice category used by the session plan.
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
  { id: "SW", name: "Sand wedge", group: "wedge", cat: "chip" },
];
export const clubById = (id) => BAG.find((c) => c.id === id) || BAG[5];

// Practice categories, in the order they are played after the warm up (short to long).
export const CATS = {
  warmup: { name: "Warm up", pick: ["PW", "9i", "SW"], base: 0, note: "Half swings, easy tempo." },
  short:  { name: "Short irons", pick: ["9i", "8i", "PW"], base: 12 },
  mid:    { name: "Mid irons", pick: ["7i", "6i"], base: 25 },
  long:   { name: "Long irons", pick: ["5i", "4i"], base: 8 },
  hybrid: { name: "Hybrid", pick: ["hybrid"], base: 15 },
  driver: { name: "Driver", pick: ["driver"], base: 22 },
  chip:   { name: "Chipping", pick: ["SW", "PW"], base: 10, note: "Short chips to a target." },
};
export const CAT_ORDER = ["short", "mid", "long", "hybrid", "driver", "chip"];

const FULL = ["driver", "hybrid", "iron"];
const ALL = ["driver", "hybrid", "iron", "wedge"];

// view: "face" = phone in front of you, "dtl" = phone behind you looking at the target.
// priority: lower is fixed first. Your own problems (arms, sway, balance) come right after
// the two quickest setup fixes.
export const RULES = [
  {
    id: "hinge", auto: true, conf: "high", view: "dtl", clubs: ALL, priority: 1, src: "setup",
    title: "Lean from the hips, back straight",
    rule: "Lean your upper body forward from the hips. Do not bend your back. You cannot turn around a bent spine, so you end up swinging with your arms.",
    cue: (m) => m.hingeDeg < 20 ? "Too upright. Hips back, lean from the hips." : "Too bent over. Stand a bit taller.",
    ok: "Good posture.",
    check: (m) => m.hingeDeg == null ? null : (m.hingeDeg >= 20 && m.hingeDeg <= 55),
  },
  {
    id: "knees", auto: true, conf: "high", view: "dtl", clubs: ALL, priority: 2, src: "setup",
    title: "Unlock your knees",
    rule: "Flex your knees slightly. Not locked straight, not sitting down.",
    cue: (m) => m.kneeDeg > 172 ? "Knees locked. Soft flex." : "Sitting too low. Straighten the knees a little.",
    ok: "Good knee flex.",
    check: (m) => m.kneeDeg == null ? null : (m.kneeDeg >= 135 && m.kneeDeg <= 172),
  },
  {
    id: "arms", auto: true, conf: "high", view: "face", clubs: FULL, priority: 3, src: "shiels",
    title: "Use your body, not just your arms",
    rule: "Your shoulders and hips turn and your arms follow what the body allows. On the way down the body turns, the hips fire, and only at the end do the arms add a bit of speed.",
    cue: "All arms. Turn your chest away, arms follow.",
    ok: "Good turn, the body led.",
    check: (m) => m.shoulderTurn == null ? null : m.shoulderTurn <= 0.7,
  },
  {
    id: "sway", auto: true, conf: "high", view: "face", clubs: ALL, priority: 4, src: "extra",
    title: "Turn, don't sway",
    rule: "On the backswing your hips turn instead of sliding away from the target. Not a playlist tip: included because it is one of your main problems and it is very visible.",
    cue: "Sway. Turn around your right hip, don't slide.",
    ok: "No sway.",
    check: (m, club) => m.sway == null ? null : m.sway <= (club === "wedge" ? 0.15 : 0.22),
  },
  {
    id: "feet", auto: true, conf: "high", view: "face", clubs: ALL, priority: 5, src: "extra",
    title: "Stay stable on your feet",
    rule: "Your feet stay planted through the swing. Not in the playlist: included because you said you feel unstable.",
    cue: "Feet moved. Stay planted, swing smoother.",
    ok: "Stable feet.",
    check: (m) => m.feetMoved == null ? null : m.feetMoved <= 0.15,
  },
  {
    id: "ironweight", auto: true, conf: "high", view: "face", clubs: ["iron"], priority: 6, src: "irons",
    title: "Irons: weight 65% on the left foot",
    rule: "With the irons, push the middle of your chest slightly toward the target so about 65% of your weight is on your left foot. Keep it there in the backswing without moving off the ball, and stay there through impact. Hanging back on the right foot to lift the ball causes thin and fat shots.",
    cue: (m) => (m.addrWeight ?? 1) < 0.55 ? "Weight centred. Chest a bit left, 65 percent left foot." : "Fell back at impact. Stay on your left side.",
    ok: "Weight stayed left.",
    check: (m) => m.addrWeight == null ? null : (m.addrWeight >= 0.55 && (m.impWeight == null || m.impWeight >= 0.5)),
  },
  {
    id: "stance", auto: true, conf: "high", view: "face", clubs: FULL, priority: 7, src: "shiels",
    title: "Stance width",
    rule: "Irons and hybrid: feet about shoulder width apart. Driver: a much wider stance than with your irons, ball just inside your left heel.",
    cue: (m, club) => club === "driver"
      ? (m.stanceRatio < 1.2 ? "Stance too narrow for driver. Go wider." : "Stance too wide. A bit narrower.")
      : (m.stanceRatio < 0.85 ? "Feet too close. Shoulder width." : "Stance too wide. Shoulder width."),
    ok: "Good stance width.",
    check: (m, club) => m.stanceRatio == null ? null
      : club === "driver" ? (m.stanceRatio >= 1.2 && m.stanceRatio <= 2.1)
      : (m.stanceRatio >= 0.85 && m.stanceRatio <= 1.5),
  },
  {
    id: "transfer", auto: true, conf: "high", view: "face", clubs: ALL, priority: 8, src: "setup",
    title: "Weight to the left in the follow through",
    rule: "Shift your weight to the right for the backswing and to the left for the follow through. Finish with your whole body facing the target.",
    cue: "Finished on your back foot. Finish on the left, facing the target.",
    ok: "Good finish on the left.",
    check: (m, club) => m.transfer == null ? null : m.transfer >= (club === "wedge" ? 0.5 : 0.65),
  },
  {
    id: "posture", auto: true, conf: "high", view: "both", clubs: ALL, priority: 9, src: "bunker",
    title: "Keep your height through the swing",
    rule: "Keep the height of your body constant through the swing. Do not stand up or dip down before impact.",
    cue: (m) => (m.headRise ?? 0) > 0 || (m.hingeLoss ?? 0) > 10 ? "Stood up. Keep your height until after the ball." : "Dipped down. Keep your height.",
    ok: "Kept your height.",
    check: (m) => {
      if (m.headRise == null) return null;
      if (Math.abs(m.headRise) > 0.12) return false;
      if (m.hingeLoss != null && m.hingeLoss > 10) return false;
      return true;
    },
  },
  // Weak camera measurements: never your focus, only in "up to 3" mode and the report.
  {
    id: "heels", auto: true, conf: "low", view: "dtl", clubs: ALL, priority: 20, src: "mistakes",
    title: "Weight on the balls of your feet",
    rule: "At setup your weight sits on the balls of your feet, not on your heels. Weight on the heels makes the swing go flat around the body and pulls the ball left. The camera can only guess this from where your shoulders sit over your feet.",
    cue: "Maybe on your heels. Weight to the balls of the feet.",
    ok: "Weight looks forward.",
    check: (m) => m.shoulderOverFeet == null ? null : m.shoulderOverFeet >= 0.06,
  },
  {
    id: "tilt", auto: true, conf: "low", view: "face", clubs: FULL, priority: 21, src: "setup",
    title: "Left shoulder higher at setup",
    rule: "Your left hand is above the right on the grip, so your left shoulder sits higher and your upper body leans slightly behind the ball. With the driver, add a bit more of that tilt so you can hit up on the ball.",
    cue: (m, club) => club === "driver" ? "Tilt away from the target a bit, right shoulder lower." : "Right shoulder a little lower than the left.",
    ok: "Good shoulder tilt.",
    check: (m, club) => m.tiltDeg == null ? null
      : club === "driver" ? (m.tiltDeg >= 3 && m.leadShHigher > 0)
      : m.leadShHigher >= 0.02,
  },
  {
    id: "upper", auto: true, conf: "low", view: "face", clubs: ["driver", "hybrid"], priority: 22, src: "maude",
    title: "Upper body behind the pelvis at impact",
    rule: "Imagine one dot in the middle of your chest and one in the middle of your pelvis. If the upper dot gets ahead of the lower dot coming through, you are in slice territory. Keep your head feeling behind the ball through impact. Checked only with driver and hybrid: with irons, Rick Shiels wants your chest slightly toward the target.",
    cue: "Upper body got ahead. Head behind the ball.",
    ok: "Stayed behind the ball.",
    check: (m) => m.upperAhead == null ? null : m.upperAhead <= 0.02,
  },

  // Manual only (the camera cannot see these reliably)
  { id: "grip-left", auto: false, src: "grip", title: "Left hand grip",
    rule: "Let the arm hang naturally. Put the grip under the heel of the left palm and wrap the fingers around it. Looking down you see two or three knuckles. Left thumb on top of the grip, relaxed, not stretched." },
  { id: "grip-right", auto: false, src: "grip", title: "Right hand grip",
    rule: "Let the right arm hang and put the hand on the grip without bending the hand or wrist. Grip toward the tips of the fingers, not the base. The left thumb sits in the groove of the right hand. Right thumb in line with the right shoulder. Wrist in a straight line with the arm." },
  { id: "grip-style", auto: false, src: "grip", title: "Connect the hands",
    rule: "Vardon: right little finger between left index and middle fingers. Interlock: right little finger locked with left index finger (good for smaller hands). Baseball: all ten fingers on the club." },
  { id: "grip-check", auto: false, src: "grip", title: "Grip check",
    rule: "Stretch your arm out in front: if the club face stays square, the grip is right. If it turns, adjust. Do not look into your hands while gripping, it twists the wrists." },
  { id: "grip-palm", auto: false, src: "mistakes", title: "Fingers, not palm",
    rule: "Gripping with the palm of the left hand instead of the fingers opens the club face in the downswing and you slice." },
  { id: "aim", auto: false, src: "mistakes", title: "Aim straight",
    rule: "Most golfers aim to the right without knowing it, then open the shoulders to compensate and slice. Aim straight at the target with your shoulders square." },
  { id: "setup-steps", auto: false, src: "setup", title: "Setup in five steps",
    rule: "1. Club behind the ball, face to the target, sole on the ground. 2. Feet shoulder width, ball slightly forward of middle. 3. Lean from the hips. 4. Unlock the knees, weight on the balls of the feet. 5. Take the grip, left shoulder higher." },
  { id: "ballpos", auto: false, src: "irons", title: "Ball position by club",
    rule: "Wedges: ball in the middle of the stance. 7 iron: about one ball left of centre. 4 and 5 iron: about two balls left of centre. Woods: toward the left heel. Ball too far forward makes the low point happen behind the ball, so you hit thin or fat. Easy setup: club behind the ball in the middle of your feet, then a small step with the left foot and a slightly bigger one with the right." },
  { id: "shaftlean", auto: false, src: "irons", title: "Irons: handle ahead at impact",
    rule: "At impact the grip is ahead of the ball and the left arm, wrist and shaft make one straight line. Do not flip or cup the wrist trying to lift the ball; the club gets it in the air. Preset the handle slightly forward at setup and return to that position at impact. It should feel like hitting it lower." },
  { id: "forearms", auto: false, src: "maude", title: "Face to path: forearms at setup",
    rule: "If you slice: at setup your right elbow points out and your right arm sits higher than the left, so the face is open to your path. Fix: keep the right elbow pointing down, turn the right palm to face the target, and the left hand slightly more on top. Looking down the line you should no longer see the right arm above the left." },
  { id: "driver-up", auto: false, src: "shiels", title: "Hit up with the driver",
    rule: "Like a plane taking off, the club moves up into the ball. Keep the upper body slightly tilted back through impact while the hips turn." },
  { id: "speed", auto: false, src: "shiels", title: "Don't slow down with the driver",
    rule: "Do not guide the ball. The club head must be at its fastest through the ball and after it, with your arms fully extending. The camera is too slow to measure this reliably, so it is not checked." },
  { id: "strike", auto: false, src: "shiels", title: "Hit the centre of the face",
    rule: "Spray foot powder on the face to see where you strike. Aim for the middle every time." },
  { id: "bunker", auto: false, src: "bunker", title: "Greenside bunker",
    rule: "Sand wedge, face open. Aim about 3 m left with an open stance, ball forward. Do not touch the sand at address. Hit the sand 5 to 8 cm behind the ball, hands passive, no release, swing along your stance line, keep your height, full finish." },
  { id: "chipping", auto: false, src: "chipping", title: "Chipping",
    rule: "Pending: the transcript of this video could not be read. Paste it in the chat with Claude to add its rules." },
  { id: "putting", auto: false, src: "putting", title: "Putting stance and grip",
    rule: "Pending: the transcript of this video could not be read. Paste it in the chat with Claude to add its rules." },
];

// What the playlist says about each ball flight, used in the session report.
export const RESULT_TIPS = {
  slice: "Slices: check your setup forearms (Danny Maude): right elbow down, right palm facing the target. Also check you are not aiming right (Videojug, set up mistakes) and that your upper body stays behind your hips at impact.",
  hook: "Hooks: Danny Maude says to go toward the opposite feeling. Your forearms may be too closed at setup, with the left hand too far on top.",
  pull: "Pulls left: weight on the heels makes the swing travel flat and pull the ball left (Videojug, set up mistakes).",
  top: "Thin or topped shots (Rick Shiels, irons): check the ball is not too far forward, keep about 65% of your weight on the left foot through impact, and keep the handle ahead of the ball instead of flipping to lift it.",
  fat: "Fat shots (Rick Shiels, irons): ball position for each club, weight on the left foot instead of hanging back, and handle ahead at impact.",
};
export const BAD_RESULTS = ["slice", "hook", "push", "pull", "top", "fat"];

export const CAMERA = {
  face: "Camera in front of you, about 3 metres away, at hip height. Whole body in the picture.",
  dtl: "Camera behind you, on the line from your hands to the target, about 3 metres back, at hip height. Whole body in the picture.",
};

// Words the app understands through your earphones' microphone.
export const VOICE_HELP = [
  ["straight, slice, hook, push, pull, thin, fat", "how the ball flew"],
  ["practice", "that was a practice swing, ignore it"],
  ["wrong", "the last correction was wrong"],
  ["skip", "change the focus"],
  ["repeat", "say it again"],
  ["explain", "the full tip from the video"],
  ["next", "go to the next block"],
  ["status", "balls left in this block"],
];
