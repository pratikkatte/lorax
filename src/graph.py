import os
from typing import List, TypedDict, Any
from langgraph.graph import END, StateGraph, START

from utils import execute_generated_code
from tools import routerTool, generalInfoTool

# Max tries
max_iterations = 3

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
    next: str

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

    if error != "no":
        question = messages[-1][1] + "\n" + error + "\n" + "Now, try again. Invoke the code tool to structure the output with a prefix, imports, and code block:"

        messages += [(
            "user",
            question
        )]
    else:
        question = messages[-1][1]

    docs = retriever.get_relevant_documents(question)
    context = "\n".join([doc.page_content for doc in docs])
    # print("context", context)
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

def execute_code(state: GraphState):

    print("--- checking code ---")
    messages = state['messages']
    iterations = state['iterations']
    code_solution = state['generation']
    code_generator = state['code_generator']
    retriever = state['retriever']
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

    return {
        "generation": code_solution,
        "messages": messages,
        "error": None,
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
    question = state['messages'][-1][1]

    query = {'query':question}
    answer = routerTool(query)

    return {
        "next": answer.content.lower()
    }

def general_info(state: GraphState):
    """
    """
    conversation = state['messages']

    answer = generalInfoTool(conversation)

    conversation += [ (
            "assistant",
            f"{answer.content}",
        )]
    return {
        "result": answer.content,
        "error":None,
        "messages": conversation
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
    app = workflow.compile()
    return app