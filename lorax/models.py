from typing import Optional, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
import os

# TODO: use if/else for invokation based on agent type
# Use config file for model and company at startup

class Model:
    """Base class for different types of models.
    
    This class serves as a base class for different model implementations.
    It provides methods to initialize specific models based on company and model name.
    
    The class supports multiple model providers (companies) and their respective models:
    - OpenAI: gpt-4o, gpt-4, gpt-3.5-turbo
    - Ollama: llama2, mistral, codellama
    
    Each model is initialized with appropriate parameters and can be accessed through
    the get_model class method.
    """
    
    # Dictionary mapping supported companies to their available models and corresponding classes
    SUPPORTED_COMPANIES = {
        "openai": {
            "gpt-4o": ChatOpenAI,
            "gpt-4": ChatOpenAI,
            "gpt-3.5-turbo": ChatOpenAI
        },
        "ollama": {
            "llama2": ChatOllama,
            "mistral": ChatOllama,
            "codellama": ChatOllama
        }
    }
    
    def __init__(self, model_name: str, company: str, model_path: Optional[str] = None):
        """Initialize a model instance.
        
        Args:
            model_name: Name of the model (e.g., 'gpt-4o', 'llama2')
            company: Company providing the model (e.g., 'openai', 'ollama')
            model_path: Optional path to model files or configuration
                       Used for local model loading if needed
        """
        self.model_name = model_name
        self.company = company.lower()
        self.model_path = model_path
        self._model = self._initialize_model()
    
    @classmethod
    def get_model(cls, model_name: str, company: str, **kwargs: Any) -> Optional['Model']:
        """Get a model instance by company and model name.
        
        This is the preferred way to create model instances as it handles validation
        and proper initialization of the model.
        
        Args:
            model_name: Name of the model to get
            company: Company providing the model
            **kwargs: Additional arguments to pass to the model constructor
                     (e.g., temperature, max_tokens, etc.)
            
        Returns:
            An instance of the requested model
            
        Raises:
            ValueError: If the company or model is not supported
        """
        company = company.lower()
        if company not in cls.SUPPORTED_COMPANIES:
            raise ValueError(f"Unsupported company: {company}")
        
        if model_name not in cls.SUPPORTED_COMPANIES[company]:
            raise ValueError(f"Unsupported model {model_name} for company {company}")
        
        return cls(model_name=model_name, company=company, **kwargs)
    
    def _initialize_model(self) -> Any:
        """Initialize the specific model based on company and model name.
        
        This method handles the specific initialization requirements for each
        model provider. For example:
        - OpenAI models require model_name parameter
        - Ollama models require model parameter
        
        Returns:
            The initialized model instance
            
        Raises:
            ValueError: If the company or model is not supported
        """
        if self.company not in self.SUPPORTED_COMPANIES:
            raise ValueError(f"Unsupported company: {self.company}")
        
        if self.model_name not in self.SUPPORTED_COMPANIES[self.company]:
            raise ValueError(f"Unsupported model {self.model_name} for company {self.company}")
        
        model_class = self.SUPPORTED_COMPANIES[self.company][self.model_name]
        
        # Initialize with appropriate parameters based on company
        if self.company == "openai":
            return model_class(model_name=self.model_name, temperature=0)
        elif self.company == "ollama":
            return model_class(model=self.model_name, temperature=0)
        
        return None
