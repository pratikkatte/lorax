#!/usr/bin/env python3
"""Update CSV tree-info colors from visible Newick topology and branch length."""

from __future__ import annotations

import argparse
import colorsys
import csv
import shutil
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from ete3 import Tree


DEFAULT_CSV_PATH = Path("/home/pratik/.lorax/projects/Heliconius/erato-sara_chr2.csv")
TREE_INFO_COLUMN = "tree info"
NEWICK_COLUMN = "newick"
MAX_BRANCH_LENGTH_COLUMN = "max_branch_length"


@dataclass(frozen=True)
class UpdateSummary:
    row_count: int
    topology_count: int
    backup_path: Path
    changed_count: int


def prune_outgroup(tree: Tree, outgroup: str = "etal") -> None:
    """Prune the outgroup the same way Lorax's CSV display path does."""
    target = None
    outgroup_lower = outgroup.lower()
    for leaf in tree.iter_leaves():
        if str(leaf.name).lower() == outgroup_lower:
            target = leaf
            break
    if target is None:
        return

    try:
        tree.set_outgroup(target)
        target.delete()
        tree.dist = 0.0
        for child in tree.get_children():
            child.dist = 0.0
    except Exception:
        target.detach()


def canonical_topology(newick: str) -> str:
    """Return a branch-length-free, child-order-independent topology key."""
    tree = Tree(str(newick), format=1)
    prune_outgroup(tree)

    def encode(node) -> str:
        children = [child for child in node.children]
        if not children:
            return str(node.name)
        encoded_children = sorted(encode(child) for child in children)
        if len(encoded_children) == 1:
            return encoded_children[0]
        return "(" + ",".join(encoded_children) + ")"

    return encode(tree)


def parse_branch_length(row: dict[str, str]) -> float:
    try:
        value = float(row.get(MAX_BRANCH_LENGTH_COLUMN, ""))
    except (TypeError, ValueError):
        value = 0.0
    return value if value == value else 0.0


def hue_for_topology(index: int) -> float:
    """Generate stable, separated hues for sorted topology keys."""
    return ((index * 137.508) % 360) / 360.0


def color_for(hue: float, shade_fraction: float) -> str:
    value = 0.45 + (0.45 * shade_fraction)
    saturation = 0.72
    red, green, blue = colorsys.hsv_to_rgb(hue, saturation, value)
    return f"#{round(red * 255):02X}{round(green * 255):02X}{round(blue * 255):02X}"


def base_hue(hex_color: str) -> int:
    """Return rounded hue degrees for grouping shade variants in tests/checks."""
    red = int(hex_color[1:3], 16) / 255.0
    green = int(hex_color[3:5], 16) / 255.0
    blue = int(hex_color[5:7], 16) / 255.0
    hue, _lightness, _saturation = colorsys.rgb_to_hls(red, green, blue)
    quantized = round((hue * 360) / 5) * 5
    return quantized % 360


def compute_tree_info_colors(rows: list[dict[str, str]]) -> dict[int, str]:
    topology_by_row = [canonical_topology(row[NEWICK_COLUMN]) for row in rows]
    sorted_topologies = sorted(set(topology_by_row))
    hue_by_topology = {
        topology: hue_for_topology(index)
        for index, topology in enumerate(sorted_topologies)
    }

    branch_lengths_by_topology: dict[str, list[float]] = defaultdict(list)
    for row, topology in zip(rows, topology_by_row):
        branch_lengths_by_topology[topology].append(parse_branch_length(row))

    branch_range_by_topology = {
        topology: (min(values), max(values))
        for topology, values in branch_lengths_by_topology.items()
    }

    colors: dict[int, str] = {}
    for index, (row, topology) in enumerate(zip(rows, topology_by_row)):
        min_branch, max_branch = branch_range_by_topology[topology]
        branch_length = parse_branch_length(row)
        if max_branch > min_branch:
            shade_fraction = (branch_length - min_branch) / (max_branch - min_branch)
        else:
            shade_fraction = 0.5
        colors[index] = color_for(hue_by_topology[topology], shade_fraction)
    return colors


def update_csv(csv_path: str | Path) -> UpdateSummary:
    path = Path(csv_path).expanduser()
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    missing_columns = [
        column
        for column in (NEWICK_COLUMN, MAX_BRANCH_LENGTH_COLUMN, TREE_INFO_COLUMN)
        if column not in fieldnames
    ]
    if missing_columns:
        raise ValueError(f"Missing required column(s): {', '.join(missing_columns)}")

    colors = compute_tree_info_colors(rows)
    changed_count = 0
    for index, row in enumerate(rows):
        new_color = colors[index]
        if row.get(TREE_INFO_COLUMN) != new_color:
            changed_count += 1
        row[TREE_INFO_COLUMN] = new_color

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_name(f"{path.name}.{timestamp}.bak")
    shutil.copy2(path, backup_path)

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return UpdateSummary(
        row_count=len(rows),
        topology_count=len({canonical_topology(row[NEWICK_COLUMN]) for row in rows}),
        backup_path=backup_path,
        changed_count=changed_count,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update a Lorax CSV tree info column by topology and branch length."
    )
    parser.add_argument(
        "csv_path",
        nargs="?",
        default=DEFAULT_CSV_PATH,
        type=Path,
        help=f"CSV to update in place. Defaults to {DEFAULT_CSV_PATH}",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = update_csv(args.csv_path)
    print(f"Rows: {summary.row_count}")
    print(f"Topology groups: {summary.topology_count}")
    print(f"Backup: {summary.backup_path}")
    print(f"Changed tree info values: {summary.changed_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
