"""家の場面の配置。ゲームと同じ apps/client/src/scene/spots.json を読む"""

import json
import math
import os

from lowpoly import rng

_SPOTS_PATH = os.path.join(os.path.dirname(__file__), "..", "apps", "client", "src", "scene", "spots.json")

with open(_SPOTS_PATH, encoding="utf-8") as f:
    _DATA = json.load(f)

ISLAND_RADIUS = _DATA["islandRadius"]
SPOTS = {name: tuple(value) for name, value in _DATA["spots"].items()}
ROUTE = [tuple(p) for p in _DATA["route"]]

# 物を置かない区画（x, z, 半径）
BLOCKED = [
    (SPOTS["hut"][0], SPOTS["hut"][2], 1.6),
    (SPOTS["field"][0], SPOTS["field"][2], 1.5),
    (SPOTS["bed"][0], SPOTS["bed"][2], 0.8),
    (SPOTS["gate"][0], SPOTS["gate"][2], 0.9),
    (SPOTS["lantern"][0], SPOTS["lantern"][2], 0.4),
    (SPOTS["woodpile"][0], SPOTS["woodpile"][2], 0.6),
    *[(x, z, 0.45) for x, _, z in ROUTE],
]


def scatter(seed, count, keep_out=(), margin=0.3):
    """草や花を、家や道を避けて島にばらまく。keep_out は追加で避ける区画"""
    random = rng(seed)
    zones = [*BLOCKED, *keep_out]
    placed = []
    for _ in range(count * 20):
        if len(placed) >= count:
            break
        angle = random() * math.pi * 2
        distance = math.sqrt(random()) * (ISLAND_RADIUS - margin)
        x, z = math.cos(angle) * distance, math.sin(angle) * distance
        scale, turn, pick = 0.7 + random() * 0.6, random() * math.pi * 2, random()
        if all(math.hypot(x - zx, z - zz) > r for zx, zz, r in zones):
            placed.append({"x": x, "z": z, "scale": scale, "turn": turn, "pick": pick})
    return placed


def route_heading():
    """入口へ向かう最後の区間の向き（上下軸まわりの角度）"""
    (x0, _, z0), (x1, _, z1) = ROUTE[-2], ROUTE[-1]
    return math.atan2(x1 - x0, z1 - z0)
