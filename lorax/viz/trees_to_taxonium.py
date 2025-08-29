import datetime

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

def start_end(start, end, ts):
    sub_ts = ts.keep_intervals([[start, end]], simplify=False)
    
    nwk_list = []
    positions = []
    tree_index = []
    mutations = []
    times = []

    min_time = float('inf')
    max_time = float('-inf')

    for tree in sub_ts.trees():
        if (tree.interval.left == 0.0 and start!= 0) or (tree.interval.right==ts.sequence_length and end!= int(ts.sequence_length)):
            continue

        # if len(nwk_list) >= 10:
        #     break
        # Cache node times for this tree
        node_ids = list(tree.nodes())
        node_times = [sub_ts.node(u).time for u in node_ids]

        start_time = min(node_times)
        end_time = -1 * max(node_times)

        min_time = min(min_time, end_time)
        max_time = max(max_time, start_time)

        times.append({'start': start_time, 'end': end_time})

        # Newick
        labels = {u: str(u) for u in node_ids}
        if tree.num_roots != 1:
            tree_newick = "".join([tree.as_newick(root=root, node_labels=labels) for root in tree.roots])
        else:
            tree_newick = tree.as_newick(node_labels=labels)
        
        nwk_list.append(tree_newick)

        # Tree index
        tree_index.append(ts.at(tree.interval.left).index)

        # Positions
        positions.append({'start': tree.interval.left, 'end': tree.interval.right})

        # Mutations
        mut_map = {}
        for site in tree.sites():
            ancestral = site.ancestral_state
            pos = int(site.position)
            for mut in site.mutations:
                mut_str = f"{ancestral}{pos}{mut.derived_state}"
                key = str(mut.node)
                mut_map.setdefault(key, []).append(mut_str)

        mutations.append(mut_map)

    return nwk_list, positions, mutations, (round(min_time, 2), round(max_time, 2), times), tree_index
