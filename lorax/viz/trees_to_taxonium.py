import datetime
import numpy as np
from concurrent.futures import ProcessPoolExecutor, as_completed



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

def _process_single_tree(global_index, ts):
    try:
        tree = ts.at_index(global_index)
        node_ids = list(tree.nodes())

        node_times = np.fromiter((ts.node(u).time for u in node_ids), dtype=np.float64)
        start_time = node_times.min()
        end_time = -node_times.max()

        # ✅ Labels only if needed
        labels = {u: str(u) for u in node_ids}
        if tree.num_roots > 1:
            tree_newick = "".join(tree.as_newick(root=root, node_labels=labels) for root in tree.roots)
        else:
            tree_newick = tree.as_newick(node_labels=labels)

        positions = {"start": int(tree.interval.left), "end": int(tree.interval.right)}

        # ✅ Mutations
        mut_map = {}
        for site in tree.sites():
            pos = int(site.position)
            ancestral = site.ancestral_state
            for mut in site.mutations:
                mut_map.setdefault(str(mut.node), []).append(
                    f"{ancestral}{pos}{mut.derived_state}"
                )

        return {
            "newick": tree_newick,
            "time_range": {"start": float(start_time), "end": float(end_time)},
            "positions": positions,
            "mutations": mut_map,
        }

    except Exception as e:
        return {"error": str(e), "index": global_index}


def new_tree_samples(tree_indexes, ts, n_jobs=4):
    tree_dict = []

    with ProcessPoolExecutor(max_workers=n_jobs) as executor:
        futures = [executor.submit(_process_single_tree, t["global_index"], ts)
                   for t in tree_indexes]

        for future in as_completed(futures):
            result = future.result()
            if "error" in result:
                print(f"Error in new_tree_samples: {result['error']} (index {result['index']})")
                continue

            # add shared info from ts
            result["min_time"] = ts.min_time
            result["max_time"] = -ts.max_time
            tree_dict.append(result)

    return tree_dict

# def old_new_tree_samples(tree_indexes, ts):

#     tree_dict = []
#     min_time = float('inf')
#     max_time = float('-inf')
    
#     # ✅ Create populations once, not for every tree (they're the same for all trees)
#     populations = [{"id": int(ts.node(n).id), "population": ts.node(n).population} for n in ts.samples()]

#     for i, treee in enumerate(tree_indexes):
#         try:
#             global_index = treee['global_index']
#             print("global_index", global_index)
#             global_index = int(global_index)
#             tree = ts.at_index(global_index)
#             node_ids = list(tree.nodes())
#             node_times = [ts.node(u).time for u in node_ids]
#             start_time = min(node_times)
#             end_time = -1 * max(node_times)
#             time_range = {'start': start_time, 'end': end_time}
#             tree_newick = ''
#             labels = {u: str(u) for u in node_ids}
#             if tree.num_roots != 1:
#                 tree_newick = "".join([tree.as_newick(root=root, node_labels=labels) for root in tree.roots])
#             else:
#                 tree_newick = tree.as_newick(node_labels=labels)
            
#             tree_index = ts.at(tree.interval.left).index
#             positions = {'start': tree.interval.left, 'end': tree.interval.right}

#             # Mutations
#             mut_map = {}
#             for site in tree.sites():
#                 ancestral = site.ancestral_state
#                 pos = int(site.position)
#                 for mut in site.mutations:
#                     mut_str = f"{ancestral}{pos}{mut.derived_state}"
#                     key = str(mut.node)
#                     mut_map.setdefault(key, []).append(mut_str)

#             tree_dict.append({
#                 'newick': tree_newick,
#                 'time_range': time_range,
#                 'positions': positions,
#                 'mutations': mut_map,
#                 'min_time': ts.min_time,
#                 'max_time': -ts.max_time,
#                 'global_index': global_index,
#                 'populations': populations 
#             })
#         except Exception as e:
#             print(f"Error in new_tree_samples: {e}")
#             continue
    
#     return tree_dict
import time

def process_csv(df, tree_indexes, window_size=50000, is_time=False):
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

        genomic_positions = int(specific_row['genomic_positions'].values[0])
        time_range = {
            "start": 0.0 if is_time else None,
            "end": -6.0 if is_time else None
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
            "min_time": min_time,
            "max_time": max_time,
            "global_index": global_index,
            "populations": []
        })
    return tree_dict

def old_new_tree_samples(tree_indexes, ts):

    start_timer = time.time()
    tree_dict = []

    # Precompute populations (same across trees)
    populations = [
        {"id": int(n.id), "population": n.population}
        for n in map(ts.node, ts.samples())
    ]

    # Pre-bind functions for speed (avoids repeated attribute lookups)
    ts_node = ts.node
    ts_at_index = ts.at_index

    min_time, max_time = ts.min_time, -ts.max_time

    for t in tree_indexes:
        try:
            global_index = int(t["global_index"])
            tree = ts_at_index(global_index)
            node_ids = list(tree.nodes())

            # Vectorized node time retrieval
            node_times = [ts_node(u).time for u in node_ids]
            start_time, end_time = min(node_times), -max(node_times)

            labels = {u: str(u) for u in node_ids}
            if tree.num_roots == 1:
                tree_newick = tree.as_newick(node_labels=labels)
            else:
                # Join once, avoids string concat overhead
                tree_newick = "".join(
                    tree.as_newick(root=root, node_labels=labels)
                    for root in tree.roots
                )

            interval = tree.interval
            positions = {"start": interval.left, "end": interval.right}

            # Build mutation map efficiently
            mut_map = {}
            for site in tree.sites():
                ancestral = site.ancestral_state
                pos = int(site.position)
                for mut in site.mutations:
                    mut_str = f"{ancestral}{pos}{mut.derived_state}"
                    mut_map.setdefault(str(mut.node), []).append(mut_str)

            tree_dict.append({
                "newick": tree_newick,
                "time_range": {"start": start_time, "end": end_time},
                "positions": positions,
                "mutations": mut_map,
                "min_time": min_time,
                "max_time": max_time,
                "global_index": global_index,
                "populations": populations
            })

        except Exception as e:
            print(f"[WARN] Error at tree index {t}: {e}")
            continue

    end_timer = time.time()
    print(f"Time taken: {end_timer - start_timer} seconds")
    return tree_dict
