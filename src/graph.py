from typing import List, TypedDict, Any
from langgraph.graph import END, StateGraph, START
from types import ModuleType
import sys
import ast
import inspect

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


def execute_code(state: GraphState):

    print("--- executing code ---")

    # State
    messages = state['messages']
    iterations = state['iterations']
    code_solution = state['generation']
    code = code_solution.code
    imports = code_solution.imports
    code_generator = state['code_generator']
    retriever = state['retriever']

    try:
        # Create a new module to execute the code
        mod = ModuleType("dynamic_module")
        sys.modules["dynamic_module"] = mod

        # Combine imports and code
        full_code = imports + "\n\n" + code

        # Execute the combined code
        exec(full_code, mod.__dict__)

        # Parse the code to find the last defined function
        tree = ast.parse(full_code)
        functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        if not functions:
            raise ValueError("No function found in the generated code")

        last_function = functions[-1]
        function_name = last_function.name

        # Get the function from the module
        func = getattr(mod, function_name)

        # Check if the function requires arguments
        sig = inspect.signature(func)
        params = sig.parameters
        call_args = []  # Placeholder for args if needed
        call_kwargs = {}  # Placeholder for kwargs if needed

        # Call the function
        result = func(*call_args, **call_kwargs)
        
        # Log the result in messages
        messages += [
            ("assistant", f"Code executed successfully. Result: {result}")
        ]
    except Exception as e:
        print("-- code execution failed --")
        error_message = [("user", f"Code execution failed with error: {e}")]
        messages += error_message

        return {
            "generation": code_solution,
            "messages": messages,
            "iterations": iterations,
            "error": 'yes',
            "input_files": "../data/sample.trees",
            "code_generator": code_generator,
            "retriever": retriever
        }

    print(" -- finished code execution --")

    return {
        "generation": code_solution,
        "messages": messages,
        "error": "no",
        "iterations": iterations,
        "input_files": "../data/sample.trees",
        "code_generator": code_generator,
        "retriever": retriever
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
    workflow.add_node("check_code", code_check) # check execution. 
    workflow.add_node("execute_code", execute_code)  # execute code
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

    workflow.add_edge("check_code", "execute_code")

    workflow.add_conditional_edges(
        "execute_code",
    decide_to_finish,
        {
            "end": END,
            "generate": "generate",
        },
    )


    app = workflow.compile()

    app.get_graph().print_ascii()

    return app