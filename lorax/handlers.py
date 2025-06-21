# handlers.py
import json
from lorax.chat.langgraph_tskit import api_interface
from lorax.viz.trees_to_taxonium import start_end
import tskit
import numpy as np

class LoraxHandler:
    def __init__(self):
        self.ts = None  # Set when a file is uploaded

    async def handle_ping(self, message):
        return {"type": "ping", "data": "Pong"}

    async def handle_chat(self, message):
        print("Chat received")
        llm_output = api_interface(message.get("message"), '../data/sample.trees')
        print("llm_output", llm_output)
        return {"type": "chat", "data": llm_output}

    async def handle_query(self, message):
        if self.ts is None:
            raise ValueError("Tree sequence (ts) is not set. Please upload a file first.")

        start, end = message.get("value")

        nwk_string, genome_positions, mutations, times, tree_index = start_end(start, end, self.ts)
        data = json.dumps({
            "nwk": nwk_string,
            "genome_positions": genome_positions, 
            "mutations": mutations,
            "global_times": {
                'min_time': times[0],
                'max_time': times[1],
                'times': times[2]
            },
            "tree_index": tree_index
        })
        return data

    def get_config(self):
        intervals = [(tree.interval[0], tree.interval[1]) for tree in self.ts.trees()]
        config = {'intervals':intervals[1:], 'value': [intervals[1][0], intervals[9][1]]}
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
            "metadata": individual.metadata
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
        self.ts = tskit.load(file_path)
        viz_config = self.get_config()
        chat_config = "file uploaded"
        return viz_config, chat_config

    async def handle_details(self, message):
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
        return return_data

    async def handle_viz(self, message):
        print("Viz received")
        if message.get("action") == 'query_trees':
            print("query_trees", message)
        return {
            "type": "viz",
            "data": "Your message was received! --> " + message.get("message", "")
        }
