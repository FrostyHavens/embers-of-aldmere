# Generates src/mapdata.js from painted grids. All layouts are original.
import json
class M:
    def __init__(s, w, h, fill='.'):
        s.w, s.h = w, h; s.g = [[fill]*w for _ in range(h)]; s.pos = {}
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def rect(s, x, y, w, h, c):
        for j in range(y, y+h):
            for i in range(x, x+w): s.put(i, j, c)
    def border(s, c, t=1):
        for j in range(s.h):
            for i in range(s.w):
                if i < t or j < t or i >= s.w-t or j >= s.h-t: s.g[j][i] = c
    def hline(s, x0, x1, y, c):
        for i in range(min(x0,x1), max(x0,x1)+1): s.put(i, y, c)
    def vline(s, x, y0, y1, c):
        for j in range(min(y0,y1), max(y0,y1)+1): s.put(x, j, c)
    def path(s, pts, c=','):
        for (a, b) in zip(pts, pts[1:]):
            (x0, y0), (x1, y1) = a, b
            s.hline(x0, x1, y0, c); s.vline(x1, y0, y1, c)
    def house(s, x, y, w, roof='R', tag=None, door=None, walls=None):
        # roof rows y, y+1 ; wall row y+2 ; door at x+door
        s.rect(x, y, w, 2, roof)
        row = walls or ('W' + 'N'*(w-2) + 'W')
        for i, c in enumerate(row): s.put(x+i, y+2, c)
        d = door if door is not None else w//2
        s.put(x+d, y+2, 'D')
        if tag: s.pos[tag] = [x+d, y+2]
        return (x+d, y+3)
    def church(s, x, y, tag):
        s.rect(x, y, 7, 2, 'Q'); s.put(x+3, y, '+')
        for i, c in enumerate('SGSKSGS'): s.put(x+i, y+2, c)
        s.pos[tag] = [x+3, y+2]
    def mark(s, tag, x, y): s.pos[tag] = [x, y]
    def rows(s): return [''.join(r) for r in s.g]

out = {}

# ---------------- Tallowmere (town) 34x26 ----------------
t = M(34, 26)
t.border('T', 1)
t.rect(0, 0, 34, 2, 'T')
for x, y in [(1,2),(2,2),(3,3),(30,2),(31,2),(32,3),(1,24),(2,23),(32,23),(31,24)]: t.put(x, y, 'f')
# river on east side
t.rect(29, 0, 2, 26, 'w')
t.rect(28, 21, 3, 1, 'w'); t.rect(27, 22, 3, 4, 'w'); t.put(30,22,'.'); t.put(30,23,'.')
# chapel (north centre)
t.church(13, 2, 'chapelDoor')
t.put(12, 4, 'P'); t.put(20, 4, 'P')
t.rect(11, 2, 1, 1, 'g'); t.put(22, 2, 'g'); t.put(23, 3, 'g')
# elder house (west)
t.house(3, 5, 5, 'R', 'elderDoor')
# weapon shop (east)
t.house(23, 6, 5, 'R', 'weaponDoor', walls='WNWNW')
t.put(22, 8, 'k'); t.put(28, 8, 'k')
# forge / HQ (south-west)
t.house(3, 14, 6, 'R', 'forgeDoor', door=2)
t.put(9, 16, 'k'); t.put(2, 16, 'k')
# item shop (south-east)
t.house(21, 15, 5, 'Q', 'itemDoor')
t.put(20, 17, 'Y')
# small house (south)
t.house(11, 19, 4, 'R', 'houseDoor', door=1)
# plaza
t.rect(10, 8, 12, 5, '=')
t.rect(12, 9, 8, 3, 'p')
t.put(16, 10, 'l'); t.mark('well', 16, 10)
t.put(10, 8, 'L'); t.put(21, 8, 'L'); t.put(10, 12, 'L'); t.put(21, 12, 'L')
t.put(13, 10, 'Z')
# paths
t.path([(16,5),(16,8)], ',')
t.path([(5,8),(10,8)], ',') ; t.vline(5, 8, 13, ','); t.path([(5,13),(10,13)], ',')
t.path([(5,17),(5,18)], ',')
t.vline(5, 17, 22, ',')
t.path([(25,9),(25,10)], ','); t.hline(22, 28, 10, ',')
t.hline(16, 23, 18, ',')
t.vline(16, 13, 25, ','); t.hline(12, 16, 22, ',')
t.hline(5, 16, 22, ',')
# bridge east + exit
t.put(29, 10, 'b'); t.put(30, 10, 'b'); t.hline(31, 33, 10, ','); t.mark('eastExit', 33, 10)
t.put(33, 9, 'T'); t.put(33, 11, 'T')
t.put(16, 25, ','); t.mark('southExit', 16, 25)
# fields & fences
t.rect(9, 15, 7, 1, 'F'); t.rect(9, 16, 1, 2, 'F')
t.rect(10, 16, 6, 2, 'y')
t.rect(18, 20, 1, 4, 'F'); t.rect(19, 20, 6, 4, 'y'); t.rect(25, 20, 1, 4, 'F'); t.rect(18, 24, 8, 1, 'F')
t.put(21, 20, 'y')
for x, y in [(8,3),(9,4),(24,4),(26,4),(2,11),(7,11),(25,12),(3,21),(8,24),(12,24)]: t.put(x, y, 'o')
t.put(27,4,'P'); t.put(8,6,'P')
t.put(26, 13, 'r')
out['tallowmere'] = t

