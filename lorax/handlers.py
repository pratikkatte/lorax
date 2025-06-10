# handlers.py
import json
from lorax.chat.langgraph_tskit import api_interface
from lorax.viz.trees_to_taxonium import start_end
import tskit

class LoraxHandler:
    def __init__(self):
        self.ts = None  # Set when a file is uploaded

    async def handle_ping(self, message):
        print("Ping received")

    async def handle_chat(self, message):
        print("Chat received")
        llm_output = api_interface(message.get("message"), '../data/sample.trees')
        print("llm_output", llm_output)
        return {"type": "chat", "data": llm_output}

    async def handle_query(self, message):
        if self.ts is None:
            raise ValueError("Tree sequence (ts) is not set. Please upload a file first.")

        start, end = message.get("value")
        nwk_string, genome_positions, mutations, times = start_end(start, end, self.ts)
        data = json.dumps({
            "nwk": nwk_string,
            "genome_positions": genome_positions, 
            "mutations": mutations,
            "global_times": {
                'min_time': times[0],
                'max_time': times[1],
                'times': times[2]
            }
        })
        print("Query received")
        return data

    def get_config(self):
        intervals = [(tree.interval[0], tree.interval[1]) for tree in self.ts.trees()]
        config = {'intervals':intervals[1:]}
        return config
    
    async def handle_upload(self, file_path=None):
        self.ts = tskit.load(file_path)
        viz_config = self.get_config()
        chat_config = "file uploaded"
        return viz_config, chat_config

    async def handle_viz(self, message):
        print("Viz received")
        if message.get("action") == 'query_trees':
            print("query_trees", message)
        return {
            "type": "viz",
            "data": "Your message was received! --> " + message.get("message", "")
        }
