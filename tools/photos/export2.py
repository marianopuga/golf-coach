"""Photo demonstrations: crop the approved ChatGPT photos, place guides from pose landmarks (plus a few measured points),
write WebP files and the PHOTO / SWING / TEMPO / HERO manifest.  usage: python3 export.py OUTDIR ARTDATA.js [preview.jpg]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); SP = os.path.join(HERE, ".."); B = os.path.join(SP, "batch1"); FIN = os.path.join(SP, "final")
sys.path.insert(0, SP); from ids import IDS
OUT, DATA = sys.argv[1], sys.argv[2]; PREV = sys.argv[3] if len(sys.argv) > 3 else None
# The final set (one PNG per ID) is the source. Down the line photos from the first batch keep their retouch (ball moved in front of
# the face, ballfix.py). A01x is the first A01: larger than the set, kept only for the shoulder tilt pair where it shows the tilt best.
LM = json.load(open(os.path.join(FIN, "landmarks.json"))); LM["A01x"] = json.load(open(os.path.join(B, "landmarks.json")))["00"]
RETOUCHED = {k: IDS[k] for k in ("B01", "B02", "B03", "B04", "B06", "B07", "B08", "F01")}
NAMES = {"nose": 0, "LS": 11, "RS": 12, "LE": 13, "RE": 14, "LW": 15, "RW": 16, "LH": 23, "RH": 24, "LK": 25, "RK": 26,
         "LA": 27, "RA": 28, "LHe": 29, "RHe": 30, "LT": 31, "RT": 32}
# points measured by eye on gridded crops (club head, hands, ball where the detector cannot see them)
MAN = {"A01": {"club": (494, 1169), "hands": (548, 748), "ball": (536, 1170)}, "C03": {"club": (511, 1175), "hands": (410, 745), "ball": (546, 1175)},
       "A10": {"club": (514, 1172), "hands": (582, 752), "ball": (544, 1172)}, "C09": {"club": (516, 1158), "hands": (406, 719), "ball": (560, 1169)},
       "D01": {"ball": (693, 1182)}, "D02": {"club": (605, 1175), "hands": (646, 737), "ball": (649, 1169)}, "D03": {"club": (664, 1166), "ball": (716, 1159)}, "K01": {"hosel": (780, 420), "toe": (788, 343)}, "K02": {"hosel": (795, 425), "toe": (868, 348)},
       "H07": {"club": (835, 372), "hands": (599, 685)}, "I05": {"ball": (532, 1161)}, "I07": {"eye": (632, 620), "ball": (532, 1162)}, "I06": {"ball": (590, 1166)}, "I01": {"ball": (548, 1176)},
       "E01": {"ball": (535, 1172)}}
# scale into the shared frame of their series (mid ankles to mid ankles): A01x into the A set, the chip shots into the H set
NORM = {"A01x": (0.8, (498, 1127), (512, 1047)), "H03": (1.136, (498, 1045), (500, 1068)), "H07": (1.058, (392, 1078), (500, 1066))}

def P(img, name):
    if name in MAN.get(img, {}): return MAN[img][name]
    lm = LM[img]["lm"]
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
    path = (os.path.join(B + "fix", f"{RETOUCHED[img]:02d}.png") if img in RETOUCHED else os.path.join(B, "00.png") if img == "A01x"
            else os.path.join(FIN, f"{img}.png"))
    im = Image.open(path).convert("RGB")
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
CHIP, DRV, WIDE, POST, AIMD = (90, 100, 1000, 1330), (300, 760, 900, 1290), (20, 200, 1020, 1330), (112, 60, 912, 1290), (120, 190, 920, 1350)
SPD = (0, 230, 1024, 1290)
A01, A06, A10, FIN_ = "A01", "A06", "A10", "A15"   # A15 is the finish until A16 and A17 come back with the hands in the right order
TB = lambda t: "b" if t == "b" else "w"     # guide tone for a panel tone
# Labels on the photo say what each line is. al: c centred on the point, l starts at the point, r ends at it.
def tag(p, text, tone="w", al="c", dx=0, dy=0): return ["tag", (p[0] + dx, p[1] + dy), text, tone, al]
def mid(a, b): return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
def bar_y(img, dy=50): return max(P(img, "ground")[1], MAN.get(img, {}).get("ball", (0, 0))[1] + 22) + dy
def wtag(img, a="RA", b="LA", dy=50, text="Weight"): return tag((((P(img, a)[0] + P(img, b)[0]) / 2), bar_y(img, dy) + 34), text)
def shaft(i, t): return [["line", P(i, "club"), (P(i, "club")[0], P(i, "hands")[1] - 20), "n", 0], ["line", P(i, "club"), P(i, "hands"), TB(t), 1],
                         tag((P(i, "club")[0], P(i, "hands")[1] - 46), "Vertical")]
def vee(i, t): return [["path", [P(i, "RS"), P(i, "hands"), P(i, "LS")], TB(t)], tag(P(i, "hands"), "V", TB(t), dy=40)]
def reach_line(i, t): return [down(i, "smid", tone=TB(t), to=P(i, "hands")[1] + 90), tag((P(i, "smid")[0], P(i, "hands")[1] + 118), "Under the shoulder", TB(t))]
def chest_pelvis(i, t):
    s_, h = P(i, "smid"), P(i, "hmid"); c = (s_[0] + (h[0] - s_[0]) * .35, s_[1] + (h[1] - s_[1]) * .35)
    return [["line", h, (h[0], c[1] - 60), "n", 0], ["path", [c, h], TB(t)], tag(c, "Chest", TB(t), "l", 16), tag(h, "Pelvis", TB(t), "l", 16)]
def stance_g(i): return stance_lines(i) + [tag((mid(P(i, "RS"), P(i, "LS"))[0], P(i, "RK")[1]), "Shoulder width")]
def centre_g(i, r=30): return [centre(i), ring(i, r=r), tag((P(i, "amid")[0], P(i, "hmid")[1] + 34), "Centre")]
def spine_g(i, t="w"): return [spine(i, TB(t)), tag(mid(P(i, "hmid"), P(i, "smid")), "Back line", TB(t))]
def leg_g(i, t="w"): return [leg(i, tone=TB(t)), tag(P(i, "RK"), "Knee", TB(t), "l", 18)]
def eyes_g(i, t="w"):
    e, b = P(i, "eye"), P(i, "ball")
    side = ("r", -14) if e[0] > 560 else ("l", 14)   # keep the label inside the frame
    return [down(i, "eye", TB(t), to=b[1] - 26), ring(i, r=26, tone=TB(t)), tag((e[0], (e[1] + b[1]) / 2), "Eye line", TB(t), *side)]
def foot_line(i, side, top, t="w", dx=6, text=None):
    return [up_from_foot(i, side, top, TB(t), dx=dx), tag((P(i, side)[0] + dx, top - 22), text or ("Left foot" if side == "LA" else "Right foot"), TB(t))]
def turn_line(i, t="w"):
    r, l = P(i, "RS"), P(i, "LS"); d = (l[0] - r[0], l[1] - r[1])
    return [["line", (r[0] - d[0] * .2, r[1] - d[1] * .2), (l[0] + d[0] * .2, l[1] + d[1] * .2), TB(t), 0], tag(mid(r, l), "Shoulders", TB(t), "c", 0, 34)]
HEAD_Y = 308                                     # top of the cap at setup (A01), the same frame as A10 and C06
CU = {"J01": (168, 40, 1368, 940), "J02": (210, 40, 1410, 940), "J03": (200, 40, 1400, 940), "J04": (268, 15, 1468, 915),
      "L01": (189, 75, 1389, 975), "K": (480, 170, 1080, 770), "J04v": (318, 90, 1318, 1010), "L02": (200, 94, 1400, 994), "M": (0, 0, 1536, 1024)}
TIPS = {
 "stance": ("variants", 0, [F(A01, "7 iron", "Feet about shoulder width", g=stance_g(A01)), F("D01", "Driver", "Wider than your shoulders", g=stance_g("D01"))]),
 "ballpos": ("variants", 1, [F("E01", "Wedge", "In the middle", g=centre_g("E01"), box=LOWF, tag="low"),
                             F(A01, "7 iron", "One ball left of centre", g=centre_g(A01), box=LOWF, tag="low"),
                             F("D01", "Driver", "Inside the left heel", g=centre_g("D01"), box=LOWF, tag="low")]),
 "hinge": ("pair", 0, [F("B01", "Back straight", "Lean from the hips", "g", spine_g("B01"), DTL, "d"), F("B02", "Back rounded", "Bending the spine instead", "b", spine_g("B02", "b"), DTL, "d")]),
 "knees": ("pair", 0, [F("B01", "Flexed", "A little give", "g", leg_g("B01"), LEGD, "leg"), F("B03", "Locked", "Straight legs", "b", leg_g("B03", "b"), LEGD, "leg"),
                       F("B04", "Sitting", "Too much bend", "b", leg_g("B04", "b"), LEGD, "leg")]),
 "reach": ("pair", 0, [F(i, l, s, t, reach_line(i, t), REACHD, "reach") for i, l, s, t in
                       (("B01", "Arms hang", "Hands under the shoulders", "g"), ("B05", "Too far", "Reaching for the ball", "b"), ("B06", "Too close", "Hands in at the legs", "b"))]),
 "weightset": ("pair", 0, [F(A01, "Chest to the target", "About 65% on the left foot", "g", [weight(A01, 65), wtag(A01)]), F("C01", "Chest back", "Weight on the right foot", "b", [weight("C01", 35), wtag("C01")])]),
 "tilt": ("pair", 0, [F(i, l, s, t, shoulders(i, TB(t)) + [tag((P(i, "RS")[0] - (P(i, "LS")[0] - P(i, "RS")[0]) * .3, P(i, "RS")[1]), "Level", "w", "l", 4, -26)], UPF, "up")
                      for i, l, s, t in (("A01x", "Left shoulder higher", "Upper body behind the ball", "g"), ("C02", "Shoulders level", "Body over the ball", "b"))]),
 "handsahead": ("pair", 0, [F(i, l, s, t, shaft(i, t), HANDF, "hand") for i, l, s, t in
                            ((A01, "Hands ahead", "Shaft leans to the target", "g"), ("C03", "Hands behind", "Shaft leans back", "b"))]),
 "forearms": ("single", 0, [F("B01", "Right arm lower", "Right elbow points at the hip", g=[["line", P("B01", "LE"), P("B01", "LW"), "n", 1], ["line", P("B01", "RE"), P("B01", "RW"), "w", 1],
                                                                                          tag(P("B01", "RE"), "Right forearm", "w", "r", -14)], box=ARMD, tag="arm")]),
 "heels": ("pair", 0, [F("B01", "Balls of the feet", "Balanced, ready to move", "g", [weight("B01", 62, ["Heel", "Toe"], "RHe", "RT", 40)], DTL, "d"),
                       F("B08", "On the heels", "Sitting back", "b", [weight("B08", 12, ["Heel", "Toe"], "RHe", "RT", 40)], DTL, "d")]),
 "setup-steps": ("sequence", 4, [F("F01", "Club behind the ball", "Face to the target, sole on the ground", box=DTL, tag="d"),
                                 F(A01, "Feet and ball", "Shoulder width, ball slightly forward", g=stance_g(A01)),
                                 F("F03", "Lean from the hips", "Back straight", g=spine_g("F03"), box=DTL, tag="d"),
                                 F("B01", "Unlock the knees", "Weight on the balls of the feet", g=leg_g("B01"), box=DTL, tag="d"),
                                 F("A01x", "Take the grip", "Left shoulder higher, spine behind the ball", g=shoulders("A01x") + [tag((P("A01x", "RS")[0] - (P("A01x", "LS")[0] - P("A01x", "RS")[0]) * .3, P("A01x", "RS")[1]), "Level", "w", "l", 4, -26)], tag="fx")]),
 "aim": ("pair", 0, [F("G01", "Square to the target", "Feet and shoulders parallel to the target line", "g", [tag((392, 1300), "Feet line"), tag((905, 1300), "Target line", "w", "r")], AIMD, "aim"),
                     F("G02", "Aimed right", "Right foot pulled back, the feet point right of the flag", "b",
                       [["line", (230, 1209), (900, 959), "b", 1], tag((900, 959), "Feet line", "b", "r", 0, -26), tag((905, 1268), "Target line", "w", "r")], AIMD, "aim")]),
 "eyesover": ("pair", 0, [F("I05", "Eyes over the ball", "Lean from the hips", "g", eyes_g("I05"), DTL, "d"),
                          F("I07", "Too far over", "Eyes past the ball, back almost flat", "b", eyes_g("I07", "b"), DTL, "d")]),
 "arms": ("pair", 0, [F(A06, "Body turned", "Shoulders turn, the arms follow", "g", turn_line(A06)), F("C04", "Arms only", "Chest still facing the ball", "b", turn_line("C04", "b"))]),
 "sway": ("sequence", 1, [F(i, l, s, g=foot_line(i, "RA", P(i, "RS")[1] - 30, dx=-26)) for i, l, s in
                          ((A01, "Setup", "A line up from your right foot"), (A06, "Top", "Hips turned, still inside the line"))]),
 "posture": ("pair", 1, [F(A01, "Setup", "The line sits on top of your head", g=[["line", (112, HEAD_Y), (912, HEAD_Y), "w", 0], tag((898, HEAD_Y), "Head at setup", "w", "r")], box=POST, tag="post"),
                         F(A10, "Height kept", "Head still on the line at impact", "g", [["line", (112, HEAD_Y), (912, HEAD_Y), "w", 0], tag((898, HEAD_Y), "Head at setup", "w", "r")], POST, "post"),
                         F("C06", "Stood up", "Head above the line, arms bend", "b", [["line", (112, HEAD_Y), (912, HEAD_Y), "w", 0], tag((898, HEAD_Y), "Head at setup", "w", "r"),
                                                                                    ["arrow", (436, HEAD_Y), (436, 228), "b"], tag((422, 262), "Higher", "b", "r")], POST, "post")]),
 "feet": ("pair", 0, [F(FIN_, "Balanced finish", "Over the left foot, right toe down", "g", foot_line(FIN_, "LA", P(FIN_, "nose")[1] + 40)),
                      F("C07", "Spun out", "Left foot rolls, body falls back", "b", foot_line("C07", "LA", P("C07", "nose")[1] + 40, "b") + [ring("C07", "LT", 55, "b")])]),
 "transfer": ("sequence", 3, [F(i, l, s, g=foot_line(i, "LA", 400) + [weight(i, p), wtag(i)]) for i, l, s, p in
                              ((A01, "Setup", "A little more on the left foot", 55), (A06, "Top", "Weight on the right foot", 25), (A10, "Impact", "Moving onto the left foot", 80), (FIN_, "Finish", "On the left foot, facing the target", 95))]),
 "stayleft": ("pair", 0, [F(A10, "Weight left", "Chest over the ball", "g", foot_line(A10, "LA", 400) + [weight(A10, 80), wtag(A10)]),
                          F("C08", "Hanging back", "Weight on the right foot", "b", foot_line("C08", "LA", 400, "b") + [weight("C08", 30), wtag("C08")])]),
 "flip": ("pair", 0, [F(i, l, s, t, [["path", [P(i, "LS"), P(i, "hands"), P(i, "club")], TB(t)], tag(P(i, "hands"), "Arm and shaft", TB(t), *(("r", -22) if P(i, "hands")[0] > 512 else ("l", 22)))]) for i, l, s, t in
                      ((A10, "One straight line", "Left arm and shaft", "g"), ("C09", "Wrist flipped", "Club head passes the hands", "b"))]),
 "upper": ("pair", 0, [F("D02", "Chest behind the pelvis", "Head behind the ball", "g", chest_pelvis("D02", "g")), F("D03", "Chest ahead", "Lunging at the ball", "b", chest_pelvis("D03", "b"))]),
 "driver-up": ("single", 0, [F("D02", "Hitting up", "The club rises into the ball", g=[["arrow", (P("D02", "ball")[0] - 190, P("D02", "ball")[1] + 34), (P("D02", "ball")[0] + 170, P("D02", "ball")[1] - 31), "w"],
                                                                                      tag((P("D02", "ball")[0] + 160, P("D02", "ball")[1] - 64), "Club rising", "w", "r")], box=DRV, tag="drv")]),
 "speed": ("single", 0, [F("D04", "Arms fully extended", "Fastest through the ball and after it", box=SPD, tag="w",
                           g=[tag((440, 512), "Arms extended", "w"), ["ring", (432, 1150), 26, "w"], tag((432, 1205), "Ball gone", "w")])]),
 "chipstance": ("pair", 0, [F("H01", "Feet close together", "Stance slightly open", "g", stance_g("H01")), F("H02", "Too wide", "Full swing stance", "b", stance_g("H02"))]),
 "vshape": ("sequence", 0, [F(i, l, s, g=vee(i, "n"), box=CHIP, tag="chip") for i, l, s in
                            (("H01", "Setup", "Shoulders and hands make a V"), ("H03", "Back", "The V turns with the body"), ("H04", "Through", "Same V after the ball"))]),
 "pendulum": ("pair", 0, [F(i, l, s, t, (), CHIP, "chip") for i, l, s, t in
                          (("H03", "Back", "Hands to the thigh", "g"), ("H04", "Through", "The same length", "g"), ("H06", "Stopped", "Hit the ball and stopped", "b"))]),
 "chip-steps": ("sequence", 0, [F(i, l, s, box=CHIP, tag="chip") for i, l, s, p in
                                (("H01", "Set up", "Feet close, ball in the middle", 60), ("H03", "Back", "Small, wrists quiet, weight left", 60), ("H04", "Through", "As long as the backswing", 70))]),
 "headstill": ("pair", 0, [F(i, l, s, t, [["line", (512, 250), (512, 560), TB(t), 0], tag((512, 590), "Head at setup", TB(t))]) for i, l, s, t in
                           (("I03", "Head still", "Eyes stay on the spot", "g"), ("I04", "Head turns", "Following the ball", "b"))]),
 "putt-setup": ("variants", 0, [F("I01", "From the front", "Ball toward the left foot", g=centre_g("I01", 26)), F("I05", "From behind", "Eyes over the ball", g=eyes_g("I05"), box=DTL, tag="d")]),
 "putt-stroke": ("sequence", 0, [F(i, l, s, g=[["path", [P(i, "RS"), P(i, "hands"), P(i, "LS"), P(i, "RS")], "w"], tag(P(i, "hands"), "Triangle", "w", dy=40)]) for i, l, s in
                                 (("I01", "Address", "Shoulders and arms make a triangle"), ("I02", "Back", "The shoulders rock, hands quiet"), ("I03", "Through", "As long as the back, head still"))]),
 "grip-left": ("single", 0, [F("J02", "Wrap the fingers", "Thumb on top, two or three knuckles showing", box=CU["J02"], tag="c")]),   # J01 out: six fingers
 "grip-right": ("sequence", 1, [F("J03", "Right hand on", "In the fingers, wrist straight", box=CU["J03"], tag="c"),
                                F("J04", "Grip complete", "Left thumb inside the right palm", box=CU["J04"], tag="c")]),
 "grip-style": ("single", 0, [F("J04v", "Little finger on top", "Right little finger over the gap between the left index and middle fingers", box=CU["J04v"], tag="c",
                                g=[["ring", (838, 628), 74, "w"], tag((925, 628), "Little finger", "w", "l")])]),
 "grip-check": ("pair", 0, [F(i, l, s, t, [["line", P(i, "hosel"), (P(i, "hosel")[0], P(i, "hosel")[1] - 135), "n", 0],
                                         ["line", P(i, "hosel"), (P(i, "hosel")[0] + (P(i, "toe")[0] - P(i, "hosel")[0]) * 1.3, P(i, "hosel")[1] + (P(i, "toe")[1] - P(i, "hosel")[1]) * 1.3), TB(t), 1],
                                         tag((P(i, "hosel")[0] - 12, P(i, "hosel")[1] - 120), "Vertical", "w", "r")], CU["K"], "c")
                            for i, l, s, t in (("K01", "Face square", "Toe points straight up", "g"), ("K02", "Face open", "Toe turned to the right", "b"))]),
 "grip-palm": ("pair", 0, [F("L01", "In the fingers", "Across the base of the fingers", "g", box=CU["L01"], tag="c"), F("L02", "In the palm", "Opens the face, you slice", "b", box=CU["L02"], tag="c")]),
 "strike": ("pair", 0, [F(i, l, s, t, [["ring", c, r, TB(t)], tag((320, 885), "Toe", "w"), tag((1180, 870), "Heel", "w")], CU["M"], "c") for i, l, s, t, c, r in
                        (("M04", "Centre", "Longest and straightest", "g", (727, 580), 116), ("M05", "Toe", "Shorter, tends to hook", "b", (455, 525), 108),
                         ("M06", "Heel", "Shorter, tends to slice", "b", (1141, 530), 92))]),
 # Swing lengths for the plan goals (not a Library tip): the top of each swing, a ring on the hands
 "lengths": ("sequence", 0, [dict(F(i, k, "", box=b, tag=t, g=[ring(i, "hands", r, "w")]), k=k) for k, i, b, t, r in
                             (("half", "A03", SEQC, "s", 46), ("tq", "A05", SEQC, "s", 46), ("full", "A06", SEQC, "s", 46), ("chip", "H03", CHIP, "chip", 40), ("putt", "I02", FACE, "f", 40))]),
 "bunker": ("sequence", 1, [F("N01", "Open setup", "Aim left, face open, ball forward", box=DTL, tag="d"), F("N02", "Splash the sand", "Enter 5 to 8 cm behind the ball", box=FACE, tag="f")]),
}
# The full swing ends at A15 until A16 and A17 are redone (their hands are reversed on the grip)
SEQ = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12", "A13", "A14", "A15"]
SEQ_NAMES = ["Setup", "Takeaway", "Club parallel", "Lead arm parallel", "Three quarter", "Top", "Transition", "Downswing", "Delivery", "Impact", "Release", "Follow through", "Club up", "High", "Finish"]
TEMPO = ["A01", "A02", "A04", "A06", "A08", "A10"]

def tr(mp, g):
    t = g[0]
    if t == "line": return ["line", mp(g[1]), mp(g[2]), g[3], g[4]]
    if t == "path": return ["path", [mp(q) for q in g[1]], g[2]]
    if t == "arrow": return ["arrow", mp(g[1]), mp(g[2]), g[3]]
    if t == "ring": return ["ring", mp(g[1]), round(g[2] * (mp((g[2], 0))[0] - mp((0, 0))[0]) / g[2], 1), g[3]]
    if t == "weight": return ["weight", mp(g[1]), mp(g[2]), g[3]] + g[4:]
    if t == "tag": return ["tag", mp(g[1]), g[2], g[3], g[4]]
    raise ValueError(t)

os.makedirs(OUT, exist_ok=True); photo = {}; prev = []
for tid, (typ, live, panels) in TIPS.items():
    frames = []
    for p in panels:
        name, w, h, mp, im = crop(p["img"], p["box"], 540 if p["tag"] == "s" else 600, p["tag"]); gs = [tr(mp, g) for g in p["g"]]   # "s" files are the swing sequence's
        frames.append({"f": name, "w": w, "h": h, "label": p["label"], "sub": p["sub"], "tone": p["tone"], "g": gs, **({"k": p["k"]} if p.get("k") else {})})
        if PREV:
            pv = im.copy(); d = ImageDraw.Draw(pv); C = {"w": (255, 255, 255), "b": (255, 130, 120), "n": (200, 200, 200), "g": (207, 228, 73)}
            for g in gs:
                if g[0] in ("line", "arrow"): d.line([tuple(g[1]), tuple(g[2])], fill=C[g[3]], width=4)
                elif g[0] == "path": d.line([tuple(q) for q in g[1]], fill=C[g[2]], width=4)
                elif g[0] == "ring": x, y = g[1]; r = g[2]; d.ellipse((x - r, y - r, x + r, y + r), outline=C[g[3]], width=4)
                elif g[0] == "weight":
                    a, b = g[1], g[2]; d.line([tuple(a), tuple(b)], fill=(255, 255, 255), width=6); x = a[0] + (b[0] - a[0]) * g[3] / 100; d.ellipse((x - 14, a[1] - 14, x + 14, a[1] + 14), fill=(207, 228, 73))
            d.rectangle((0, 0, 600, 40), fill=(0, 0, 0)); d.text((8, 12), f"{tid} {p['img']} {p['tone']} {p['label']}", fill=(255, 255, 0)); prev.append(pv)
    photo[tid] = {"t": typ, "live": live, "frames": frames}
seq = []
for i in SEQ:
    name, w, h, mp, im = crop(i, SEQC, 540, "s"); seq.append([name, w, h, SEQ_NAMES[len(seq)]])
tempo = [[f"{i}-s.webp", seq[0][1], seq[0][2]] for i in TEMPO]
# cover: O01, the course at dawn, cropped to 8:5
h_im = Image.open(os.path.join(FIN, "O01.png")).convert("RGB").crop((0, 40, 1536, 1000)).resize((960, 600), Image.LANCZOS)
h_im.save(os.path.join(OUT, "hero.webp"), "WEBP", quality=80, method=6)
js = ("// Generated by tools/photos/export2.py from the approved ChatGPT photo set: file, size, captions and guides in pixels\n"
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
