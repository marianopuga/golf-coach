// Golf Bible: the swing manual.
// Every rule comes from Mariano's "Golf bible" YouTube playlist.
// Rules marked auto:true are checked by the camera. The rest are shown in the Manual screen only.

export const VIDEOS = {
  grip:    { n: 1, title: "How To Grip A Golf Club Properly", who: "Videojug", url: "https://www.youtube.com/watch?v=mDNQ_hwQc3w" },
  setup:   { n: 2, title: "How To Master Golf Set Up", who: "Videojug", url: "https://www.youtube.com/watch?v=JgObFR-d0Dw" },
  mistakes:{ n: 3, title: "4 Most Common Golf Set Up Mistakes", who: "Videojug", url: "https://www.youtube.com/watch?v=HV7jRgHhUzY" },
  putting: { n: 4, title: "How To Position Your Stance And Grip For Successful Putting", who: "Videojug", url: "https://www.youtube.com/watch?v=-z4eUptsYZc" },
  chipping:{ n: 5, title: "How To Be Better At Your Chipping Technique", who: "Videojug", url: "https://www.youtube.com/watch?v=8o--AaG6M8k" },
  bunker:  { n: 6, title: "How To Do The Greenside Bunker Shot", who: "Videojug", url: "https://www.youtube.com/watch?v=nOnVGAO5dVw" },
  maude:   { n: 7, title: "To Hit Driver Straight Always Do This Before Every Swing", who: "Danny Maude", url: "https://www.youtube.com/watch?v=pGU1H5mXm98" },
  shiels:  { n: 8, title: "Top 5 Driver Golf Tips", who: "Rick Shiels", url: "https://www.youtube.com/watch?v=r5u52YuNVG8" },
  extra:   { n: 0, title: "Obvious fault (not in the playlist)", who: "Coach", url: "" },
};

export const CLUBS = {
  driver: "Driver",
  hybrid: "Hybrid",
  iron: "Irons",
  wedge: "Wedge / chip",
};
const FULL = ["driver", "hybrid", "iron"];
const ALL = ["driver", "hybrid", "iron", "wedge"];

