"""Load and validate the 404 game map."""

import tomllib
from pathlib import Path

SECTIONS = (
    "map",
    "random",
    "landmark",
    "tunnel",
    "pickups",
    "play",
    "assets",
    "heuristic",
)
STREAMS = ("topology", "loops", "pickups", "symbols", "hunt", "effects")
ASSETS = ("goal", "neutral", "scared", "happy", "dead")
MAP_TOML = Path("assets") / "game" / "map.toml"

REWARD_KEYS = (
    "junctions",
    "junctions_jitter",
    "cycles",
    "cycles_jitter",
    "turns",
    "turns_jitter",
    "options",
    "options_jitter",
    "path",
    "path_jitter",
)
PENALTY_KEYS = (
    "dead_ends",
    "dead_ends_jitter",
    "four_ways",
    "four_ways_jitter",
    "straight",
    "straight_jitter",
    "straight_free",
    "chambers",
    "chambers_jitter",
)
STRICT_KEYS = (
    "minimum_turns",
    "maximum_straight",
    "maximum_dead_ends",
    "maximum_four_ways",
    "maximum_chambers",
)
COMBO_KEYS = (
    "twist_cycle",
    "junction_options",
    "dead_chamber_stack",
    "openness_ratio",
    "balanced_path_bonus",
    "tunnel_twist_bonus",
    "four_way_tax",
    "route_richness",
)


def require(condition, message):
    if not condition:
        raise ValueError(f"{MAP_TOML.as_posix()}: {message}")


def number(value):
    return type(value) in (int, float) and value == value


def coordinate(value, columns, rows):
    return (
        isinstance(value, list)
        and len(value) == 2
        and all(type(part) is int for part in value)
        and 0 < value[0] < columns - 1
        and 0 < value[1] < rows - 1
    )


def validate_heuristic(heuristic, board):
    require(isinstance(heuristic, dict), "heuristic section is required")
    require(
        type(heuristic.get("seed_mix")) is int
        and type(heuristic.get("path_ideal_min_weight")) is int
        and type(heuristic.get("path_ideal_max_weight")) is int
        and heuristic["path_ideal_min_weight"] > 0
        and heuristic["path_ideal_max_weight"] > 0
        and number(heuristic.get("path_deviation"))
        and heuristic["path_deviation"] >= 0
        and number(heuristic.get("tunnel_bonus"))
        and number(heuristic.get("strict_bonus")),
        "heuristic core fields are invalid",
    )

    braid = heuristic.get("braid")
    require(
        isinstance(braid, dict)
        and type(braid.get("extra_min")) is int
        and braid["extra_min"] >= 0
        and type(braid.get("extra_span")) is int
        and braid["extra_span"] > 0,
        "heuristic.braid is invalid",
    )

    tunnel = heuristic.get("tunnel")
    require(
        isinstance(tunnel, dict)
        and type(tunnel.get("minimum_home_distance")) is int
        and tunnel["minimum_home_distance"] >= 0,
        "heuristic.tunnel is invalid",
    )

    rewards = heuristic.get("rewards")
    penalties = heuristic.get("penalties")
    strict = heuristic.get("strict")
    combos = heuristic.get("combos")
    require(isinstance(rewards, dict), "heuristic.rewards is required")
    require(isinstance(penalties, dict), "heuristic.penalties is required")
    require(isinstance(strict, dict), "heuristic.strict is required")
    require(isinstance(combos, dict), "heuristic.combos is required")
    require(all(number(rewards.get(key)) for key in REWARD_KEYS), "heuristic.rewards values are invalid")
    require(all(number(penalties.get(key)) for key in PENALTY_KEYS), "heuristic.penalties values are invalid")
    require(
        all(type(strict.get(key)) is int and strict[key] >= 0 for key in STRICT_KEYS),
        "heuristic.strict values are invalid",
    )
    require(all(number(combos.get(key)) for key in COMBO_KEYS), "heuristic.combos values are invalid")
    require(
        type(penalties["straight_free"]) is int and penalties["straight_free"] >= 0,
        "straight_free must be a non-negative integer",
    )

    chambers = heuristic.get("chambers")
    require(isinstance(chambers, list) and chambers, "heuristic.chambers must be a non-empty list")
    for chamber in chambers:
        require(
            isinstance(chamber, dict)
            and type(chamber.get("width")) is int
            and type(chamber.get("height")) is int
            and number(chamber.get("weight"))
            and chamber["width"] >= 2
            and chamber["height"] >= 2
            and chamber["width"] < board["columns"]
            and chamber["height"] < board["rows"]
            and chamber["weight"] > 0,
            "heuristic chamber detectors are invalid",
        )


