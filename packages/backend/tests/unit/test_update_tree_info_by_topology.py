import csv
import importlib.util
import re
import sys
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "update_tree_info_by_topology.py"
)


def load_script_module():
    spec = importlib.util.spec_from_file_location(
        "update_tree_info_by_topology", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "genomic_positions",
                "newick",
                "max_branch_length",
                "samples",
                "tree info",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_updates_tree_info_by_visible_topology_and_branch_length(tmp_path):
    module = load_script_module()
    csv_path = tmp_path / "trees.csv"
    write_csv(
        csv_path,
        [
            {
                "genomic_positions": "0",
                "newick": "((A:0.1,B:0.2):0.3,Etal:0.9);",
                "max_branch_length": "0.4",
                "samples": "A",
                "tree info": "#111111",
            },
            {
                "genomic_positions": "1",
                "newick": "((B:0.5,A:0.4):0.1,Etal:0.7);",
                "max_branch_length": "0.8",
                "samples": "B",
                "tree info": "#222222",
            },
            {
                "genomic_positions": "2",
                "newick": "((A:0.1,C:0.2):0.3,Etal:0.9);",
                "max_branch_length": "0.6",
                "samples": "C",
                "tree info": "#333333",
            },
        ],
    )

    summary = module.update_csv(csv_path)

    rows = read_csv(csv_path)
    assert summary.row_count == 3
    assert summary.topology_count == 2
    assert summary.changed_count == 3
    assert summary.backup_path.exists()
    assert [*rows[0].keys()] == [
        "genomic_positions",
        "newick",
        "max_branch_length",
        "samples",
        "tree info",
    ]
    assert all(re.fullmatch(r"#[0-9A-F]{6}", row["tree info"]) for row in rows)

    assert module.base_hue(rows[0]["tree info"]) == module.base_hue(rows[1]["tree info"])
    assert rows[0]["tree info"] != rows[1]["tree info"]
    assert module.base_hue(rows[2]["tree info"]) != module.base_hue(rows[0]["tree info"])