// view: "face" = phone in front of you. "dtl" = phone behind you, looking at the target.
// priority: lower number is fixed first. Setup before motion.
export const RULES = [
  {
    id: "heels", auto: true, view: "dtl", clubs: ALL, priority: 1, src: "mistakes",
    title: "Weight on the balls of your feet",
    rule: "At setup your weight sits on the balls of your feet, not on your heels. Weight on the heels makes the swing go flat around the body and pulls the ball left.",
    bad: "your weight is on your heels at setup. Move it forward to the balls of your feet before you start.",
    good: "weight on the balls of your feet. Good setup.",
    check: (m) => m.shoulderOverFeet == null ? null : m.shoulderOverFeet >= 0.06,
  },
  {
    id: "hinge", auto: true, view: "dtl", clubs: ALL, priority: 2, src: "setup",
    title: "Lean from the hips, back straight",
    rule: "Lean your upper body forward from the hips. Do not bend your back. You cannot turn around a bent spine, so you end up swinging with your arms.",
    bad: (m) => m.hingeDeg < 20
      ? "you are standing too upright. Push your hips back and lean forward from the hips, back straight."
      : "you are bending over too much. Stand a bit taller and lean from the hips, not from the back.",
    good: "nice posture. You are leaning from the hips.",
    check: (m) => m.hingeDeg == null ? null : (m.hingeDeg >= 20 && m.hingeDeg <= 55),
  },
  {
    id: "knees", auto: true, view: "dtl", clubs: ALL, priority: 3, src: "setup",
    title: "Unlock your knees",
    rule: "Flex your knees slightly. Not locked straight, not sitting down.",
    bad: (m) => m.kneeDeg > 172
      ? "your knees are locked. Flex them a little."
      : "you are sitting down too much. Straighten your knees a little, just a soft flex.",
    good: "good knee flex.",
    check: (m) => m.kneeDeg == null ? null : (m.kneeDeg >= 135 && m.kneeDeg <= 172),
  },
  {
    id: "stance", auto: true, view: "face", clubs: FULL, priority: 4, src: "shiels",
    title: "Stance width",
    rule: "Irons and hybrid: feet about shoulder width apart. Driver: a much wider stance than with your irons, ball just inside your left heel.",
    bad: (m, club) => club === "driver"
      ? (m.stanceRatio < 1.2 ? "your stance is too narrow for the driver. Make it wider than your shoulders." : "your stance is too wide. Bring your feet a little closer.")
      : (m.stanceRatio < 0.85 ? "your feet are too close together. Set them about shoulder width apart." : "your stance is too wide for this club. Feet about shoulder width apart."),
    good: "good stance width.",
    check: (m, club) => m.stanceRatio == null ? null
      : club === "driver" ? (m.stanceRatio >= 1.2 && m.stanceRatio <= 2.1)
      : (m.stanceRatio >= 0.85 && m.stanceRatio <= 1.5),
  },
  {
    id: "tilt", auto: true, view: "face", clubs: FULL, priority: 5, src: "setup",
    title: "Left shoulder higher at setup",
    rule: "Your left hand is above the right on the grip, so your left shoulder sits higher and your upper body leans slightly behind the ball. With the driver, add a bit more of that tilt so you can hit up on the ball.",
    bad: (m, club) => club === "driver"
      ? "tilt your upper body a little away from the target at setup, right shoulder lower, so you can hit up on the ball."
      : "your shoulders are level at setup. Let your right shoulder sit a little lower than the left.",
    good: "good shoulder tilt at setup.",
    check: (m, club) => m.tiltDeg == null ? null
      : club === "driver" ? (m.tiltDeg >= 3 && m.leadShHigher > 0)
      : m.leadShHigher >= 0.02,
  },
  {
    id: "sway", auto: true, view: "face", clubs: ALL, priority: 6, src: "extra",
    title: "Turn, don't sway",
    rule: "On the backswing your hips turn instead of sliding away from the target. This is not a playlist tip; it is included because it is one of your main problems and it is very visible.",
    bad: "your hips slid away from the target on the backswing. Turn around your right hip instead of sliding.",
    good: "no sway. Your hips stayed centred on the backswing.",
    check: (m, club) => m.sway == null ? null : m.sway <= (club === "wedge" ? 0.15 : 0.22),
  },
  {
    id: "feet", auto: true, view: "face", clubs: ALL, priority: 7, src: "extra",
    title: "Stay stable on your feet",
    rule: "Your feet stay planted through the swing. Not in the playlist; included because you said you feel unstable.",
    bad: "your feet moved during the swing. Keep them planted and swing a little smoother.",
    good: "stable feet. Good.",
    check: (m) => m.feetMoved == null ? null : m.feetMoved <= 0.15,
  },
  {
    id: "arms", auto: true, view: "face", clubs: FULL, priority: 8, src: "shiels",
    title: "Use your body, not just your arms",
    rule: "Your shoulders and hips turn and your arms follow what the body allows. On the way down the body turns, the hips fire, and only at the end do the arms add a bit of speed.",
    bad: "you swung mostly with your arms. Turn your shoulders and chest away on the backswing and let the arms follow the body.",
    good: "good turn. Your body led the swing, not just the arms.",
    check: (m) => m.shoulderTurn == null ? null : m.shoulderTurn <= 0.7,
  },
  {
    id: "upper", auto: true, view: "face", clubs: FULL, priority: 9, src: "maude",
    title: "Upper body behind the pelvis at impact",
    rule: "Imagine one dot in the middle of your chest and one in the middle of your pelvis. If the upper dot gets ahead of the lower dot coming through, you are in slice territory. Keep your head feeling behind the ball through impact.",
    bad: "your upper body got ahead of your hips at impact. That causes slices. Keep your head behind the ball as you hit.",
    good: "your upper body stayed behind the ball at impact. Good.",
    check: (m, club) => m.upperAhead == null ? null : m.upperAhead <= (club === "driver" ? 0.0 : 0.08),
  },
  {
    id: "transfer", auto: true, view: "face", clubs: ALL, priority: 10, src: "setup",
    title: "Weight to the left in the follow through",
    rule: "Shift your weight to the right for the backswing and to the left for the follow through. Finish with your whole body facing the target.",
    bad: "you finished with your weight on your back foot. Move your weight to your left foot and finish facing the target.",
    good: "good finish on your left side.",
    check: (m, club) => m.transfer == null ? null : m.transfer >= (club === "wedge" ? 0.5 : 0.65),
  },
  {
    id: "posture", auto: true, view: "both", clubs: ALL, priority: 11, src: "bunker",
    title: "Keep your height through the swing",
    rule: "Keep the height of your body constant through the swing. Do not stand up or dip down before impact.",
    bad: (m) => (m.headRise ?? 0) > 0 || (m.hingeLoss ?? 0) > 10
      ? "you stood up through impact. Keep your posture and your height until after the ball."
      : "you dipped down during the swing. Keep your height the same.",
    good: "you kept your posture through impact.",
    check: (m) => {
      if (m.headRise == null) return null;
      if (Math.abs(m.headRise) > 0.12) return false;
      if (m.hingeLoss != null && m.hingeLoss > 10) return false;
      return true;
    },
  },
  {
    id: "speed", auto: true, view: "face", clubs: ["driver", "hybrid"], priority: 12, src: "shiels",
    title: "Don't slow down",
    rule: "With the driver, do not guide the ball. The club head must be at its fastest through the ball and after it, with your arms fully extending.",
    bad: "you slowed down before the ball. Swing through it and let your arms extend after impact.",
    good: "good speed through the ball.",
    check: (m) => m.speedRatio == null ? null : m.speedRatio >= 0.7,
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
  { id: "forearms", auto: false, src: "maude", title: "Face to path: forearms at setup",
    rule: "If you slice: at setup your right elbow points out and your right arm sits higher than the left, so the face is open to your path. Fix: keep the right elbow pointing down, turn the right palm to face the target, and the left hand slightly more on top. Looking down the line you should no longer see the right arm above the left." },
  { id: "driver-up", auto: false, src: "shiels", title: "Hit up with the driver",
    rule: "Like a plane taking off, the club moves up into the ball. Keep the upper body slightly tilted back through impact while the hips turn." },
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
  top: "Topped shots: keep your height through the swing and do not stand up before impact.",
  fat: "Fat shots: keep your height constant, do not dip down. Check the ball position for each club.",
};

export const CAMERA = {
  face: "Phone in front of you, about 3 metres away, at hip height. Your whole body and the club must fit in the picture.",
  dtl: "Phone behind you, on the line from your hands to the target, about 3 metres away, at hip height. Your whole body must fit in the picture.",
};
