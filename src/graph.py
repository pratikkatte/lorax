from typing import List, TypedDict, Any
from langgraph.graph import END, StateGraph, START

# from IPython.display import Image, display

class GraphState(TypedDict):
    """
    """
    error: str
    messages: List
    generation: str
    iterations: int
    code_generator: Any
    retriever: Any
    

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
            "input_files": "../data/sample.trees",
            "code_generator":code_generator,
            "retriever":retriever
            }
    # return "new code genration"

def code_check(state: GraphState):

    print("--- checking code ---")
    messages = state['messages']
    iterations = state['iterations']
    code_solution = state['generation']
    code = code_solution.code
    imports = code_solution.imports
    code_generator = state['code_generator']
    retriever = state['retriever']

    try:
        exec(imports)
    except Exception as e:
        print(" -- Import Check Failed --")
        error_message = [("user", f"The generated import failed to import libraries. \n {0}".format(e))]
        messages += error_message

        return {
            "generation": code_solution,
            "messages": messages,
            "iterations": iterations,
            "error": 'no',
            "input_files": "../data/sample.trees",
            "code_generator":code_generator,
            "retriever":retriever
        }
    # check code
    try:
        exec(imports + "\n" + code)
    except Exception as e:
        print("-- code execution failed --")
        error_message = [("user", f"Your solution failed the code execution test: {e}")]
        messages += error_message
        return {
            "generation": code_solution,
            "messages": messages,
            "iterations": iterations,
            "error": 'no',
            "input_files": "../data/sample.trees"
        }

    # no errors
    print(" -- no code failures --")

    return {
        "generation": code_solution,
        "messages": messages,
        "error": "no",
        "iterations": iterations,
        "input_files": "../data/sample.trees",
        "code_generator":code_generator,
        "retriever":retriever
        
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
    workflow.add_node("check_code", code_check) # check execution. 
    # workflow.add_node("reflect", reflect)  # reflect

    # Build graph
    workflow.add_edge(START, "generate")
    workflow.add_edge("generate", "check_code")
    # workflow.add_edge("check_code", END)

    workflow.add_conditional_edges(
        "check_code", 
    decide_to_finish,
        {
            "end": END,
            "generate": "generate",
        },
    )
    app = workflow.compile()
    return app