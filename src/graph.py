import os
import os
from typing import Annotated, List
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
import dspy
from utils import execute_generated_code, routerStruct, generalInfoStruct
from faiss_vector import get_vector_store
from tools import generator_tool
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv

load_dotenv()

turbo = dspy.OpenAI(model='gpt-4o')
dspy.settings.configure(lm=turbo)

vector_store = get_vector_store()
retriever = vector_store.as_retriever(
    search_type="similarity",  # Also test "similarity", "mmr"
    search_kwargs={"k": 5})

code_generator = generator_tool()

# from IPython.display import Image, display

# Max tries
max_iterations = 3

class GraphState(TypedDict):
    """
    """
    error: str
    messages: Annotated[List, add_messages]
    generation: str
    iterations: int
    result: str
    input_files: str
    next: str

def generate(state: GraphState):
    """
    """
    print("-- Generating Code -- ")

    # State
    messages = state["messages"]
    iterations = state['iterations']
    error = state["error"]

    if error != "no":
        question = state['messages'][-1].content + "\n" + error + "\n" + "Now, try again. Invoke the code tool to structure the output with a prefix, imports, and code block:"

        messages = [(
            "user",
            question
        )]
    else:
        question = state['messages'][-1].content

    docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])
    # print("context", context)
    code_solution = code_generator.invoke(
        {"context": context, "messages": messages}
    )
    
    messages = [
        (
            "assistant",
            f"{code_solution.prefix} \n Imports: {code_solution.imports} \n Code: {code_solution.code}",
        )
    ]
    iterations = iterations + 1

    return {"generation": code_solution, 
            "messages": messages, 
            "iterations": iterations,
            }

def execute_code(state: GraphState):

    print("--- checking code ---")
    messages = state['messages']
    iterations = state['iterations']
    code_solution = state['generation']
    input_files = state['input_files']
    generation = state['generation']
    error = state['error']

    try:
        result = execute_generated_code(generation, input_files)
    except Exception as e:
        print("-- code execution failed --")
        error_message = f"The solution failed the code execution test: {e}"
        
        if error_message not in error:
            error += "\n" + error_message
        return {
            "generation": code_solution,
            "messages": messages,
            "iterations": iterations,
            "error": error,
        }

    # no errors
    print(" -- no code failures --")

    # Log the result in messages
    result = f"Result: {result}"

    # Append result to messages (context)
    messages[-1].content += f"\nCode executed successfully. {result}"

    return {
        "generation": code_solution,
        "messages": messages,
        "error": None,
        "iterations": iterations,
        "result" : result
    }


def decide_to_finish(state: GraphState):
    """
    Determines whether to finish.

    Args:
        state (dict): The current graph state

    Returns:
        str: Next node to call
    """
    error = state["error"]
    iterations = state["iterations"]
    max_iterations = 3

    if error == None or iterations == max_iterations:
        print("---DECISION: FINISH---")
        return "end"
    else:
        print("---DECISION: RE-TRY SOLUTION---")
        return "generate"

def router_call(state: GraphState):
    next = state['next']

    if next == 'no':
        return 'general_info'
    else:
        return 'generate'
    
def router(state: GraphState):
    """
    """
    # state
    question = state['messages'][-1].content
    decider = dspy.ChainOfThought(routerStruct)
    pred = decider(question=question)
    answer = pred.answer 
    return {
        "next": answer.lower()
    }

def general_info(state: GraphState):
    """
    """
    question = str(state['messages'])
    decider = dspy.ChainOfThought(generalInfoStruct)

    pred = decider(question=question)
    answer = pred.answer
    messages = state['messages']
    messages = [ (
            "assistant",
            f"{answer}",
        )]
    return {
        "messages": messages,
        "result": answer,
        "error":None
    }

def create_graph():

    workflow = StateGraph(GraphState)

    # Define the nodes
    workflow.add_node("router", router)
    workflow.add_node("generate", generate) # generation solution
    workflow.add_node("execute_code", execute_code)  # execute code
    workflow.add_node("general_info", general_info)

    # Build graph
    workflow.add_edge(START, "router")
    workflow.add_edge("generate", "execute_code")    
    workflow.add_edge("general_info", END)
    
    workflow.add_conditional_edges(
        "execute_code", 
        decide_to_finish,
        {
            "end": END,
            "generate": "generate",
        },
    )
    workflow.add_conditional_edges(
        'router',
        router_call,
        {
            'generate':"generate",
            "general_info":"general_info"
        }
    )

    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    return app