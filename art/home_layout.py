"""家の場面の配置。ゲームと同じ apps/client/src/scene/spots.json を読む"""

import json
import math
import os

from lowpoly import rng

_SPOTS_PATH = os.path.join(os.path.dirname(__file__), "..", "apps", "client", "src", "scene", "spots.json")

with open(_SPOTS_PATH, encoding="utf-8") as f:
    _DATA = json.load(f)

# 庭の広さ。この内側は平らで、草花や石はこの中にだけ置く
YARD_RADIUS = _DATA["yardRadius"]
SPOTS = {name: tuple(value) for name, value in _DATA["spots"].items()}
ROUTE = [tuple(p) for p in _DATA["route"]]
# 町の場所と、家の前から町へ続く道
TOWN = tuple(_DATA["town"])
ROAD = [tuple(p) for p in _DATA["road"]]

# 物を置かない区画（x, z, 半径）
BLOCKED = [
    (SPOTS["hut"][0], SPOTS["hut"][2], 1.6),
    (SPOTS["field"][0], SPOTS["field"][2], 1.5),
    (SPOTS["bed"][0], SPOTS["bed"][2], 0.8),
    (SPOTS["gate"][0], SPOTS["gate"][2], 0.9),
    (SPOTS["lantern"][0], SPOTS["lantern"][2], 0.4),
    (SPOTS["woodpile"][0], SPOTS["woodpile"][2], 0.6),
    (SPOTS["pond"][0], SPOTS["pond"][2], 1.4),
    *[(x, z, 0.45) for x, _, z in ROUTE],
    *[(x, z, 0.7) for x, _, z in ROAD],
]


def scatter(seed, count, keep_out=(), margin=0.3, radius=None):
    """草や花を、家や道を避けて庭にばらまく。keep_out は追加で避ける区画、radius はばらまく範囲"""
    random = rng(seed)
    zones = [*BLOCKED, *keep_out]
    placed = []
    for _ in range(count * 20):
        if len(placed) >= count:
            break
        angle = random() * math.pi * 2
        distance = math.sqrt(random()) * ((radius or YARD_RADIUS) - margin)
        x, z = math.cos(angle) * distance, math.sin(angle) * distance
        scale, turn, pick = 0.7 + random() * 0.6, random() * math.pi * 2, random()
        if all(math.hypot(x - zx, z - zz) > r for zx, zz, r in zones):
            placed.append({"x": x, "z": z, "scale": scale, "turn": turn, "pick": pick})
    return placed


def route_heading():
    """入口へ向かう最後の区間の向き（上下軸まわりの角度）"""
    (x0, _, z0), (x1, _, z1) = ROUTE[-2], ROUTE[-1]
    return math.atan2(x1 - x0, z1 - z0)
