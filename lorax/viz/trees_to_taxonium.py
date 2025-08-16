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

# def start_end(start, end, ts):
    
#     # tree_min_max = {'start': int(ts.at_index(1).interval.left), 'end': int(ts.at_index(ts.num_trees - 1).interval.right)}
    
#     sub_ts = ts.keep_intervals([[start, end]], simplify=False)
#     nwk_list = []
#     positions = []
#     tree_index = []
    
#     mutations = []
#     times = []
#     min_time = float('inf')
#     max_time = float('-inf')

#     for index, tree in enumerate(sub_ts.trees()):
#          intervals = tree.interval
         
#          if len(nwk_list)==10:
#              break
#          if tree.num_roots>1:
#             print("tree has multiple roots")

#          if tree.num_roots == 1:
#             labels = {
#                 u: str(u) for u in tree.nodes()
#                 }

#             node_times = [sub_ts.node(u).time for u in tree.nodes()]
#             start_time = min(node_times)
#             end_time = -1 * max(node_times)
#             if end_time<min_time:
#                 min_time = end_time
#             if start_time>=max_time:
#                 max_time = start_time
#             times.append({'start': start_time, 'end': end_time})

#             # newick string
#             nwk_list.append(tree.as_newick(node_labels=labels))
#             # tree index
#             tree_index.append(ts.at(tree.interval.left).index)

#             # positions        
#             positions.append({'start':intervals.left,'end':intervals.right })
            
#             # mutations
#             temp_mut = {}
#             for site in tree.sites():
#                 for mut in site.mutations:
#                     mut_info = str(site.ancestral_state)+str(int(site.position))+str(mut.derived_state)
#                     if mut.node not in temp_mut:
#                         temp_mut[str(mut.node)] = [mut_info]
#                     else:
#                         temp_mut[str(mut.node)].append(mut_info)
#             mutations.append(temp_mut)
#     # nwk_string = ''.join(nwk_list)
#     # return nwk_string[:-1] if nwk_string else '', positions, mutations, (min_time, max_time,times), tree_index
#     return nwk_list, positions, mutations, (min_time, max_time,times), tree_index


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
