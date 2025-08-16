from lorax.chat.react_from_scratch.src.tools.tavily import search as tavily_search
from lorax.chat.react_from_scratch.src.tools.arxiv import search as arxiv_search
from lorax.chat.react_from_scratch.src.tools.tskit import search as tskit_search
from lorax.chat.react_from_scratch.src.utils.io import write_to_file
from lorax.chat.react_from_scratch.src.llm.llm import generate
from lorax.chat.react_from_scratch.src.utils.io import read_file
from pydantic import BaseModel
from typing import Callable
from pydantic import Field 
from typing import Union
from typing import List 
from typing import Dict 
from enum import Enum
from enum import auto
import json
from langchain_community.chat_models import ChatOllama
from langchain_community.chat_models import ChatOpenAI
import os

openai = ChatOpenAI(model="gpt-4o", temperature=0)

# ollama = ChatOllama(base_url="https://nn6yywhy2oizpq-11434.proxy.runpod.net/", model="llama4")
# ollama = ChatOllama(model="llama3.2", temperature=0)

Observation = Union[str, Exception]

# PROMPT_TEMPLATE_PATH = "../../data/input/react.txt"
PROMPT_TEMPLATE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../data/input/react.txt")
)

class Name(Enum):
    """
    Enumeration for tool names available to the agent.
    """
    TSKIT = auto()
    # TAVILY = auto()
    ARXIV = auto()
    NONE = auto()

    def __str__(self) -> str:
        """
        String representation of the tool name.
        """
        return self.name.lower()

class Choice(BaseModel):
    """
    Represents a choice of tool with a reason for selection.
    """
    name: Name = Field(..., description="The name of the tool chosen.")
    reason: str = Field(..., description="The reason for choosing this tool.")

class Message(BaseModel):
    """
    Represents a message with sender role and content.
    """
    role: str = Field(..., description="The role of the message sender.")
    content: str = Field(..., description="The content of the message.")


class Tool:
    """
    A wrapper class for tools used by the agent, executing a function based on tool type.
    """

    def __init__(self, name: Name, func: Callable[[str], str]):
        """
        Initializes a Tool with a name and an associated function.
        
        Args:
            name (Name): The name of the tool.
            func (Callable[[str], str]): The function associated with the tool.
        """
        self.name = name
        self.func = func

    def use(self, query: str) -> Observation:
        """
        Executes the tool's function with the provided query.

        Args:
            query (str): The input query for the tool.

        Returns:
            Observation: Result of the tool's function or an error message if an exception occurs.
        """
        try:
            return self.func(query)
        except Exception as e:
            # logger.error(f"Error executing tool {self.name}: {e}")
            return str(e)


