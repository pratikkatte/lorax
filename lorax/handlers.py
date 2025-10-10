# handlers.py
import json
# from lorax.chat.langgraph_tskit import api_interface
from lorax.viz.trees_to_taxonium import new_tree_samples,old_new_tree_samples
import tskit
import tszip
import numpy as np
import os

class LoraxHandler:
    def __init__(self):
        self.ts = None  # Set when a file is uploaded
        self.file_path = None
        self.viz_snapshot = None
        self.ts_intervals = None
        self.global_context = {'file_path': self.file_path, 'viz_snapshot': self.viz_snapshot, 'memory': None}

    async def handle_ping(self, message):
        return {"type": "ping", "data": "Pong"}

    # def handle_chat(self, message):
    #     try:
    #         action = None
    #         llm_output = api_interface(message.get("message"), self.file_path)
            
    #         # Handle different types of llm_output
    #         if isinstance(llm_output, str):
    #             # If it's already a string, use it directly
    #             response_data = llm_output
    #         elif isinstance(llm_output, (list, tuple)) and len(llm_output) > 0:
    #             # If it's a list/tuple, take the first element
    #             response_data = str(llm_output[0]) if llm_output[0] else str(llm_output)
    #             action = llm_output[1]
    #         else:
    #             # Otherwise, convert to string
    #             response_data = str(llm_output)
                
    #         data = {"type": "chat", "data": response_data, "action": action}
    #         return data
    #     except Exception as e:
    #         print(f"Error in handle_chat: {e}")
    #         return {"type": "chat", "data": f"Error processing chat message: {str(e)}"}

    async def handle_query(self, message):
        if self.ts is None:
            return json.dumps({"error": "Tree sequence (ts) is not set. Please upload a file first."})

        try:
            localTrees = message.get("localTrees")
            # nwk_string, genome_positions, mutations, times, tree_index = start_end(start, end, self.ts)
            tree_dict = old_new_tree_samples(localTrees, self.ts)

            # self.viz_snapshot = {'window': [0, start, end, self.ts.sequence_length], 'sample_sets':'ts.get_samples()'}

            # self.global_context['viz_snapshot'] = self.viz_snapshot
            data = json.dumps({
                "tree_dict": tree_dict
            })
            return data
        except Exception as e:
            print("Error in handle_query", e)
            return json.dumps({"error": f"Error processing query: {str(e)}"})

    def get_config(self):
        # intervals = [(tree.interval[0], tree.interval[1]) for tree in self.ts.trees()]
        # intervals = {tree.interval[0]: [tree.interval[0], tree.interval[1]] for tree in self.ts.trees()}
        new_intervals = {int(tree.interval[0]): [int(tree.interval[0]), int(tree.interval[1])] for tree in self.ts.trees()}
        self.ts_intervals = new_intervals
        times = [self.ts.min_time, self.ts.max_time]
        populations = {}
        # for s in self.ts.populations(): populations[str(s.id)] = str(json.loads(s.metadata)['name'])
        for s in self.ts.populations():
            meta = json.loads(s.metadata)
            populations[str(s.id)] = {
                "population": meta.get("name"),
                "description": meta.get("description"),
                "super_population": meta.get("super_population")
                }
        nodes_population = [n.population for n in self.ts.nodes()]

        config = {'genome_length': self.ts.sequence_length, 'times':times, 'new_intervals':new_intervals,'filename': str(self.file_path).split('/')[-1], 'populations':populations, 'nodes_population':nodes_population}
        return config
    
    def get_tree_details(self, tree_index):
        tree = self.ts.at_index(tree_index)
        data = {
            "interval": tree.interval,
            "num_roots": tree.num_roots,
            "num_nodes": tree.num_nodes
        }
        return data
    
    def get_node_details(self, node_name):
        node = self.ts.node(node_name)
        data = {
            "id": node.id,
            "time": node.time,
            "population": node.population,
            "individual": node.individual,
            "metadata": self.make_json_serializable(node.metadata)
        }
        return data
    
    def get_individual_details(self, individual_id):
        individual = self.ts.individual(individual_id)
        data = { 
            "id": individual.id,
            "nodes": self.make_json_serializable(individual.nodes),
            "metadata": self.make_json_serializable(individual.metadata)
        }
        return data
    
    def make_json_serializable(self, obj):
        """Convert byte data and other non-serializable objects to JSON serializable format"""
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        elif isinstance(obj, dict):
            return {k: self.make_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.make_json_serializable(item) for item in obj]
        elif hasattr(obj, '__dict__'):
            return self.make_json_serializable(obj.__dict__)    
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return obj
    
    async def handle_upload(self, file_path=None):
        if self.file_path != file_path:    
            basefilename = os.path.basename(file_path)
            if basefilename.endswith('.tsz'):
                self.ts = tszip.load(file_path)
                self.file_path = file_path
                self.global_context = self.file_path
            else:
                self.ts = tskit.load(file_path)
                self.file_path = file_path
                self.global_context = self.file_path
            
        viz_config = self.get_config()
        chat_config = "file uploaded"
        return viz_config, chat_config

    async def get_projects(self, upload_dir):
        with open(f'{upload_dir}/projects.json', 'r') as f:
            projects = json.load(f)
        return projects
    
    async def handle_details(self, message):
        try:
            return_data = {}
            object = message.get("object")
            tree_index = object.get("treeIndex")

            if tree_index:
                tree_details = self.get_tree_details(tree_index)
                return_data["tree"] = tree_details
            
            node_name = object.get("node")
            if node_name:
                node_details = self.get_node_details(int(node_name))
                return_data["node"] = node_details
                if node_details.get("individual") != -1:
                    individual_details = self.get_individual_details(node_details.get("individual"))
                    return_data["individual"] = individual_details
            return json.dumps(return_data)
        except Exception as e:
            return {"error": f"Error getting details: {str(e)}"}

    async def handle_viz(self, message):
        print("Viz received")
        if message.get("action") == 'query_trees':
            print("query_trees", message)
        return {
            "type": "viz",
            "data": "Your message was received! --> " + message.get("message", "")
        }
