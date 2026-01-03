import datetime
import time
import re

from ete3 import Tree


def get_config(total_tips, all_content_positions,total_nodes, genomic_position_minmax, all_mutations, tree_min_max):
    config = {}
    version = 1.0
    config['num_tips'] = total_tips
    yyyymmdd = datetime.datetime.now().strftime("%Y-%m-%d")
    config['date_created'] = yyyymmdd
    first_json = {
        "version": version,
        "mutations": all_mutations,
        "total_nodes": total_nodes,
        "config": config,
        "trees_position": all_content_positions,
        "genomic_position_minmax": genomic_position_minmax,
        "tree_min_max": tree_min_max
    }
    return first_json


def min_max_branch_length_from_newick(nwk):

    values = re.findall(r":([0-9.eE+-]+)", nwk)
    if not values:
        return 0.0, 0.0
    floats = list(map(float, values))
    return min(floats), max(floats)

def process_csv(df, tree_indexes, window_size=50000, is_time=False, outgroup=None):
    tree_dict = []

    min_time = 0.0 if is_time else None
    max_time = -6.0 if is_time else None

    for t in tree_indexes:
        global_index = int(t["global_index"])
        specific_row = df.loc[df.index == global_index]
        next_row = df.loc[df.index == global_index + 1]
        if next_row.empty:
            interval_end = int(specific_row['genomic_positions'].values[0]) + window_size
        else:
            interval_end = int(next_row['genomic_positions'].values[0])
        mut_map = {}

        # Extract values as native Python types to ensure JSON serializability
        newick = specific_row['newick'].values[0]

        if outgroup:
            newick = remove_outgroup(newick, outgroup)

        min_br, max_br = min_max_branch_length_from_newick(newick)

        genomic_positions = int(specific_row['genomic_positions'].values[0])
        time_range = {
            "start":min_br,
            "end": -max_br
        }
        positions = {
            "start": genomic_positions,
            "end": interval_end
        }
        tree_dict.append({
            "newick": newick,
            "time_range": time_range,
            "positions": positions,
            "mutations": mut_map,
            # "min_time": min_time,
            # "max_time": max_time,
            "global_index": global_index,
            "populations": []
        })
    return tree_dict

def remove_outgroup(newick, outgroup):
    t = Tree(newick, format=1)

    if outgroup not in t.get_leaf_names():
        raise ValueError(f"Outgroup '{outgroup}' not found")

    # Reroot on outgroup
    t.set_outgroup(outgroup)

    # Prune outgroup
    (t & outgroup).delete()

    # Remove root branch
    t.dist = 0.0
    for child in t.get_children():
        child.dist = 0.0

    # Ensure single semicolon
    nwk = t.write(format=1).rstrip(";")
    return nwk + ";"