# ---------------- Interiors ----------------
def room(w, h, tag='door', doorx=None):
    r = M(w, h, 'i'); r.border('I', 1)
    dx = doorx if doorx is not None else w//2
    r.put(dx, h-1, 'i'); r.mark(tag, dx, h-1)
    return r

c = M(13, 12, 'c'); c.border('I', 1)
c.rect(6, 1, 1, 11, 'q')
c.put(6, 2, 'a'); c.put(5, 2, 'a'); c.put(7, 2, 'a')
c.put(2, 1, 'n'); c.put(10, 1, 'n')
for y in (5, 7, 9):
    c.rect(2, y, 3, 1, 'u'); c.rect(8, y, 3, 1, 'u')
c.put(1, 3, 'P'); c.put(11, 3, 'P')
c.put(6, 11, 'q'); c.mark('door', 6, 11)
c.mark('priest', 6, 3)
out['chapel'] = c

e = room(11, 9)
e.put(2, 1, 'n'); e.put(3, 1, 'n'); e.put(5, 1, 'v'); e.put(8, 1, 'n')
e.rect(3, 4, 3, 1, 't'); e.put(8, 3, 'j'); e.put(8, 4, 'j'); e.put(1, 6, 'P'); e.put(9, 6, 'k')
e.rect(5, 5, 1, 3, 'q')
out['elderhouse'] = e

w = room(10, 8)
w.rect(2, 3, 6, 1, 'e'); w.put(1, 1, 'n'); w.put(8, 1, 'n'); w.put(1, 5, 'k'); w.put(8, 5, 'k')
w.mark('clerk', 4, 2)
out['weaponshop'] = w

s = room(10, 8)
s.rect(2, 3, 6, 1, 'e'); s.put(2, 1, 'n'); s.put(3, 1, 'n'); s.put(7, 1, 'n'); s.put(8, 5, 'P'); s.put(1, 5, 'k')
s.mark('clerk', 5, 2)
out['itemshop'] = s

f = room(11, 9, doorx=3)
f.put(8, 1, 'v'); f.put(9, 1, 'v'); f.rect(6, 4, 3, 1, 't'); f.put(1, 2, 'k'); f.put(1, 3, 'k'); f.put(2, 2, 'k')
f.put(9, 5, 'j'); f.put(9, 6, 'j'); f.put(5, 1, 'n')
f.rect(3, 5, 1, 3, 'q')
out['forge'] = f

hs = room(8, 7, doorx=3)
hs.put(1, 1, 'n'); hs.put(5, 1, 'v'); hs.put(6, 2, 'j'); hs.put(6, 3, 'j'); hs.rect(2, 3, 2, 1, 't')
out['house'] = hs

