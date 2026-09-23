# -*- coding: utf-8 -*-
"""Bygger 3D-modeller (GLB) av husen i ritningarna R1-R5. Kor: python _3dmodeller.py

Modellerna ar i skala 1:1 i meter, sa att de star i ratt storlek nar man
stalller dem pa tomten i AR. Matten ar tagna ur ritningarna (PDF pa
skrivbordet, 2026-09-23): fotavtryck, takfotshojd, nockhojd och
oppningarnas storlek. Takvinkeln raknas ur takfot och nock, inte ur
vinkelangivelsen pa takplanen - hojdkoterna ar det som ar matt.
Oppningarnas placering langs fasaden ar avlast ur fasadritningarna och
ungefarlig.

Koordinater: x langs huset (0..L), y uppat, z tvars (0 = baksida, W = framsida,
den som visas forst). Modellen centreras kring origo med marken pa y = 0.
"""
import math
import os

import numpy as np
import trimesh
from shapely.geometry import Polygon

UT = "modeller"
SOCKEL = 0.2      # husets underkant over mark, pa plintar
TAKTJOCK = 0.22   # takskivans tjocklek inklusive lakt


def linjar(c):
    """glTF vill ha grundfärgen i linjär skala, inte sRGB. Utan omräkningen
    blev det svarta huset mellangrått i visaren."""
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(farg, metall=0.0, strav=0.85, namn=None):
    rgb = [linjar(int(farg[i:i + 2], 16)) for i in (1, 3, 5)]
    return trimesh.visual.material.PBRMaterial(
        name=namn, baseColorFactor=rgb + [1.0], metallicFactor=metall, roughnessFactor=strav)


GLAS = material("#2c3a44", metall=0.3, strav=0.08)
KARM = material("#141414", strav=0.6)
DORR = material("#1b1a19", strav=0.55)
BETONG = material("#9b9892", strav=0.95)
TAK = material("#34373a", metall=0.15, strav=0.6, namn="tak")
VARMT = material("#f2c58b", strav=0.9)


