"""Down the line photos: ChatGPT put the ball beside the toe of the iron. Move it to where it really is from behind the hands:
in front of the face, mostly hidden by the club head with the top peeking over the top line.
usage: python3 ballfix.py SRC_DIR OUT_DIR preview.jpg"""
import sys, os, json
import numpy as np, cv2
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")); from ids import IDS
SRC, OUT, PREV = sys.argv[1:4]; os.makedirs(OUT, exist_ok=True)
CENT = {"B01": (677, 1145), "B02": (700, 1155), "B03": (699, 1155), "B04": (719, 1114), "B05": (836, 1145), "B06": (563, 1160),
        "B07": (695, 1153), "B08": (706, 1148), "F01": (627, 1162), "F02": (633, 1161), "F03": (681, 1147)}

def lowsat(a):
    mx, mn = a.max(-1).astype(float), a.min(-1).astype(float); return (mx - mn) / (mx + 1)

def find_ball(a, box):
    x0, y0, x1, y1 = box; sub = a[y0:y1, x0:x1]; m = ((sub.min(-1) > 165) & (lowsat(sub) < .2)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    best = None
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        if 120 < ar < 3000 and .7 < w / h < 1.6 and ar / (w * h) > .5:
            if best is None or cen[i][0] + x0 > best[0]: best = (x + w / 2 + x0, y + w / 2 + y0, w / 2 + 1)
    return best

def club_mask(a, box):
    x0, y0, x1, y1 = box; sub = a[y0:y1, x0:x1]
    m = ((lowsat(sub) < .26) & (sub.max(-1) > 60)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); full = np.zeros(a.shape[:2], np.uint8); full[y0:y1, x0:x1] = (lab == i)
    return full

HINT = {"B04": (772, 1122), "B05": (867, 1151), "F02": (692, 1172), "F03": (735, 1162)}
def refine(a, p):
    x, y = p; sub = a[y - 16:y + 17, x - 16:x + 17]; m = (sub.min(-1) > 170) & (lowsat(sub) < .2)
    ys, xs = np.nonzero(m); w = xs.max() - xs.min() + 1
    return (x - 16 + (xs.max() + xs.min()) / 2, y - 16 + ys.min() + w / 2, w / 2 + 1)
res, sprite = {}, None
ORDER = [k for k in CENT if k != "B01"] + ["B01"]
for k in ORDER:
    cx, cy = CENT[k]
    a = cv2.cvtColor(cv2.imread(os.path.join(SRC, f"{IDS[k]:02d}.png")), cv2.COLOR_BGR2RGB); box = (cx - 140, cy - 90, cx + 150, cy + 70)
    ball = find_ball(a, box) if k not in HINT else refine(a, HINT[k]); b = a.copy()
    cm = club_mask(a, box)
    if ball:
        bx, by, r = ball
        disk = np.zeros(a.shape[:2], np.uint8); cv2.circle(disk, (int(round(bx)), int(round(by))), int(r + 2), 1, -1); cm = cm & (1 - disk)
        n_, lab_, st_, _ = cv2.connectedComponentsWithStats(cm); cm = (lab_ == 1 + int(np.argmax(st_[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
        if sprite is None:   # keep one clean ball (with its own grass edge) to place where none was drawn
            R = int(r * 1.15); sprite = (a[int(by) - R:int(by) + R + 1, int(bx) - R:int(bx) + R + 1].copy(), r)
        # remove: copy grass from just right of the ball, feathered, never over the club head
        m = np.zeros(a.shape[:2], np.float32); cv2.circle(m, (int(bx), int(by + r * .25)), int(r * 1.45), 1, -1)
        m = cv2.GaussianBlur(m, (0, 0), r * .25) * (1 - cv2.dilate(cm, np.ones((3, 3), np.uint8)))
        m = m[..., None]; sh = int(r * 2.6); src = np.roll(a, -sh, axis=1)
        b = (b * (1 - m) + src * m).astype(np.uint8)
    ys, xs = np.nonzero(cm); bot = ys.max(); blade = cm.copy(); blade[:bot - 42] = 0   # lower part of the head only, no shaft
    bys, bxs = np.nonzero(blade); bl, br = bxs.min(), bxs.max(); fx = int(bl + (br - bl) * .58)
    top = np.nonzero(cm[:, fx])[0].min()
    r = sprite[1] if not ball else ball[2]
    nx, ny = fx, int(top + r * .3)    # a good part of the ball shows over the top line
    spr, sr = sprite; h = spr.shape[0]; R = h // 2
    alpha = np.zeros((h, h), np.float32); cv2.circle(alpha, (R, R), int(sr * .98), 1, -1); alpha = cv2.GaussianBlur(alpha, (0, 0), .9)[..., None]
    c = b.copy(); y0, x0 = ny - R, nx - R
    c[y0:y0 + h, x0:x0 + h] = (spr * alpha + c[y0:y0 + h, x0:x0 + h] * (1 - alpha)).astype(np.uint8)
    # club head back in front of the ball (soft edge)
    cmf = cv2.GaussianBlur(cv2.dilate(cm, np.ones((2, 2), np.uint8)).astype(np.float32), (0, 0), .8)[..., None]
    c = (b * cmf + c * (1 - cmf)).astype(np.uint8)
    cv2.imwrite(os.path.join(OUT, f"{IDS[k]:02d}.png"), cv2.cvtColor(c, cv2.COLOR_RGB2BGR))
    res[k] = {"old": None if not ball else [round(ball[0]), round(ball[1]), round(ball[2], 1)], "new": [nx, ny], "top": int(top)}
    print(k, res[k])
json.dump(res, open(os.path.join(OUT, "ballfix.json"), "w"))
tiles = []
for k, (cx, cy) in CENT.items():
    for d in (SRC, OUT):
        im = cv2.imread(os.path.join(d, f"{IDS[k]:02d}.png"))[cy - 80:cy + 60, cx - 130:cx + 130]; im = cv2.resize(im, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        cv2.putText(im, k + (" new" if d == OUT else ""), (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .7, (0, 255, 255), 2); tiles.append(im)
rows = [np.hstack(tiles[i:i + 6]) for i in range(0, len(tiles), 6)]
rows[-1] = np.hstack([rows[-1], np.zeros((rows[0].shape[0], rows[0].shape[1] - rows[-1].shape[1], 3), np.uint8)])
cv2.imwrite(PREV, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