# ---------------- Overworld: Aldmere Vale 44x30 ----------------
o = M(44, 30)
o.rect(0, 0, 44, 2, 'M'); o.rect(0, 0, 1, 30, 'T'); o.rect(0, 28, 44, 2, 'T'); o.rect(43, 0, 1, 30, 'M')
o.rect(1, 2, 8, 3, 'h'); o.rect(12, 2, 10, 2, 'M'); o.rect(28, 2, 14, 3, 'M'); o.rect(33, 5, 9, 2, 'h')
# Tallowmere entrance at west
o.house(1, 10, 3, 'R', door=1); o.house(1, 15, 3, 'Q', door=1); o.rect(1, 13, 4, 2, ','); o.put(4, 12, 'P'); o.put(4, 15, 'L'); o.put(5, 14, ','); o.mark('town', 5, 14)
o.rect(1, 9, 5, 1, 'f'); o.rect(1, 18, 5, 1, 'f'); o.put(5,11,'F'); o.put(5,12,'F'); o.put(5,16,'F'); o.put(5,17,'F')
# road east
o.hline(5, 14, 14, ','); o.vline(14, 14, 18, ','); o.hline(14, 20, 18, ',')
# river north-south with Mill Bridge
o.rect(21, 2, 2, 26, 'w'); o.put(21, 18, 'b'); o.put(22, 18, 'b')
o.mark('millbridge', 20, 18)
o.hline(23, 27, 18, ','); o.vline(27, 10, 18, ',')
# woodcutter camp
o.mark('camp', 27, 10)
o.rect(25, 7, 5, 2, 'f')
# wraithwood forest
o.rect(28, 12, 9, 8, 'f'); o.rect(30, 14, 5, 4, 'T')
o.hline(27, 29, 10, ','); o.vline(29, 10, 11, ','); o.mark('wraithwood', 29, 11)
o.hline(29, 37, 11, ',') 
o.vline(37, 11, 22, ','); o.hline(37, 40, 22, ',')
o.mark('fort', 40, 22)
o.rect(39, 20, 3, 2, 'X'); o.rect(41, 21, 2, 3, 'X')
# decorations
o.rect(8, 20, 8, 5, 'f'); o.rect(10, 6, 6, 4, 'f'); o.rect(15, 22, 4, 4, 'h'); o.rect(24, 22, 10, 5, 's'); o.rect(33, 24, 6, 3, 'h')
o.rect(6, 6, 3, 3, 'o'); o.put(12, 12, 'r'); o.put(18, 10, 'r'); o.rect(24, 12, 2, 2, 'o')
out['vale'] = o

# ---------------- Woodcutter camp 20x14 ----------------
k = M(20, 14)
k.border('T', 1)
k.rect(1, 1, 18, 2, 'T')
k.house(3, 3, 5, 'R', 'cabinDoor')
k.rect(12, 4, 4, 1, 'k'); k.put(15, 5, 'k')
k.put(11, 8, 'Z'); k.mark('shrine', 11, 9)
k.rect(4, 9, 3, 1, 'k')
k.path([(0, 11), (10, 11)], ','); k.vline(10, 6, 11, ','); k.hline(5, 10, 6, ',')
k.put(0, 11, ','); k.mark('westExit', 0, 11)
k.put(19, 11, ','); k.hline(10, 19, 11, ','); k.mark('eastExit', 19, 11)
k.put(1, 11, ','); k.put(18, 11, ',')
for x, y in [(3,7),(14,8),(16,10),(7,12)]: k.put(x, y, 'o')
out['camp'] = k

# ---------------- Battle maps ----------------
# B1 Tallowmere Fields 22x18
b = M(22, 18)
b.rect(0, 0, 22, 1, 'T'); b.rect(0, 0, 1, 18, 'T'); b.rect(21, 0, 1, 18, 'T')
b.rect(4, 3, 6, 4, 'y'); b.rect(3, 2, 8, 1, 'F'); b.rect(3, 7, 3, 1, 'F'); b.rect(8, 7, 3, 1, 'F'); b.rect(3, 3, 1, 4, 'F'); b.rect(10, 3, 1, 4, 'F')
b.vline(11, 0, 17, ','); b.hline(11, 16, 9, ',')
b.rect(14, 2, 5, 4, 'f'); b.rect(1, 11, 4, 5, 'f'); b.rect(16, 12, 5, 5, 'f'); b.rect(7, 12, 3, 3, 'h')
b.rect(17, 7, 3, 3, 'h'); b.put(6, 10, 'r'); b.put(14, 14, 'r')
b.rect(12, 16, 3, 2, 'f')
b.put(13, 11, 'k'); b.put(2, 9, 'g')
out['b1'] = b

