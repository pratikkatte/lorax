from typing import List, TypedDict, Any
from langgraph.graph import END, StateGraph, START
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.message import add_messages
from typing import TypedDict, List,Dict, Optional, Annotated
from types import ModuleType
import sys
import ast
import inspect
from utils import execute_generated_code


from faiss_vector import get_vector_store, repo_to_text
from tools import generator_tool

vector_store = get_vector_store()
retriever = vector_store.as_retriever(
    search_type="similarity",  # Also test "similarity", "mmr"
    search_kwargs={"k": 5})

code_generator = generator_tool()

# from IPython.display import Image, display

# Max tries
max_iterations = 3
# Reflect
# flag = 'reflect'
flag = "do not reflect"

class GraphState(TypedDict):
    """
    """
    error: str
    messages: Annotated[list, add_messages]
    generation: str
    iterations: int
    result: str
    input_files: str
    flag: str
    

def generate(state: GraphState):
    """
    """
    print("-- Generating Code -- ")

    # State
    messages = state["messages"]
    iterations = state['iterations']
    error = state["error"]


    if error == "yes":
        messages = [
            (
                "user",
                "Now, try again. Invoke the code tool to structure the output with a prefix, imports, and code block:",
            )
        ]

    # Solution
    question = messages[-1].content
    docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])
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
            "result": "no",
            }
    # return "new code genration"

def execute_code(state: GraphState):

    print("--- checking code ---")
    messages = state['messages']
    iterations = state['iterations']
    code_solution = state['generation']
    code = code_solution.code
    imports = code_solution.imports
    # code_generator = state['code_generator']
    # retriever = state['retriever']
    input_files = state['input_files']
    generation = state['generation']
    error = state['error']

    # check code
    try:
        result = execute_generated_code(generation, input_files)
    except Exception as e:
        print("-- code execution failed --")
        error_message = f"Your solution failed the code execution test: {e}"

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
    result = f"{result}"

    return {
        "generation": code_solution,
        "messages": messages,
        "error": "no",
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
    flag = state.get("flag", "generate")
    max_iterations = 3

    if error == "no" or iterations == max_iterations:
        print("---DECISION: FINISH---")
        return "end"
    else:
        print("---DECISION: RE-TRY SOLUTION---")
        if flag == "reflect":
            return "reflect"
        else:
            return "generate"
        
def display_graph(input_graph):
    #display(Image(input_graph.get_graph().draw_mermaid_png()))
    pass


def create_graph():

    workflow = StateGraph(GraphState)

    # Define the nodes
    workflow.add_node("generate", generate) # generation solution
    workflow.add_node("execute_code", execute_code)  # execute code
    # workflow.add_node("reflect", reflect)  # reflect

    # Build graph
    workflow.add_edge(START, "generate")
    workflow.add_edge("generate", "execute_code")
    
    # workflow.add_edge("check_code", END)

    workflow.add_conditional_edges(
        "execute_code",
    decide_to_finish,
        {
            "end": END,
            "generate": "generate",
        },
    )

    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)

    # app.get_graph().print_ascii()

    return app