class Hus:
    def __init__(self, L, W, fasad):
        self.L, self.W = L, W
        self.fasad = material(fasad, strav=0.8, namn="fasad")
        r, g, b = [int(fasad[i:i + 2], 16) for i in (1, 3, 5)]
        self.list = material("#%02x%02x%02x" % (int(r * 0.72), int(g * 0.72), int(b * 0.72)), strav=0.85, namn="panel")
        self.hojd = None   # vagghojd som funktion av z, satt av taket
        self.delar = []

    def lagg(self, mesh, mat):
        mesh.visual = trimesh.visual.TextureVisuals(material=mat)
        self.delar.append(mesh)

    def lada(self, x0, x1, y0, y1, z0, z1, mat):
        m = trimesh.creation.box(extents=[x1 - x0, y1 - y0, z1 - z0])
        m.apply_translation([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])
        self.lagg(m, mat)

    def profil(self, punkter, x0, x1, mat):
        """Extruderar en tvarsektion (z, y) langs x fran x0 till x1."""
        poly = Polygon(punkter)
        if not poly.exterior.is_ccw:
            poly = Polygon(list(poly.exterior.coords)[::-1])
        m = trimesh.creation.extrude_polygon(poly, x1 - x0)
        # lokal x -> z, lokal y -> y, lokal z -> -x (determinant +1)
        T = np.array([[0, 0, -1, x1], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]], float)
        m.apply_transform(T)
        self.lagg(m, mat)

    def gavelprofil(self, punkter, x_mitt, tjock, mat):
        """Extruderar en figur i gavelns plan (z, y) tunt kring x_mitt."""
        self.profil(punkter, x_mitt - tjock / 2, x_mitt + tjock / 2, mat)

    # --- delar ----------------------------------------------------------
    def plintar(self):
        n = max(2, int(math.ceil(self.L / 2.0)) + 1)
        for i in range(n):
            x = 0.25 + i * (self.L - 0.5) / (n - 1)
            for z in (0.25, self.W - 0.25):
                self.lada(x - 0.15, x + 0.15, 0, SOCKEL, z - 0.15, z + 0.15, BETONG)

    def sadeltak(self, x0, x1, takfot_bak, takfot_fram, nock, nock_z=None,
                 ov_sida=0.3, ov_gavel=(0.3, 0.3), kropp=True):
        """Kropp och tak for ett sadeltak mellan x0 och x1."""
        W = self.W
        zr = W / 2 if nock_z is None else nock_z
        nock = nock - TAKTJOCK   # koten galler takets ovansida
        if kropp:
            self.profil([(0, SOCKEL), (W, SOCKEL), (W, takfot_fram), (zr, nock), (0, takfot_bak)],
                        x0, x1, self.fasad)
        kb = (nock - takfot_bak) / zr
        kf = (nock - takfot_fram) / (W - zr)
        self.hojd = lambda z: takfot_bak + kb * z if z <= zr else nock - kf * (z - zr)
        yb = takfot_bak - ov_sida * kb
        yf = takfot_fram - ov_sida * kf
        t = TAKTJOCK
        self.profil([(-ov_sida, yb), (zr, nock), (W + ov_sida, yf),
                     (W + ov_sida, yf + t), (zr, nock + t), (-ov_sida, yb + t)],
                    x0 - ov_gavel[0], x1 + ov_gavel[1], TAK)

    def pulpettak(self, hog, lag, ov=0.2, ov_gavel=0.3):
        W, L = self.W, self.L
        hog, lag = hog - 0.18, lag - 0.18   # koten galler takets ovansida
        self.profil([(0, SOCKEL), (W, SOCKEL), (W, lag), (0, hog)], 0, L, self.fasad)
        self.hojd = lambda z: hog - (hog - lag) * z / W
        k = (hog - lag) / W
        t = 0.18
        self.profil([(-ov, hog + ov * k), (W + ov, lag - ov * k),
                     (W + ov, lag - ov * k + t), (-ov, hog + ov * k + t)],
                    -ov_gavel, L + ov_gavel, TAK)

    def takkupa(self, x0, x1, takfot_fram, kupa_hojd, lutning_grader, huvud_k):
        """Kupa i framfasadens liv med eget flackt tak upp till huvudtaket."""
        W = self.W
        kd = math.tan(math.radians(lutning_grader))
        d = (kupa_hojd - takfot_fram) / (huvud_k - kd)
        y_in = kupa_hojd + d * kd
        self.profil([(W, takfot_fram - 0.05), (W, kupa_hojd), (W - d, y_in)], x0, x1, self.fasad)
        ov, t = 0.25, 0.16
        self.profil([(W + ov, kupa_hojd - ov * kd), (W - d - 0.1, y_in + 0.1 * kd),
                     (W - d - 0.1, y_in + 0.1 * kd + t), (W + ov, kupa_hojd - ov * kd + t)],
                    x0 - 0.15, x1 + 0.15, TAK)

    def panel(self, steg=0.2):
        """Stående panel: smala mörkare läkt över hela fasaden, som på
        husen i bilderna. Oppningarna läggs ovanpå och täcker dem."""
        W, L, b, u = self.W, self.L, 0.022, 0.012
        n = int(L / steg)
        for i in range(1, n):
            x = i * L / n
            self.lada(x - b / 2, x + b / 2, SOCKEL, self.hojd(W) - 0.02, W, W + u, self.list)
            self.lada(x - b / 2, x + b / 2, SOCKEL, self.hojd(0) - 0.02, -u, 0, self.list)
        n = int(W / steg)
        for i in range(1, n):
            z = i * W / n
            topp = self.hojd(z) - 0.03
            self.lada(-u, 0, SOCKEL, topp, z - b / 2, z + b / 2, self.list)
            self.lada(L, L + u, SOCKEL, topp, z - b / 2, z + b / 2, self.list)

    # --- oppningar --------------------------------------------------------
    def oppning(self, sida, mitt, bredd, underkant, hojd, typ="glas", poster=1):
        """sida: fram, bak, vanster (x=0), hoger (x=L). mitt langs fasaden
        (x for langsidor, z for gavlar)."""
        d, k = 0.03, 0.06
        y0, y1 = underkant, underkant + hojd
        a0, a1 = mitt - bredd / 2, mitt + bredd / 2

        def ruta(a0, a1, y0, y1, ut, tjock, mat):
            if sida == "fram":
                self.lada(a0, a1, y0, y1, self.W + ut - tjock, self.W + ut, mat)
            elif sida == "bak":
                self.lada(a0, a1, y0, y1, -ut, -ut + tjock, mat)
            elif sida == "vanster":
                self.lada(-ut, -ut + tjock, y0, y1, a0, a1, mat)
            else:
                self.lada(self.L + ut - tjock, self.L + ut, y0, y1, a0, a1, mat)

        ruta(a0 - k, a1 + k, y0 - (0 if typ == "dorr" else k), y1 + k, 0.035, 0.035, KARM)
        if typ == "dorr":
            ruta(a0, a1, y0, y1, 0.05, 0.03, DORR)
            return
        ruta(a0, a1, y0, y1, 0.05, 0.02, GLAS)
        for i in range(1, poster):
            p = a0 + i * bredd / poster
            ruta(p - 0.025, p + 0.025, y0, y1, 0.07, 0.03, KARM)

    def spara(self, namn):
        scen = trimesh.Scene()
        for i, m in enumerate(self.delar):
            scen.add_geometry(m, node_name=f"del{i}")
        # centrera: huset i origo, marken pa y = 0
        scen.apply_translation([-self.L / 2, 0, -self.W / 2])
        os.makedirs(UT, exist_ok=True)
        fil = os.path.join(UT, namn + ".glb")
        scen.export(fil)
        b = scen.bounds
        print(f"{fil}: {os.path.getsize(fil) // 1024} kB, "
              f"{b[1][0] - b[0][0]:.2f} x {b[1][2] - b[0][2]:.2f} x {b[1][1]:.2f} m (inkl. takutsprang)")


