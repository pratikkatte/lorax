from pathlib import Path
import csv
import hashlib
import re
import argparse

WINDOW_SIZE = 50_000
BRANCH_RE = re.compile(r":([0-9]*\.?[0-9]+(?:e-?\d+)?)")
SUPPORT_RE = re.compile(r"\)([0-9]+(?:\.[0-9]+)?)")
LEAF_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_.-]*)\s*(?=[:),])")

def parse_position_id(value: str) -> tuple[str, int]:
    chr_part, idx_part = value.split("_", 1)
    return chr_part, int(idx_part)


def window_range(idx: int) -> tuple[int, int]:
    start = (idx - 1) * WINDOW_SIZE
    end = start + WINDOW_SIZE
    return start, end


def max_branch_length(newick: str) -> float:
    matches = BRANCH_RE.findall(newick)
    if not matches:
        return 0.0
    return max(float(value) for value in matches)


def format_range(start: int, end: int) -> str:
    return f"{start}"


def topology_key(newick: str) -> str:
    no_lengths = BRANCH_RE.sub("", newick)
    no_support = SUPPORT_RE.sub(")", no_lengths)
    return "".join(no_support.split())


def color_from_topology(key: str, salt: str = "") -> str:
    digest = hashlib.md5(f"{key}{salt}".encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def tree_info_color(key: str, prev_color: str | None) -> str:
    color = color_from_topology(key)
    if prev_color is not None and color == prev_color:
        color = color_from_topology(key, salt="_alt")
    return color


def extract_samples_ordered(newick: str) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for name in LEAF_RE.findall(newick):
        if name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


def write_per_chromosome_csvs(
    input_path: str | Path,
    output_dirpath: str | Path,
    output_prefix: str,
    delimiter: str = "\t",
) -> None:
    input_path = Path(input_path)
    output_dirpath = Path(output_dirpath)

    rows_by_chr: dict[str, list[tuple[int, str]]] = {}

    with input_path.open(newline="") as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        for row in reader:
            if not row:
                continue
            position_id = row[0].strip()
            if not position_id:
                continue
            newick = row[1].strip() if len(row) > 1 else ""
            chr_name, idx = parse_position_id(position_id)
            rows_by_chr.setdefault(chr_name, []).append((idx, newick))

    output_dirpath.mkdir(parents=True, exist_ok=True)

    for chr_name, rows in rows_by_chr.items():
        rows.sort(key=lambda item: item[0])
        output_rows: list[dict[str, object]] = []
        samples_list: list[str] = []
        samples_seen: set[str] = set()
        prev_idx = None
        prev_topology = None
        prev_color = None

        for idx, newick in rows:
            for name in extract_samples_ordered(newick):
                if name not in samples_seen:
                    samples_seen.add(name)
                    samples_list.append(name)

            start, end = window_range(idx)
            key = topology_key(newick)
            if key == prev_topology:
                color = prev_color
            else:
                color = tree_info_color(key, prev_color)

            if prev_idx is not None and idx != prev_idx + 1 and output_rows:
                prev_range = output_rows[-1]["genomic_positions"]
                if isinstance(prev_range, str) and "-" in prev_range:
                    prev_start = int(prev_range.split("-", 1)[0])
                else:
                    prev_start = int(prev_range)
                output_rows[-1]["genomic_positions"] = format_range(prev_start, end)
            else:
                output_rows.append(
                    {
                        "genomic_positions": format_range(start, end),
                        "newick": newick,
                        "max_branch_length": max_branch_length(newick),
                        "tree info": color,
                        "samples": "",
                    }
                )

            prev_idx = idx
            prev_topology = key
            prev_color = color

        for i, sample in enumerate(samples_list):
            if i >= len(output_rows):
                break
            output_rows[i]["samples"] = sample

        output_path = output_dirpath / f"{output_prefix}{chr_name}.csv"
        with output_path.open("w", newline="") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=[
                        "genomic_positions",
                        "newick",
                        "max_branch_length",
                        "tree info",
                        "samples",
                    ],
                )
                writer.writeheader()
                writer.writerows(output_rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate per-chromosome CSVs from a TSV/CSV input.",
    )
    parser.add_argument(
        "input_path",
        help="Path to input file (TSV/CSV).",
    )
    parser.add_argument(
        "output_dirpath",
        help="Directory to write per-chromosome CSVs.",
    )
    parser.add_argument(
        "--output-prefix",
        default="",
        help="Prefix for output CSV filenames.",
    )
    parser.add_argument(
        "--delimiter",
        default="\t",
        help="Input delimiter (default: tab).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    write_per_chromosome_csvs(
        input_path=args.input_path,
        output_dirpath=args.output_dirpath,
        output_prefix=args.output_prefix,
        delimiter=args.delimiter,
    )


if __name__ == "__main__":
    main()