def load_map(path, docs_dir):
    with Path(path).open("rb") as source:
        data = tomllib.load(source)

    require(
        all(isinstance(data.get(section), dict) for section in SECTIONS),
        f"required sections are {', '.join(SECTIONS)}",
    )
    board = data["map"]
    integer_keys = (
        "columns",
        "rows",
        "attempts",
        "minimum_path",
        "maximum_path",
        "minimum_cycles",
        "minimum_junctions",
        "route_options",
    )
    require(
        all(type(board.get(key)) is int for key in integer_keys),
        "map values must be integers",
    )
    columns, rows = board["columns"], board["rows"]
    require(columns >= 9 and rows >= 9 and columns % 2 and rows % 2, "dimensions must be odd and at least 9")
    require(board["attempts"] > 0, "attempts must be positive")
    require(0 < board["minimum_path"] <= board["maximum_path"], "path range is invalid")
    require(
        board["minimum_cycles"] >= 0
        and board["minimum_junctions"] >= 0
        and board["route_options"] >= 2,
        "topology limits are invalid",
    )

    random = data["random"]
    streams = random.get("streams")
    require(
        type(random.get("leap")) is int
        and random["leap"] > 0
        and type(random.get("generation_step")) is int
        and random["generation_step"] > 0
        and isinstance(streams, dict),
        "random configuration is invalid",
    )
    offsets = [streams.get(name) for name in STREAMS]
    require(
        all(type(offset) is int and 0 <= offset < random["leap"] for offset in offsets)
        and len(set(offsets)) == len(offsets),
        "stream offsets must be unique lanes below leap",
    )

    landmark = data["landmark"]
    mask = landmark.get("mask")
    require(
        isinstance(mask, list)
        and mask
        and all(
            isinstance(line, str)
            and len(line) == len(mask[0])
            and set(line) <= {"#", "."}
            for line in mask
        ),
        "landmark mask must be a non-empty rectangle of # and .",
    )
    require(
        type(landmark.get("x")) is int
        and type(landmark.get("y")) is int
        and type(landmark.get("clearance")) is int
        and landmark["clearance"] >= 0,
        "landmark position and clearance must be integers",
    )
    x, y, clearance = landmark["x"], landmark["y"], landmark["clearance"]
    require(
        x - clearance > 0
        and y - clearance > 0
        and x + len(mask[0]) + clearance < columns
        and y + len(mask) + clearance < rows,
        "landmark and clearance must fit inside the border",
    )
    require(
        isinstance(landmark.get("ghosts"), list)
        and len(landmark["ghosts"]) == 2
        and all(coordinate(point, columns, rows) for point in landmark["ghosts"])
        and isinstance(landmark.get("pen_exit"), list)
        and landmark["pen_exit"]
        and all(coordinate(point, columns, rows) for point in landmark["pen_exit"])
        and all(
            not (
                x <= point[0] < x + len(mask[0])
                and y <= point[1] < y + len(mask)
            )
            or mask[point[1] - y][point[0] - x] == "."
            for point in landmark["ghosts"] + landmark["pen_exit"]
        ),
        "ghost and pen coordinates are invalid",
    )

    tunnel = data["tunnel"]
    tunnel_rows = tunnel.get("rows")
    require(
        type(tunnel.get("numerator")) is int
        and type(tunnel.get("denominator")) is int
        and 0 < tunnel["numerator"] < tunnel["denominator"]
        and isinstance(tunnel_rows, list)
        and tunnel_rows
        and len(set(tunnel_rows)) == len(tunnel_rows)
        and all(type(row) is int and row % 2 and 0 < row < rows - 1 for row in tunnel_rows),
        "tunnel probability or rows are invalid",
    )
    require(
        all(row < y - clearance or row >= y + len(mask) + clearance for row in tunnel_rows),
        "tunnel rows must avoid landmark clearance",
    )

    pickups = data["pickups"]
    items = pickups.get("items")
    require(
        type(pickups.get("minimum_spacing")) is int
        and pickups["minimum_spacing"] > 0
        and type(pickups.get("pellet_points")) is int
        and pickups["pellet_points"] > 0
        and isinstance(items, list)
        and len(items) == 5,
        "five spaced pickup items are required",
    )
    fields = {"symbol", "id", "label", "points", "power_ticks", "anchor"}
    require(
        all(isinstance(item, dict) and fields <= item.keys() for item in items),
        "pickup fields are missing",
    )
    require(
        len({item["symbol"] for item in items}) == len(items)
        and len({item["id"] for item in items}) == len(items)
        and all(
            isinstance(item["symbol"], str)
            and len(item["symbol"]) == 1
            and item["symbol"] not in "#.+G PHT"
            and isinstance(item["id"], str)
            and item["id"]
            and isinstance(item["label"], str)
            and item["label"]
            and type(item["points"]) is int
            and item["points"] > 0
            and type(item["power_ticks"]) is int
            and item["power_ticks"] >= 0
            and isinstance(item["anchor"], list)
            and len(item["anchor"]) == 2
            and all(type(part) in (int, float) and 0 <= part <= 1 for part in item["anchor"])
            for item in items
        ),
        "pickup values must be unique, typed, and normalized",
    )
    require(sum(item["power_ticks"] > 0 for item in items) == 2, "exactly two power pickups are required")

    play = data["play"]
    require(
        coordinate(play.get("player"), columns, rows)
        and coordinate(play.get("home"), columns, rows)
        and all(part % 2 for point in (play["player"], play["home"]) for part in point)
        and play["player"] != play["home"],
        "player and home must be distinct interior odd cells",
    )
    require(
        all(
            type(play.get(key)) is int and play[key] > 0
            for key in ("lives", "ghost_interval_ms", "grace_ticks", "predator_points")
        )
        and type(play.get("power_warning_ticks")) is int
        and play["power_warning_ticks"] >= 0,
        "play values are invalid",
    )

    docs = Path(docs_dir).resolve()
    require(all(isinstance(data["assets"].get(name), str) for name in ASSETS), "asset paths are missing")
    for name in ASSETS:
        asset = (docs / data["assets"][name]).resolve()
        require(asset.is_relative_to(docs) and asset.is_file(), f"{name} asset is outside docs or missing")

    validate_heuristic(data["heuristic"], board)
    return data


def on_config(config):
    docs = Path(config.docs_dir).resolve()
    config.extra["game"] = load_map(docs / MAP_TOML, docs)
    return config