class Agent:
    """
    Defines the agent responsible for executing queries and handling tool interactions.
    """

    def __init__(self, model) -> None:
        """
        Initializes the Agent with a generative model, tools dictionary, and a messages log.

        Args:
            model: The generative model used by the agent.
        """
        self.model = model
        self.tools: Dict[Name, Tool] = {}
        self.messages: List[Message] = []
        self.query = ""
        self.max_iterations = 5
        self.current_iteration = 0
        self.template = self.load_template()

    def load_template(self) -> str:
        """
        Loads the prompt template from a file.

        Returns:
            str: The content of the prompt template file.
        """
        return read_file(PROMPT_TEMPLATE_PATH)

    def register(self, name: Name, func: Callable[[str], str]) -> None:
        """
        Registers a tool to the agent.

        Args:
            name (Name): The name of the tool.
            func (Callable[[str], str]): The function associated with the tool.
        """
        self.tools[name] = Tool(name, func)

    def trace(self, role: str, content: str) -> None:
        """
        Logs the message with the specified role and content

        Args:
            role (str): The role of the message sender.
            content (str): The content of the message.
        """
        if role != "system":
            self.messages.append(Message(role=role, content=content))

    def get_history(self) -> str:
        """
        Retrieves the conversation history.

        Returns:
            str: Formatted history of messages.
        """
        return "\n".join([f"{message.role}: {message.content}" for message in self.messages])

    def think(self) -> None:
        """
        Processes the current query, decides actions, and iterates until a solution or max iteration limit is reached.
        """
        self.current_iteration += 1
        # logger.info(f"Starting iteration {self.current_iteration}")

        if self.current_iteration > self.max_iterations:
            # logger.warning("Reached maximum iterations. Stopping.")
            self.trace("assistant", "I'm sorry, but I couldn't find a satisfactory answer within the allowed number of iterations. Here's what I know so far: " + self.get_history())
            return
        
        prompt = self.template.format(
            query=self.query, 
            history=self.get_history(),
            tools=', '.join([str(tool.name) for tool in self.tools.values()])
        )

        response = self.ask_llm(prompt)
        # logger.info(f"Thinking => {response}")
        self.trace("assistant", f"Thought: {response}")
        self.decide(response)

    def decide(self, response: str) -> None:
        """
        Processes the agent's response, deciding actions or final answers.

        Args:
            response (str): The response generated by the model.
        """
        try:
            cleaned_response = response.strip().strip('`').strip()
            
            if cleaned_response.startswith('json'):
                cleaned_response = cleaned_response[4:].strip()
            
            parsed_response = json.loads(cleaned_response)
            
            if "action" in parsed_response:
                action = parsed_response["action"]
                tool_name = Name[action["name"].upper()]
                if tool_name == Name.NONE:
                    # logger.info("No action needed. Proceeding to final answer.")
                    self.think()
                else:
                    self.trace("assistant", f"Action: Using {tool_name} tool")
                    self.act(tool_name, action.get("input", self.query))
            elif "answer" in parsed_response:
                self.trace("assistant", f"{parsed_response['answer']}")
            else:
                raise ValueError("Invalid response format")
        except json.JSONDecodeError as e:
            # logger.error(f"Failed to parse response: {response}. Error: {str(e)}")
            self.trace("assistant", "I encountered an error in processing. Let me try again.")
            self.think()
        except Exception as e:
            # logger.error(f"Error processing response: {str(e)}")
            self.trace("assistant", "I encountered an unexpected error. Let me try a different approach.")
            self.think()

    def act(self, tool_name: Name, query: str) -> None:
        """
        Executes the specified tool's function on the query and logs the result.

        Args:
            tool_name (Name): The tool to be used.
            query (str): The query for the tool.
        """
        tool = self.tools.get(tool_name)
        if tool:
            result = tool.use(query)
            observation = f"Observation from {tool_name}: {result}"
            self.trace("system", observation)
            self.messages.append(Message(role="system", content=observation))  # Add observation to message history
            self.think()
        else:
            # logger.error(f"No tool registered for choice: {tool_name}")
            self.trace("system", f"Error: Tool {tool_name} not found")
            self.think()

    def execute(self, query: str, context) -> str:
        """
        Executes the agent's query-processing workflow.

        Args:
            query (str): The query to be processed.

        Returns:
            str: The final answer or last recorded message content.
        """
        self.query = query
        self.trace(role="context", content=str(context))
        self.trace(role="user", content=query)
        self.think()
        return self.messages[-1].content

    def ask_llm(self, prompt: str) -> str:
        """
        Queries the generative model with a prompt.

        Args:
            prompt (str): The prompt text for the model.

        Returns:
            str: The model's response as a string.
        """
        contents = prompt
        response = generate(self.model, contents)
        return response.content if hasattr(response, "content") else str(response)

def run(query, context) -> str:
    """
    Sets up the agent, registers tools, and executes a query.

    Args:
        query (str): The query to execute.

    Returns:
        str: The agent's final answer.
    """

    agent = Agent(model=openai)
    agent.register(Name.TSKIT, tskit_search)
    # agent.register(Name.TAVILY, tavily_search)
    agent.register(Name.ARXIV, arxiv_search)

    answer = agent.execute(query, context)
    return answer


if __name__ == "__main__":
    query = "What are some use cases of tskit?"
    # query = "hello" 
    final_answer = run(query)
    # logger.info(final_answer)
    print("Final Answer:", final_answer)
    