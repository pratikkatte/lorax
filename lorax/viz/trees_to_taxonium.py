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

def new_tree_samples(tree_indexes, ts):

    tree_dict = []
    min_time = float('inf')
    max_time = float('-inf')


    for i, tree in enumerate(tree_indexes):
        try:
            tree = ts.at_index(tree['global_index'])
            node_ids = list(tree.nodes())
            node_times = [ts.node(u).time for u in node_ids]
            start_time = min(node_times)
            end_time = -1 * max(node_times)
            time_range = {'start': start_time, 'end': end_time}
            tree_newick = ''
            labels = {u: str(u) for u in node_ids}
            if tree.num_roots != 1:
                tree_newick = "".join([tree.as_newick(root=root, node_labels=labels) for root in tree.roots])
            else:
                tree_newick = tree.as_newick(node_labels=labels)
            
            tree_index = ts.at(tree.interval.left).index
            positions = {'start': tree.interval.left, 'end': tree.interval.right}

            # Mutations
            mut_map = {}
            for site in tree.sites():
                ancestral = site.ancestral_state
                pos = int(site.position)
                for mut in site.mutations:
                    mut_str = f"{ancestral}{pos}{mut.derived_state}"
                    key = str(mut.node)
                    mut_map.setdefault(key, []).append(mut_str)

            tree_dict.append({
                'newick': tree_newick,
                'time_range': time_range,
                'positions': positions,
                'mutations': mut_map,
                'min_time': ts.min_time,
                'max_time': -ts.max_time
            })
        except Exception as e:
            print(f"Error in new_tree_samples: {e}")
            continue
    
    return tree_dict