def k(takfot, nock, halv):
    return (nock - takfot) / halv


# --- R1: 7,14 x 4,20 m, sadeltak, nock 4,00, takfot 2,534 -------------------
h = Hus(7.14, 4.20, "#1f1d1b")
h.plintar()
h.sadeltak(0, h.L, 2.534, 2.534, 4.0, ov_sida=0.155, ov_gavel=(0.3, 0.3))
h.panel()
h.oppning("fram", 1.0, 0.47, 0.434, 2.09)                      # W*1 smalt hogt
h.oppning("fram", 2.7, 0.99, 0.434, 2.09, "dorr")             # D2
h.oppning("fram", 4.3, 0.54, 1.55, 0.57)                       # W8
h.oppning("hoger", 2.1, 3.612, 0.434, 2.09, poster=2)          # W209 glasparti
# glastriangel i gaveln ovanfor glaspartiet
kk = k(2.534, 4.0 - 0.22, 2.1)
h.gavelprofil([(0.55, 2.62), (3.65, 2.62), (2.1, 2.62 + 1.55 * kk * 0.92)], h.L + 0.02, 0.05, KARM)
h.gavelprofil([(0.62, 2.66), (3.58, 2.66), (2.1, 2.66 + 1.48 * kk * 0.9)], h.L + 0.05, 0.03, GLAS)
h.oppning("bak", 2.4, 0.67, 1.1, 1.14)                         # W*3
h.oppning("bak", 4.8, 0.67, 1.1, 1.14)
h.oppning("vanster", 2.1, 0.54, 2.75, 0.57)                    # W8 i gaveln
h.spara("hus-r1")

# --- R2: 8,33 x 3,49 m, sadeltak, nock 4,00, takfot 2,778 -------------------
h = Hus(8.33, 3.49, "#b58f62")
h.plintar()
h.sadeltak(0, h.L, 2.778, 2.778, 4.0, ov_sida=0.155, ov_gavel=(0.4, 0.4))
h.panel()
h.oppning("fram", 1.1, 0.6, 1.35, 0.6)
h.oppning("fram", 2.7, 0.99, 0.434, 2.09, "dorr")
h.oppning("fram", 6.3, 1.8, 0.434, 2.09, poster=2)             # skjutdorr
h.oppning("hoger", 1.35, 0.6, 0.8, 1.6)
h.oppning("hoger", 1.745, 0.45, 3.05, 0.45)                    # litet fonster i gaveln
h.oppning("vanster", 1.745, 0.6, 0.9, 1.2)
h.oppning("bak", 4.2, 1.2, 1.55, 0.55)
h.spara("hus-r2")

