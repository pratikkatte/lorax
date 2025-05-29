import treeswift
import utils
import datetime
import orjson
from alive_progress import config_handler, alive_it, alive_bar
import tskit
import numpy as np
from multiprocessing import Pool, cpu_count
from tqdm import tqdm

def process_tree(tree_seq, idx):
 
    tree_data = {}
    tree_data['newick'] = tree_seq.at_index(idx).newick()
    tree_data['interval'] = tree_seq.at_index(idx).interval
    return idx, tree_data 

def process_trees_with_progress(ts, tree_indices):
    """
    """
    genomic_position_minmax = {'min': float('inf'), "max": float('-inf')}
    all_content_positions = {}

    with Pool(processes=cpu_count()) as pool:  # Uses all available CPU cores
        results = {}
        for idx, tree_data in tqdm(pool.starmap(process_tree, [(ts, idx) for idx in tree_indices]), total=len(tree_indices), desc="Processing Trees"):
            results[idx] = tree_data
            interval = tree_data['interval']
            genomic_position_minmax['min'] = min(genomic_position_minmax['min'], interval.left)
            genomic_position_minmax['max'] = max(genomic_position_minmax['max'], interval.right)
            all_content_positions[str(idx)] = {"min": interval.left, "max": interval.right}
    return results, all_content_positions, genomic_position_minmax


def write_jsonl(content, output_file_name= "output.jsonl"):
    output_file = open(output_file_name, 'wb')
    output_file.write(orjson.dumps(content) + b"\n")

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

def extract_mutations(tree, global_mutation):
    mutations = []
    for site in tree.sites():
        for mutation in site.mutations:
            mut = {
                "gene": "nt",
                'mutation_id': mutation.id,
                'new_residue': mutation.derived_state,
                'previous_residue': site.ancestral_state,
                'residue_pos': int(site.position),
                'type': 'nt'
            }
            mutations.append(mutation.id)
            global_mutation.append(mut)
    return mutations, global_mutation  # Return the list of mutations directly

def consolidate_data(ts, results):
    global_mutation = []
    total_tips = 0
    node_indexing = 0
    total_nodes = 0
    remove_after_pipe = False
    node_objects = []
    y_spacing = 0
    for tree_idx, tree_data in results.items():
        print("tree_idx", tree_idx)
        ts_tree = ts.at_index(tree_idx)
        mutations, global_mutation = extract_mutations(ts_tree, global_mutation)
        tree = treeswift.read_tree_newick(tree_data['newick'])
        tree.ladderize(ascending=False)
        for node in tree.traverse_postorder():
            if node.is_leaf():
                node.num_tips = 1
            else:
                node.num_tips = sum(child.num_tips for child in node.children)
        total_tips += tree.root.num_tips
        utils.set_x_coords(tree.root, chronumental_enabled=False)
        y_spacing = utils.set_terminal_y_coords(tree.root, y_spacing)
        y_spacing = y_spacing+500
        utils.set_internal_y_coords(tree.root)
        nodes_sorted_by_y = utils.sort_on_y(tree)
        total_nodes += len(nodes_sorted_by_y)
        node_to_index = {node: i for i, node in enumerate(nodes_sorted_by_y, start = node_indexing)}
        node_indexing += len(node_to_index.keys())
        for node in alive_it(nodes_sorted_by_y,
                             title="Converting each node, and writing out in JSON"):
            node_object = utils.get_node_object(node, node_to_index, {}, {}, [], chronumental_enabled=False, mutations=mutations, tree_idx = tree_idx)
            if remove_after_pipe and 'name' in node_object and node_object['name']:
                node_object['name'] = node_object['name'].split("|")[0]
            node_objects.append(node_object)

    return node_objects, total_nodes, global_mutation, total_tips


def return_data(node_objects, total_nodes, global_mutation, all_content_positions, genomic_position_minmax, total_tips, tree_min_max):
    output_data = []
    new_data = {}
    new_data['node_to_mut'] = {}
    new_data['nodes'] = []

    first_json = get_config(total_tips, all_content_positions, total_nodes, genomic_position_minmax, global_mutation, tree_min_max)
    output_data.append(first_json)
    new_data['header'] = first_json
    for node_object in node_objects:
        new_data['node_to_mut'][str(node_object['node_id'])] = node_object['mutations']
        output_data.append(node_object)
        new_data['nodes'].append(node_object)    
    # Convert the list of dictionaries to a JSON string
    json_output = orjson.dumps(output_data).decode('utf-8')
    return json_output, new_data

# global variables

# the start and end will be user given input. 

def start_end(start, end, ts):
    
    # tree_min_max = {'start': int(ts.at_index(1).interval.left), 'end': int(ts.at_index(ts.num_trees - 1).interval.right)}
    
    sub_ts = ts.keep_intervals([[start, end]], simplify=False)

    nwk_list = []
    positions = []
    
    mutations = []
    times = []
    min_time = float('inf')
    max_time = float('-inf')

    for index, tree in enumerate(sub_ts.trees()):
         intervals = tree.interval
         
         if len(nwk_list)==10:
             break
         if tree.num_roots == 1:
            labels = {
                u: str(u) for u in tree.nodes()
                }
            
            node_times = [sub_ts.node(u).time for u in tree.nodes()]
            start_time = min(node_times)
            end_time = -1 * max(node_times)
            if end_time<min_time:
                min_time = end_time
            if start_time>=max_time:
                max_time = start_time
                
            times.append({'start': start_time, 'end': end_time})

            # newick string
            nwk_list.append(tree.as_newick(node_labels=labels))

            # positions
            positions.append({'start':intervals.left,'end':intervals.right })
            
            # mutations
            temp_mut = {}
            for site in tree.sites():
                for mut in site.mutations:
                    mut_info = str(site.ancestral_state)+str(int(site.position))+str(mut.derived_state)
                    if mut.node not in temp_mut:
                        temp_mut[str(mut.node)] = [mut_info]
                    else:
                        temp_mut[str(mut.node)].append(mut_info)
            mutations.append(temp_mut)


    nwk_string = ''.join(nwk_list)
    print('got nwk string')
    return nwk_string[:-1] if nwk_string else '', positions, mutations, (min_time, max_time,times)
