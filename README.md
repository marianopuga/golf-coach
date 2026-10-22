# Golf Bible Coach

A free iPhone web app that watches your swing through the camera and tells you, by voice, the one thing to fix. Every rule comes from the "Golf bible" YouTube playlist.

## How it works
1. Pose detection (MediaPipe, runs on the phone, free) finds your body in each frame.
2. The app detects each swing on its own: address, top, impact, finish.
3. It measures your setup and motion and checks them against the rules in `rules.js`.
4. It keeps one focus per club until you get it right in 4 of 5 swings, then moves to the next.
5. After the session you get a report. Copy it and paste it to Claude for a deeper review.

Nothing leaves the phone. Data is saved in the phone's browser storage.

## Files
1. `rules.js`: the swing manual, with thresholds and the spoken cues.
2. `engine.js`: swing detection, metrics, coaching logic, reports.
3. `app.js` and `index.html`: camera, voice and screens.
4. `test/sim.test.mjs`: simulated swings (`node test/sim.test.mjs`).