# --- R3: 10,83 x 3,90 m, nock 4,35, takfot 2,584, kupa 3,46 -----------------
h = Hus(10.83, 3.90, "#252321")
h.plintar()
h.sadeltak(0, h.L, 2.584, 2.584, 4.35)
h.panel()
h.takkupa(2.0, 9.0, 2.584, 3.46, 12, k(2.584, 4.35 - 0.22, 1.95))
h.oppning("fram", 3.2, 2.5, 0.484, 2.09, poster=2)
h.oppning("fram", 5.2, 0.99, 0.484, 2.09, "dorr")
h.oppning("fram", 7.4, 2.5, 0.484, 2.09, poster=2)
for x in (3.6, 5.5, 7.4):                                     # tre fonster i kupan
    h.oppning("fram", x, 0.9, 2.8, 0.42)
h.oppning("hoger", 1.95, 0.5, 2.85, 0.5)
h.oppning("vanster", 1.95, 0.5, 2.85, 0.5)
h.oppning("bak", 3.0, 0.6, 1.2, 1.2)
h.oppning("bak", 8.0, 0.6, 1.2, 1.2)
h.spara("hus-r3")

# --- R4: 12,50 x 3,90 m, nock 4,05, takfot 2,584, kupa 3,422 ----------------
h = Hus(12.50, 3.90, "#b3aea4")
h.plintar()
h.sadeltak(0, h.L, 2.584, 2.584, 4.05)
h.panel()
h.takkupa(6.8, 10.2, 2.584, 3.422, 7, k(2.584, 4.05 - 0.22, 1.95))
h.oppning("fram", 2.9, 3.57, 0.484, 2.09, poster=4)            # W55
h.oppning("fram", 5.5, 0.87, 0.484, 2.09)                      # W49
h.oppning("fram", 6.5, 0.99, 0.484, 2.09, "dorr")             # D2
h.oppning("fram", 10.3, 1.77, 0.484, 2.09, poster=2)           # W98
h.oppning("fram", 8.5, 2.52, 2.78, 0.5)                        # W154 i kupan
h.oppning("hoger", 1.2, 0.44, 2.95, 0.47)                      # W3
h.oppning("hoger", 2.5, 0.87, 0.484, 2.09)                     # glasdorr
h.oppning("vanster", 1.95, 1.77, 0.484, 2.09, poster=2)        # W98
h.oppning("bak", 3.5, 0.54, 1.5, 0.57)                         # W2
h.oppning("bak", 9.0, 0.87, 0.484, 2.09)                       # W49
h.spara("hus-r4")

# --- R5: 7,50 x 4,00 m, pulpettak 2 grader, hojd 4,00 -----------------------
h = Hus(7.50, 4.00, "#222020")
h.plintar()
h.pulpettak(4.0, 4.0 - 4.0 * math.tan(math.radians(2)))
h.panel()
h.oppning("hoger", 2.0, 3.5, 0.35, 3.3, poster=2)              # glasgavel 2x2
h.lada(h.L + 0.035, h.L + 0.1, 1.95, 2.02, 0.25, 3.75, KARM)   # mittpost liggande
h.oppning("fram", 2.6, 0.99, 0.35, 2.09, "dorr")
h.oppning("fram", 5.6, 0.57, 1.3, 0.57)
h.oppning("bak", 1.8, 1.2, 1.6, 0.4)
h.oppning("bak", 3.4, 0.44, 1.5, 0.47)
h.oppning("bak", 5.3, 0.45, 0.6, 1.9)
h.oppning("vanster", 2.0, 0.6, 1.4, 1.0)
h.spara("hus-r5")
