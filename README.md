# Golf Bible Coach

A free iPhone web app that watches your swing through the camera and tells you, by voice, the one thing to fix. Every rule comes from the "Golf bible" YouTube playlist.

## How it works
1. You type how many balls you have. The app builds a plan with your clubs: warm up, your weakest club first, the rest from short to long, and a retest of the weakest club at the end. The camera side alternates by block.
2. Pose detection (MediaPipe, on the phone, free) finds your body. It locks on you and ignores other people in the picture.
3. Each swing is detected on its own. The app measures setup and motion against the rules in `rules.js` and speaks one short correction.
4. One focus for all clubs, kept until you get it right in 4 of 5 swings. Weak measurements never become the focus.
5. Talk through your earphones: ball flight (straight, slice, hook, push, pull, thin, fat), "practice", "wrong", "skip", "repeat", "explain", "next", "status".
6. After each swing you see setup, top, impact and finish with your skeleton and a guide line for the rule.
7. The report is saved on the phone. Copy it and paste it to Claude for a review.

## Files
1. `rules.js`: the swing manual, thresholds, spoken cues, your bag.
2. `engine.js`: golfer lock, swing detection, metrics, coaching, voice commands, plan, reports.
3. `app.js`, `index.html`, `sw.js`: camera, voice, screens, offline cache.
4. `test/sim.test.mjs`: simulated swings and unit checks (`node test/sim.test.mjs`).