# B2 Mill Bridge 26x18 (river crossing east)
m = M(26, 18)
m.rect(0, 0, 26, 1, 'T'); m.rect(0, 17, 26, 1, 'T')
m.rect(11, 0, 3, 18, 'w'); m.rect(12, 8, 1, 1, 'b'); m.rect(11, 8, 3, 1, 'b')
m.rect(11, 3, 3, 1, '~')
m.hline(0, 10, 8, ','); m.hline(14, 25, 8, ',')
m.house(17, 2, 4, 'R', 'mill', door=1)
m.rect(2, 2, 4, 3, 'f'); m.rect(3, 12, 5, 3, 'f'); m.rect(15, 12, 4, 4, 'f'); m.rect(21, 11, 4, 5, 'h')
m.rect(7, 5, 2, 2, 'h'); m.put(9, 13, 'r'); m.put(16, 9, 'k'); m.put(22, 6, 'r')
m.rect(19, 13, 1, 1, 'r')
out['b2'] = m

# B3 Wraithwood 24x20
ww = M(24, 20, 'f')
ww.border('T', 1)
ww.rect(3, 3, 3, 3, 'T'); ww.rect(15, 2, 4, 3, 'T'); ww.rect(8, 9, 3, 2, 'T'); ww.rect(17, 12, 3, 4, 'T')
ww.rect(5, 14, 4, 3, 'T')
ww.path([(1, 17), (6, 17)], ','); ww.vline(11, 4, 17, ','); ww.hline(6, 11, 17, ',') ; ww.hline(11, 21, 4, ',')
ww.rect(12, 7, 5, 4, '.'); ww.rect(2, 7, 4, 4, '.'); ww.rect(18, 6, 4, 4, '.')
ww.rect(13, 13, 3, 3, '~'); ww.rect(14, 14, 1, 1, 'w')
ww.put(20, 7, 'g'); ww.put(19, 8, 'g'); ww.put(21, 9, 'g'); ww.put(14, 8, 'r')
ww.rect(1, 16, 5, 3, '.')
out['b3'] = ww

# B4 Fort Bramble 24x22
fb = M(24, 22)
fb.rect(0, 0, 24, 1, 'M'); fb.rect(0, 0, 1, 22, 'T'); fb.rect(23, 0, 1, 22, 'T')
fb.rect(4, 1, 16, 11, 'x')
fb.rect(4, 1, 16, 1, 'X'); fb.rect(4, 1, 1, 11, 'X'); fb.rect(19, 1, 1, 11, 'X')
fb.rect(4, 11, 6, 1, 'X'); fb.rect(14, 11, 6, 1, 'X')
fb.rect(10, 11, 4, 1, 'x')
fb.rect(8, 4, 2, 2, 'X'); fb.rect(14, 4, 2, 2, 'X')
fb.rect(10, 2, 4, 1, 'q')
fb.put(5, 2, 'k'); fb.put(18, 2, 'k'); fb.put(5, 10, 'k')
fb.rect(11, 12, 2, 7, ','); fb.hline(11, 12, 21, ',')
fb.rect(1, 14, 4, 5, 'f'); fb.rect(19, 13, 4, 6, 'f'); fb.rect(6, 16, 3, 2, 'h'); fb.rect(15, 17, 3, 2, 'h')
fb.put(8, 14, 'r'); fb.put(16, 14, 'r')
fb.rect(1, 20, 22, 2, '.')
out['b4'] = fb

js = ["// Generated by tools/mapgen.py - original map layouts", "'use strict';", "G.MAPDATA = {"]
for kname, mm in out.items():
    js.append("  %s: { rows: %s, pos: %s }," % (kname, json.dumps(mm.rows()), json.dumps(mm.pos)))
js.append("};")
open('/home/claude/game/src/mapdata.js', 'w').write('\n'.join(js) + '\n')
for kname, mm in out.items():
    print('==', kname, mm.w, 'x', mm.h, mm.pos)
    for r in mm.rows(): print(r)
