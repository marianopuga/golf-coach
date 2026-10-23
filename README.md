# Scratch Golfer Dreams

A free iPhone web app that watches your swing through the camera and tells you, by voice, the one thing to fix. Every rule comes from the "Golf bible" YouTube playlist.

## How it works
1. Choose the range: Pittwater Golf Centre (balls, plus chipping, bunker and putting) or Swing Factory (minutes, Toptracer distances). The app builds a plan: warm up, your weakest club first, the rest from short to long, a retest and a random block. The first session is a calibration with no corrections.
2. Pose detection (MediaPipe, on the phone, free) finds your body. It locks on you and ignores other people in the picture.
3. Before each shot it checks your setup one thing at a time and says "Ready". After each swing it speaks the main correction, then details. Practice swings next to the ball are ignored when the ball is still there.
4. One focus for all clubs, kept until you get it right in 4 of 5 swings. Weak measurements never become the focus.
5. Talk through your earphones in English or Spanish: ball flight with how bad it was ("a bit", "big"), the distance, "pause", "resume", "practice", "wrong", "skip", "repeat", "explain", "next", "status".
6. After each swing you see setup, top, impact and finish with your skeleton and a guide line for the rule.
7. Reports, rounds on the course, distances and progress are saved on the phone. Export a session file and attach it in a chat with Claude for a review.

## Files
1. `rules.js`: the swing manual, thresholds, spoken cues, your bag.
2. `engine.js`: golfer lock, ball detection, swing detection, metrics, coaching, plans, rounds, reports.
3. `voice.js`: understands your words (English and Spanish, severity, distances).
4. `illus.js`: the illustrations in the Library.
5. `app.js`, `views.js`, `store.js`, `index.html`, `sw.js`: camera, screens, saved data, offline cache.
6. `test/sim.test.mjs`: simulated swings and unit checks (`node test/sim.test.mjs`).
