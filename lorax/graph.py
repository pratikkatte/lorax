
import os
from typing import Annotated, List
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver


from lorax.tools import routerTool, generalInfoTool, generatorTool
from lorax.utils import execute_generated_code
from lorax.planner import QueryPlan

import tracemalloc
tracemalloc.start()


# Max tries
max_iterations = 3

def generate_answer(state):
    """
    """
    responses = ""
    visual = None

    for r in state["Tasks"]:

        if r.response['text'] is not None:
            responses +=  r.response['text'] + "\n" 

        if r.response['visual'] is not None:
            visual = r.response['visual'] 
        # responses = "\n".join([r.response['text'] for r in state['Tasks']])
    state["response"] = responses
    state['visual'] = visual
    state['messages'] = [("assistant", responses)]

    return state

def executer(state):
    """
    """
    tasks = state['Tasks']

    response = tasks.execute(state['attributes'])
    # print([r.response for r in response])

    state['Tasks'] = response

    return state

class GraphState(TypedDict):
    """
    """
    attributes: dict = {}
    Tasks: QueryPlan
    messages: Annotated[List, add_messages] = []
    question: str = ''
    response: str = ''
    visual: str = ''

def query_planner(state):
    """
    """
    state['messages'] = [("user", state['question'])]
 
    planner_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
                You are a world class query planning algorithm capable of breaking apart questions into its depenencies queries such that the answers can be used to inform the parent question. \
                    Do not answer the questions, simply provide correct compute graph with good specific questions to ask and relevant dependencies. \
                    Before you call the function, think step by step to get a better understanding the problem. \
                    And also consider the following descriptions of tool types: 
                    - VISUALIZATION: if the query asks to display any part of the treesequences.
                    - CODE_GENERATE: If the query requires to use tskit to generate code in python in order to answer.
                    - GENERAL_ANSWER: If the query requires a simple text-based answer inorder to answer.
                    - FETCH FILE: If the query requires to fetch tree-sequence file from the user. 

                    Classify the tool type as one of: VISUALIZATION, CODE_GENERATE, GENERAL_ANSWER, FETCH_FILE
                """,
            ),
            (
                "user",
                "Consider: {question}\nGenerate the correct query plan. \
                    If the query has NO dependency of other subqueries, then it is SINGLE_QUESTION query_type, else it is MULTI_DEPENDENCY.",
            ),
        ]
    )

    planner = planner_prompt | ChatOpenAI(
        model="gpt-4o", temperature=0
    ).with_structured_output(QueryPlan)

    plan = planner.invoke({"question":state['question']})
    state['Tasks'] = plan
    return state


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

    code_solution = generatorTool(messages, question)
    
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

    conversation = [(
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

    workflow.add_node("planner", query_planner)
    workflow.add_node("executer", executer)
    workflow.add_node("generate", generate_answer)

    # workflow.add_node("router", router)
    # workflow.add_node("generate", generate) # generation solution
    # workflow.add_node("execute_code", execute_code)  # execute code
    # workflow.add_node("general_info", general_info)

    # Build graph

    workflow.add_edge(START, 'planner')
    workflow.add_edge('planner', 'executer')
    workflow.add_edge("executer", 'generate')
    workflow.add_edge("generate", END)

    # workflow.add_edge(START, "router")
    # workflow.add_edge("generate", "execute_code")    
    # workflow.add_edge("general_info", END)
    
    # workflow.add_conditional_edges(
    #     "execute_code", 
    #     decide_to_finish,
    #     {
    #         "end": END,
    #         "generate": "generate",
    #     },
    # )
    # workflow.add_conditional_edges(
    #     'router',
    #     router_call,
    #     {
    #         'generate':"generate",
    #         "general_info":"general_info"
    #     }
    # )

    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    return app