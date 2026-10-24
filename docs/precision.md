# How precise the coaching is

The app does not ask an AI to look at your swing. On the phone, a pose model (MediaPipe BlazePose) finds 33 body
points in every camera frame. The app turns them into measurements (stance width, sway, head height, weight at impact)
and compares them with limits taken from your playlist tips. Everything runs on the phone.

## The photo exam (24 Oct 2026)

The 71 library photos are labeled: each one shows a tip done right or wrong. `test/photo-exam.test.mjs` runs the app's
own measurements on them. A right photo must pass its check, a wrong one must fail.

| | Lite model (before) | Full model (now) |
|---|---|---|
| Before the fixes, 57 cases | 40 right | 42 right |
| After the fixes, 49 testable cases | 47 right | 49 right |

What the exam found and what changed:
- Stance: your correct iron stance read as "too wide" and a correct driver stance as "too wide" for the driver. The
  measurement compares ankles with shoulder joints, which sit inside the shoulders. Iron range is now 0.95 to 1.8, driver 1.8 to 2.8.
- Weight at setup, weight at impact, finish, hands ahead, right arm high: limits moved so the right photo passes and the
  wrong one fails.
- Scooping: the wrist angle cannot be seen; the check now uses where the hands are at impact compared with the ball.
- Stable feet: a correct finish was counted as "feet moved" because the right heel lifts. It now looks at the left ankle
  and the right toe, which stay put in a good finish.
- The V in the chip: the pose model cannot see the wrists or the club, so the app stops measuring it.
- The pose model is now the full one (the lite one missed a correct putt and a correct chip). On a phone that cannot
  keep up, the app switches to the lite model by itself. The camera asks for 60 frames a second.

The limits were set with these photos, so the exam is a floor that must keep passing, not proof on your real swings.
Your own sessions are the real test (see "It adapts to you").

## What the camera cannot judge

- The club face, the grip and the wrists (the body points stop at the hand).
- A rounded back: there are no points along the spine, only how far you lean.
- Weight on the heels: only guessed from where the shoulders sit over the feet.
- Anything at impact is limited by the frame rate: at 30 frames a second the hands move about 30 cm between frames.

## Where other apps fail, and what this one does about it

- Single camera 3D models look right on screen but are too inaccurate for joint angles (DTU, Evaluating current state of
  monocular 3D pose models for golf). The app uses simple 2D positions and ratios, not 3D angles.
- Club and hands blur near impact (Yamamoto et al. 2023, Frontiers in Sports and Active Living). The app averages the
  frames around impact, marks impact checks as weak, and asks the camera for 60 frames a second.
- Camera setup decides the result: elbow height, whole swing in the frame, even light, fitted clothes, no stray white
  balls (Trackman 3D Motion Analysis setup guide). The Library now lists these.
- Golfers distrust generic or wrong feedback (Golf Monthly forum thread on swing analysis tools). The app only speaks
  checks proven reliable, says why, and learns from "that's wrong".

## It adapts to you

- Say "that's wrong" when a correction is wrong. The app works out how far that measurement was from passing. After two
  corrections on the same check it moves the check by the middle value, never more than the check's tolerance. The report
  and the profile list what adapted; "Undo the adjustments" in the profile resets it.
- Every swing keeps its measurements, your words about the flight and the pose model used. Export a session and send it
  to Claude to tune the limits on your real swings, then add those swings to the exam.
- The report shows your best and worst swing for each club and camera side, with the Library's guide drawn on your own
  frame. The Progress tab keeps your best swing so far next to your best one last time.
