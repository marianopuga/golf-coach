"""Photo demonstrations: crop the approved ChatGPT photos, place guides from pose landmarks (plus a few measured points),
write WebP files and the PHOTO / SWING / TEMPO / HERO manifest.  usage: python3 export.py OUTDIR ARTDATA.js [preview.jpg]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); B = os.path.join(HERE, "..", "batch1")
sys.path.insert(0, os.path.join(HERE, "..")); from ids import IDS
OUT, DATA = sys.argv[1], sys.argv[2]; PREV = sys.argv[3] if len(sys.argv) > 3 else None
LM = json.load(open(os.path.join(B, "landmarks.json")))
NAMES = {"nose": 0, "LS": 11, "RS": 12, "LE": 13, "RE": 14, "LW": 15, "RW": 16, "LH": 23, "RH": 24, "LK": 25, "RK": 26,
         "LA": 27, "RA": 28, "LHe": 29, "RHe": 30, "LT": 31, "RT": 32}
# points measured by eye on gridded crops (club head, hands, ball where the detector cannot see them)
MAN = {"A01": {"club": (504, 1222), "hands": (534, 758), "ball": (540, 1237)}, "C03": {"club": (574, 1172), "hands": (472, 740), "ball": (532, 1168)},
       "A10": {"club": (514, 1172), "hands": (582, 752), "ball": (544, 1172)}, "C09": {"club": (694, 1142), "hands": (595, 760)},
       "I05": {"ball": (529, 1162)}, "I06": {"ball": (538, 1160)}, "I01": {"ball": (548, 1176)}, "E01": {"ball": (535, 1168)}}
# A01 was generated larger than the rest of the face-on set: scale it into the shared frame (mid ankles to mid ankles)
NORM = {"A01": (0.8, (498, 1127), (512, 1047))}

def P(img, name):
    if name in MAN.get(img, {}): return MAN[img][name]
    lm = LM[f"{IDS[img]:02d}"]["lm"]
    if name in NAMES: return tuple(lm[NAMES[name]][:2])
    av = lambda *ns: tuple(sum(P(img, n)[i] for n in ns) / len(ns) for i in (0, 1))
    if name == "eye": return tuple((lm[2][i] + lm[5][i]) / 2 for i in (0, 1))
    if name == "hands": return av("LW", "RW")
    if name == "smid": return av("LS", "RS")
    if name == "hmid": return av("LH", "RH")
    if name == "amid": return av("LA", "RA")
    if name == "ground": return (0, max(P(img, n)[1] for n in ("LT", "RT", "LHe", "RHe")) + 6)
    raise KeyError(name)
def norm(img, p):
    if img not in NORM: return p
    s, a, b = NORM[img]; return ((p[0] - a[0]) * s + b[0], (p[1] - a[1]) * s + b[1])
def raw(img, p):
    if img not in NORM: return p
    s, a, b = NORM[img]; return ((p[0] - b[0]) / s + a[0], (p[1] - b[1]) / s + a[1])

FACE, DTL = (112, 170, 912, 1330), (40, 190, 840, 1350)
SEQC = (12, 20, 1012, 1330)
src_cache = {}
def source(img):
    if img in src_cache: return src_cache[img]
    fixed = os.path.join(B + "fix", f"{IDS[img]:02d}.png")   # down the line photos with the ball moved in front of the face
    im = Image.open(fixed if os.path.exists(fixed) else os.path.join(B, f"{IDS[img]:02d}.png")).convert("RGB")
    if img in NORM:   # pad the sky above so the scaled frame can be cropped like the others
        pad = 260; top = im.crop((0, 0, im.width, pad)).transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(14))
        big = Image.new("RGB", (im.width + 2 * 40, im.height + pad)); big.paste(im.resize((im.width, im.height)), (40, pad)); big.paste(top, (40, 0))
        for side in (0, 1):
            strip = im.crop((0, 0, 40, im.height) if side == 0 else (im.width - 40, 0, im.width, im.height)).transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(6))
            big.paste(strip, (0 if side == 0 else im.width + 40, pad))
        im = (big, (40, pad))
    else: im = (im, (0, 0))
    src_cache[img] = im; return im

made = {}
def crop(img, box, outw, tag):
    """box in the shared (normalised) frame; returns (file, w, h, map raw->out)"""
    key = (img, box, outw)
    k = outw / (box[2] - box[0]); w, h = outw, round((box[3] - box[1]) * k)
    def mp(p):
        q = norm(img, p); return [round((q[0] - box[0]) * k, 1), round((q[1] - box[1]) * k, 1)]
    if key not in made:
        im, (ox, oy) = source(img)
        r0, r1 = raw(img, box[:2]), raw(img, box[2:])
        c = im.crop((round(r0[0] + ox), round(r0[1] + oy), round(r1[0] + ox), round(r1[1] + oy))).resize((w, h), Image.LANCZOS)
        name = f"{img}-{tag}.webp"; c.save(os.path.join(OUT, name), "WEBP", quality=78, method=6); made[key] = (name, c)
    return made[key][0], w, h, mp, made[key][1]

# ---------- guide helpers (raw image coordinates) ----------
def down(img, name, tone="w", dx=0, to=None):        # plumb line from a body point to the ground
    p = P(img, name); g = to if to is not None else P(img, "ground")[1] + 8
    return ["line", (p[0] + dx, p[1]), (p[0] + dx, g), tone, 1]
def up_from_foot(img, name, top, tone="w", dx=0):     # line up from a foot
    p = P(img, name); return ["line", (p[0] + dx, P(img, "ground")[1] - 4), (p[0] + dx, top), tone, 1]
def weight(img, pct, labels=None, a="RA", b="LA", dy=None):
    yb = max(P(img, "ground")[1], MAN.get(img, {}).get("ball", (0, 0))[1] + 22) + (dy if dy is not None else 50)
    g = ["weight", (P(img, a)[0], yb), (P(img, b)[0], yb), pct]
    return g + [labels] if labels else g
def spine(img, tone="w"):
    h, s = P(img, "hmid"), P(img, "smid"); e = (s[0] + (s[0] - h[0]) * .3, s[1] + (s[1] - h[1]) * .3)
    return ["line", h, e, tone, 1]
def leg(img, side="R", tone="w"): return ["path", [P(img, side + "H"), P(img, side + "K"), P(img, side + "A")], tone]
def centre(img, tone="w"):
    a = P(img, "amid"); return ["line", (a[0], P(img, "hmid")[1] + 60), (a[0], P(img, "ground")[1] + 60), tone, 0]
def ring(img, name="ball", r=30, tone="w"): return ["ring", P(img, name), r, tone]
def shoulders(img, tone="w"):
    l, r = P(img, "LS"), P(img, "RS"); d = (l[0] - r[0], l[1] - r[1])
    return [["line", (r[0] - d[0] * .3, r[1] - d[1] * .3), (l[0] + d[0] * .3, l[1] + d[1] * .3), tone, 0],
            ["line", (r[0] - d[0] * .3, r[1]), (l[0] + d[0] * .3, r[1]), "n", 0]]
def stance_lines(img):
    return [down(img, "RS", dx=-4), down(img, "LS", dx=4)]

def F(img, label, sub, tone="n", g=(), box=FACE, tag="f"): return dict(img=img, label=label, sub=sub, tone=tone, g=list(g), box=box, tag=tag)
LOWF, UPF, HANDF = (212, 590, 812, 1290), (262, 280, 762, 905), (287, 560, 787, 1285)
LEGD, ARMD, REACHD = (60, 560, 620, 1230), (230, 380, 630, 880), (120, 330, 680, 1000)
A01, A06, A10, A16 = "A01", "A06", "A10", "A16"
TIPS = {
 "stance": ("single", 0, [F(A01, "7 iron", "Feet about shoulder width", g=stance_lines(A01))]),
 "ballpos": ("variants", 1, [F("E01", "Wedge", "Ball in the middle", g=[centre("E01"), ring("E01")], box=LOWF, tag="low"),
                             F(A01, "7 iron", "About one ball left of centre", g=[centre(A01), ring(A01)], box=LOWF, tag="low")]),
 "hinge": ("pair", 0, [F("B01", "Back straight", "Lean from the hips", "g", [spine("B01")], DTL, "d"), F("B02", "Back rounded", "Bending the spine instead", "b", [spine("B02", "b")], DTL, "d")]),
 "knees": ("pair", 0, [F("B01", "Flexed", "A little give", "g", [leg("B01")], LEGD, "leg"), F("B03", "Locked", "Straight legs", "b", [leg("B03", tone="b")], LEGD, "leg"),
                       F("B04", "Sitting", "Too much bend", "b", [leg("B04", tone="b")], LEGD, "leg")]),
 "reach": ("pair", 0, [F(i, l, s, t, [down(i, "smid", tone=("w" if t == "g" else "b"), to=P(i, "hands")[1] + 90)], REACHD, "reach") for i, l, s, t in
                       (("B01", "Arms hang", "Hands under the shoulders", "g"), ("B06", "Too close", "Hands in at the legs", "b"))]),
 "weightset": ("pair", 0, [F(A01, "Chest to the target", "About 65% on the left foot", "g", [weight(A01, 65)]), F("C01", "Chest back", "Weight on the right foot", "b", [weight("C01", 35)])]),
 "tilt": ("pair", 0, [F(A01, "Left shoulder higher", "Upper body behind the ball", "g", shoulders(A01), UPF, "up"), F("C02", "Shoulders level", "Body over the ball", "b", shoulders("C02", "b"), UPF, "up")]),
 "handsahead": ("single", 0, [F(i, l, s, t, [["line", P(i, "club"), (P(i, "club")[0], P(i, "hands")[1] - 20), "n", 0], ["line", P(i, "club"), P(i, "hands"), "b" if t == "b" else "w", 1]], HANDF, "hand")
                            for i, l, s, t in ((A01, "Hands ahead", "Shaft leans to the target", "n"),)]),
 "forearms": ("pair", 0, [F(i, l, s, t, [["line", P(i, "LE"), P(i, "LW"), "n", 1], ["line", P(i, "RE"), P(i, "RW"), "w" if t == "g" else "b", 1]], ARMD, "arm")
                          for i, l, s, t in (("B01", "Right arm lower", "Elbow points at the hip", "g"), ("B07", "Right arm high", "Elbow points out", "b"))]),
 "heels": ("pair", 0, [F("B01", "Balls of the feet", "Balanced, ready to move", "g", [weight("B01", 62, ["Heel", "Toe"], "RHe", "RT", 40)], DTL, "d"),
                       F("B08", "On the heels", "Sitting back", "b", [weight("B08", 12, ["Heel", "Toe"], "RHe", "RT", 40)], DTL, "d")]),
 "eyesover": ("single", 0, [F("I05", "Eyes over the ball", "You see the line", g=[down("I05", "eye", to=P("I05", "ball")[1] - 26), ring("I05", r=26)], box=DTL, tag="d")]),
 "arms": ("pair", 0, [F(A06, "Body turned", "Arms follow the turn", "g"), F("C04", "Arms only", "Chest still facing you", "b")]),
 "sway": ("pair", 0, [F(i, l, s, t, [up_from_foot(i, "RA", P(i, "RS")[1] - 30, "w" if t == "g" else "b", dx=-26)]) for i, l, s, t in
                      ((A06, "Hips turn", "Inside the right foot", "g"), ("C05", "Hips slide", "Past the right foot", "b"))]),
 "posture": ("variants", 1, [F(A01, "Setup", "Head height set", g=[["line", (112, raw(A01, (0, 362))[1]), (raw(A01, (912, 0))[0], raw(A01, (0, 362))[1]), "w", 0]]),
                             F(A10, "Impact", "Same height", g=[["line", (112, 362), (912, 362), "w", 0]])]),
 "feet": ("single", 0, [F(A16, "Balanced finish", "Over the left foot, right toe down", g=[up_from_foot(A16, "LA", P(A16, "nose")[1] - 70, dx=6)])]),
 "transfer": ("sequence", 3, [F(i, l, s, g=[up_from_foot(i, "LA", 250, dx=6), weight(i, p)]) for i, l, s, p in
                              ((A01, "Setup", "A little more on the left foot", 55), (A06, "Top", "Weight on the right foot", 25), (A10, "Impact", "Moving onto the left foot", 80), (A16, "Finish", "On the left foot, facing the target", 95))]),
 "stayleft": ("pair", 0, [F(A10, "Weight left", "Chest over the ball", "g", [up_from_foot(A10, "LA", 250, dx=6), weight(A10, 80)]), F("C08", "Hanging back", "Weight on the right foot", "b", [up_from_foot("C08", "LA", 250, "b", dx=6), weight("C08", 30)])]),
 "flip": ("single", 0, [F(i, l, s, t, [["path", [P(i, "LS"), P(i, "hands"), P(i, "club")], "b" if t == "b" else "w"]]) for i, l, s, t in
                      ((A10, "One straight line", "Left arm and shaft", "n"),)]),
 "headstill": ("pair", 0, [F(i, l, s, t, [["line", (512, 250), (512, 560), "w" if t == "g" else "b", 0]]) for i, l, s, t in
                           (("I03", "Head still", "Eyes stay on the spot", "g"), ("I04", "Head turns", "Following the ball", "b"))]),
 "chipstance": ("pair", 0, [F("H01", "Feet close together", "Stance slightly open", "g", stance_lines("H01")), F("H02", "Too wide", "Full swing stance", "b", stance_lines("H02"))]),
 "putt-setup": ("variants", 0, [F("I01", "From the front", "Ball toward the left foot", g=[centre("I01"), ring("I01", r=26)]),
                                F("I05", "From behind", "Eyes over the ball", g=[down("I05", "eye", to=P("I05", "ball")[1] - 26), ring("I05", r=26)], box=DTL, tag="d")]),
 "putt-stroke": ("sequence", 0, [F(i, l, s, g=[["path", [P(i, "RS"), P(i, "hands"), P(i, "LS"), P(i, "RS")], "w"]]) for i, l, s in
                                 (("I01", "Address", "Shoulders and arms make a triangle"), ("I02", "Back", "The shoulders rock it back"), ("I03", "Through", "As long as the backswing"))]),
 "speed": ("single", 0, [F("A11", "Arms fully extended", "Fastest after the ball")]),
 "grip-right": ("single", 0, [F("J03", "Right hand on", "In the fingers, left thumb inside the right palm", box=(318, 0, 1218, 1024), tag="c")]),
}
# Setup frame: E01 shares the exact framing of A02 to A17 (A01 was generated larger and cannot fill the wide sequence crop)
SEQ = ["E01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12", "A13", "A14", "A15", "A16", "A17"]
TEMPO = ["E01", "A02", "A04", "A06", "A08", "A10"]

def tr(mp, g):
    t = g[0]
    if t == "line": return ["line", mp(g[1]), mp(g[2]), g[3], g[4]]
    if t == "path": return ["path", [mp(q) for q in g[1]], g[2]]
    if t == "ring": return ["ring", mp(g[1]), round(g[2] * (mp((g[2], 0))[0] - mp((0, 0))[0]) / g[2], 1), g[3]]
    if t == "weight": return ["weight", mp(g[1]), mp(g[2]), g[3]] + g[4:]
    raise ValueError(t)

os.makedirs(OUT, exist_ok=True); photo = {}; prev = []
for tid, (typ, live, panels) in TIPS.items():
    frames = []
    for p in panels:
        name, w, h, mp, im = crop(p["img"], p["box"], 600, p["tag"]); gs = [tr(mp, g) for g in p["g"]]
        frames.append({"f": name, "w": w, "h": h, "label": p["label"], "sub": p["sub"], "tone": p["tone"], "g": gs})
        if PREV:
            pv = im.copy(); d = ImageDraw.Draw(pv); C = {"w": (255, 255, 255), "b": (255, 130, 120), "n": (200, 200, 200), "g": (207, 228, 73)}
            for g in gs:
                if g[0] == "line": d.line([tuple(g[1]), tuple(g[2])], fill=C[g[3]], width=4)
                elif g[0] == "path": d.line([tuple(q) for q in g[1]], fill=C[g[2]], width=4)
                elif g[0] == "ring": x, y = g[1]; r = g[2]; d.ellipse((x - r, y - r, x + r, y + r), outline=C[g[3]], width=4)
                elif g[0] == "weight":
                    a, b = g[1], g[2]; d.line([tuple(a), tuple(b)], fill=(255, 255, 255), width=6); x = a[0] + (b[0] - a[0]) * g[3] / 100; d.ellipse((x - 14, a[1] - 14, x + 14, a[1] + 14), fill=(207, 228, 73))
            d.rectangle((0, 0, 600, 40), fill=(0, 0, 0)); d.text((8, 12), f"{tid} {p['img']} {p['tone']} {p['label']}", fill=(255, 255, 0)); prev.append(pv)
    photo[tid] = {"t": typ, "live": live, "frames": frames}
seq = []
for i in SEQ:
    name, w, h, mp, im = crop(i, SEQC, 540, "s"); seq.append([name, w, h])
tempo = [[f"{i}-s.webp", seq[0][1], seq[0][2]] for i in TEMPO]
# cover: the hold of the finish, cropped wide
h_im = Image.open(os.path.join(B, f"{IDS['A17']:02d}.png")).convert("RGB").crop((0, 190, 1024, 830)).resize((960, 600), Image.LANCZOS)
h_im.save(os.path.join(OUT, "hero.webp"), "WEBP", quality=80, method=6)
js = ("// Generated by scratchpad photos/export.py from the approved ChatGPT photo set: file, size, captions and guides in pixels\n"
      f'export const PDIR = "{OUT.rstrip("/").split("/")[-2]}/{OUT.rstrip("/").split("/")[-1]}/";\n'
      f"export const PHOTO = {json.dumps(photo, separators=(',', ':'))};\n"
      f"export const SWING = {json.dumps(seq, separators=(',', ':'))};\n"
      f"export const TEMPO = {json.dumps(tempo, separators=(',', ':'))};\n"
      f'export const HERO = ["hero.webp", 960, 600];\n')
open(DATA, "w").write(js)
print(len(photo), "tips,", len(made), "files")
if PREV and prev:
    th = 300; tiles = [t.resize((int(t.width * th / t.height), th)) for t in prev]; W = 2400; rows, row, ws = [], [], 0
    for t in tiles:
        if ws + t.width > W and row: rows.append(row); row, ws = [], 0
        row.append(t); ws += t.width + 6
    rows.append(row); S = Image.new("RGB", (W, len(rows) * (th + 6)), (30, 30, 30))
    for j, r in enumerate(rows):
        x = 0
        for t in r: S.paste(t, (x, j * (th + 6))); x += t.width + 6
    S.save(PREV, quality=80); print("preview", S.size)
