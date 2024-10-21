from typing import List, TypedDict, Any
from langgraph.graph import END, StateGraph, START
from types import ModuleType
import sys
import ast
import inspect
from utils import execute_generated_code

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
    messages: List
    generation: str
    iterations: int
    code_generator: Any
    retriever: Any
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
    code_generator = state['code_generator']
    retriever = state['retriever']



    if error == "yes":
        messages += [
            (
                "user",
                "Now, try again. Invoke the code tool to structure the output with a prefix, imports, and code block:",
            )
        ]

    # Solution
    question = messages[-1][1]
    docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])
    code_solution = code_generator.invoke(
        {"context": context, "messages": messages}
    )

    messages += [
        (
            "assistant",
            f"{code_solution.prefix} \n Imports: {code_solution.imports} \n Code: {code_solution.code}",
        )
    ]
    iterations = iterations + 1

    return {"generation": code_solution, 
            "messages": messages, 
            "iterations": iterations,
            "code_generator":code_generator,
            "retriever":retriever
            }
    # return "new code genration"

def execute_code(state: GraphState):

    print("--- checking code ---")
    messages = state['messages']
    iterations = state['iterations']
    code_solution = state['generation']
    code = code_solution.code
    imports = code_solution.imports
    code_generator = state['code_generator']
    retriever = state['retriever']
    input_files = state['input_files']
    generation = state['generation']
    error = state['error']

    # print("Imports: ", imports)

    # try:
    #     result = execute_generated_code(imports, input_files)
    #     print("Result: ", result)
    # except Exception as e:
    #     print(" -- Import Check Failed --")
    #     error_message = [("user", f"The generated import failed to import libraries. \n {0}".format(e))]
    #     messages += error_message

    #     return {
    #         "generation": code_solution,
    #         "messages": messages,
    #         "iterations": iterations,
    #         "error": 'no',
    #         "code_generator":code_generator,
    #         "retriever":retriever
    #     }
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
    result = f"Result: {result}"

    return {
        "generation": code_solution,
        "messages": messages,
        "error": "no",
        "iterations": iterations,
        "code_generator":code_generator,
        "retriever":retriever,
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

# def request_tree_sequence():
#     """
#     Request tree sequence input from user.
#     This can be a string representation or a file path.
#     """
#     print("Please provide your tree sequence as a string or a path to a file.")
#     user_input = input("Tree sequence: ")
#     # You can later choose to either use this input directly or load from file
#     if user_input.endswith(".trees"):  # Assuming the user provided a file path
#         with open(user_input, 'r') as file:
#             tree_sequence = file.read()
#     else:
#         tree_sequence = user_input  # Assuming input is directly the tree sequence string
    
#     return tree_sequence


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


    app = workflow.compile()

    # app.get_graph().print_ascii()

    return app