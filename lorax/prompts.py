from typing import Optional, Dict, Any, List, Union
import os
import json

class Prompt:
    """Base class for different types of prompts.
    
    This class serves as a base class for different prompt implementations.
    It provides methods to get prompts from text files based on agent type.
    
    The class supports multiple agent types:
    - code_generation: For generating code based on user queries
    - visualization: For creating visualizations
    - planner: For planning and orchestrating tasks
    
    Each agent type has its own prompt file (either .txt or .json) that contains
    the specific instructions and context for that agent.
    """
    
    # Dictionary mapping supported agent types to their prompt file paths
    SUPPORTED_AGENTS = {
        "code_generation": "prompts/code_generation.json",
        "visualization": "prompts/visualization.txt",
        "planner": "prompts/planner.json"  
    }
    
    def __init__(self, agent_type: str, prompt_path: Optional[str] = None):
        """Initialize a prompt instance.
        
        Args:
            agent_type: Type of agent (e.g., 'planner', 'code_generation')
            prompt_path: Optional custom path to prompt file (overrides default)
                       Useful for testing or custom prompt configurations
        """
        self.agent_type = agent_type.lower()
        self.prompt_path = prompt_path or self._get_default_prompt_path()
        self._prompt_text = self._initialize_prompt()
    
    @classmethod
    def get_prompt(cls, agent_type: str, **kwargs: Any) -> Optional['Prompt']:
        """Get a prompt instance by agent type.
        
        This is the preferred way to create prompt instances as it handles validation
        and proper initialization of the prompt.
        
        Args:
            agent_type: Type of agent to get prompt for
            **kwargs: Additional arguments to pass to the prompt constructor
                     (e.g., custom prompt_path)
            
        Returns:
            An instance of the requested prompt
            
        Raises:
            ValueError: If the agent type is not supported
        """
        agent_type = agent_type.lower()
        
        if agent_type not in cls.SUPPORTED_AGENTS:
            raise ValueError(f"Unsupported agent type: {agent_type}")
        
        return cls(agent_type=agent_type, **kwargs)
    
    def _get_default_prompt_path(self) -> str:
        """Get the default path for the agent's prompt file.
        
        Returns:
            The path to the prompt file
            
        Raises:
            ValueError: If the agent type is not supported
        """
        if self.agent_type not in self.SUPPORTED_AGENTS:
            raise ValueError(f"Unsupported agent type: {self.agent_type}")
        
        return self.SUPPORTED_AGENTS[self.agent_type]
    
    def _initialize_prompt(self) -> Union[str, List[Dict[str, str]]]:
        """Initialize the prompt text from the prompt file.
        
        This method handles both simple text prompts (.txt) and structured
        JSON prompts (.json). JSON prompts are typically used for more complex
        prompt structures that require multiple messages or specific formatting.
        
        Returns:
            Either a string for simple prompts or a list of message dictionaries
            for structured prompts
            
        Raises:
            FileNotFoundError: If the prompt file doesn't exist
            IOError: If there's an error reading the file
        """
        if not os.path.exists(self.prompt_path):
            raise FileNotFoundError(f"Prompt file not found at {self.prompt_path}")
        
        try:
            if self.prompt_path.endswith('.json'):
                with open(self.prompt_path, 'r') as f:
                    return json.load(f)
            else:
                with open(self.prompt_path, 'r') as f:
                    return f.read()
        except IOError as e:
            raise IOError(f"Error reading prompt file: {e}")
    
    def get_prompt_text(self) -> Union[str, List[Dict[str, str]]]:
        """Get the prompt text.
        
        Returns:
            Either a string for simple prompts or a list of message dictionaries
            for structured prompts
        """
        return self._prompt_text
    
