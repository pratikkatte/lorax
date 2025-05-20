import time
from typing import Any, Dict, List, Optional
from langchain_core.callbacks.base import BaseCallbackHandler

class TrackingCallback(BaseCallbackHandler):
    def __init__(self):
        self.timings = {}
        self.tokens = {}
        self.raise_error = True

    def on_node_start(self, node_name: str, state: Dict[str, Any], run_id: str, **kwargs) -> None:
        """Called when a node starts execution."""
        self.timings[node_name] = time.time()
        print(f"[{node_name}] Starting execution")

    def on_node_end(self, node_name: str, state: Dict[str, Any], result: Any, run_id: str, **kwargs) -> None:
        """Called when a node ends execution."""
        start = self.timings.get(node_name, None)
        if start:
            duration = time.time() - start
            print(f"[{node_name}] Execution time: {duration:.2f} seconds")
        
        # Extract token usage if available
        if hasattr(result, "usage"):
            usage = result.usage
            print(f"[{node_name}] Token usage: {usage}")
        elif isinstance(result, dict) and "usage" in result:
            usage = result["usage"]
            print(f"[{node_name}] Token usage: {usage}")

    def on_chain_start(self, serialized: Optional[Dict[str, Any]] = None, inputs: Optional[Dict[str, Any]] = None, **kwargs) -> None:
        """Called when a chain starts execution."""
        chain_name = "unknown_chain"
        if serialized and isinstance(serialized, dict):
            chain_name = serialized.get("name", "unknown_chain")
        self.timings[chain_name] = time.time()
        print(f"[{chain_name}] Starting chain execution")

    def on_chain_end(self, serialized: Optional[Dict[str, Any]] = None, inputs: Optional[Dict[str, Any]] = None, 
                    outputs: Optional[Dict[str, Any]] = None, **kwargs) -> None:
        """Called when a chain ends execution."""
        chain_name = "unknown_chain"
        if serialized and isinstance(serialized, dict):
            chain_name = serialized.get("name", "unknown_chain")
        
        start = self.timings.get(chain_name, None)
        if start:
            duration = time.time() - start
            print(f"[{chain_name}] Chain execution time: {duration:.2f} seconds")
            if outputs and isinstance(outputs, dict) and "usage" in outputs:
                print(f"[{chain_name}] Token usage: {outputs['usage']}")

    def on_llm_start(self, serialized: Optional[Dict[str, Any]] = None, prompts: Optional[List[str]] = None, **kwargs) -> None:
        """Called when an LLM starts execution."""
        llm_name = "unknown_llm"
        if serialized and isinstance(serialized, dict):
            llm_name = serialized.get("name", "unknown_llm")
        self.timings[llm_name] = time.time()
        print(f"[{llm_name}] Starting LLM execution")

    def on_llm_end(self, serialized: Optional[Dict[str, Any]] = None, prompts: Optional[List[str]] = None, 
                  response: Optional[Any] = None, **kwargs) -> None:
        """Called when an LLM ends execution."""
        llm_name = "unknown_llm"
        if serialized and isinstance(serialized, dict):
            llm_name = serialized.get("name", "unknown_llm")
        
        start = self.timings.get(llm_name, None)
        if start:
            duration = time.time() - start
            print(f"[{llm_name}] LLM execution time: {duration:.2f} seconds")
            if response and hasattr(response, "usage"):
                print(f"[{llm_name}] Token usage: {response.usage}")

    def on_error(self, error: Exception, state: Dict[str, Any], run_id: str, **kwargs) -> None:
        """Called when an error occurs."""
        print(f"Error occurred: {str(error)}")
        if self.raise_error:
            raise error

# Optionally, add more hooks as needed