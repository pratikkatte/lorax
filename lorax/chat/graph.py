import os
from typing import Annotated, List
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI


from lorax.chat.tools import generalInfoTool, generatorTool
from lorax.chat.utils import execute_generated_code
from lorax.chat.planner import QueryPlan

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
        
    state["response"] = responses
    state['visual'] = visual
    state['messages'] = [("assistant", responses)]
    state['attributes']["memory"].chat_memory.add_ai_message(responses)

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


    # Add the new question to the chat history
    state['attributes']["memory"].chat_memory.add_user_message(state['question'])
    history = state['attributes']["memory"]
    
    
    prompt_messages = [
    (
        "system",
        (
            "You are a world class query planning algorithm capable of breaking apart questions into its dependency queries. Don't rewrite the queries, just break it down. If the user doesn't ask a question. responding politely."
            "such that the answers can be used to inform the parent question. Do not answer the questions, simply provide a correct "
            "compute graph with specific subquestions and their dependencies. Before calling any function, think step by step to understand "
            "the problem. Also consider the following tool types: \n"
            "- VISUALIZATION: if the query asks to display any part of the treesequences.\n"
            "- CODE_GENERATE: if the query requires using tskit to generate code in Python in order to answer.\n"
            "- GENERAL_ANSWER: if the query requires a simple text-based answer.\n"
            "Classify the tool type as one of: VISUALIZATION, CODE_GENERATE, GENERAL_ANSWER."
            "some user queries may just be a greeting. In that case, respond politely and ask the user to ask a question."
        ),
    ),
    (
        "user",
        (
            "Here is the conversation so far:\n{history}\n\n"
            "Now, based on the above conversation and considering the latest question: {question}" 
            "generate the correct query plan. If the query has NO dependencies on other subqueries, then it is a SINGLE_QUESTION query_type; "
            "otherwise, it is MULTI_DEPENDENCY."
        ),
    ),
]

    # Create a ChatPromptTemplate using these messages.
    planner_prompt = ChatPromptTemplate.from_messages(prompt_messages)

    planner = planner_prompt | ChatOpenAI(
        model="gpt-4o", temperature=0
    ).with_structured_output(QueryPlan)

    plan = planner.invoke({"question":state['question'], "history": history})
    state['Tasks'] = plan

    state['attributes']["memory"].chat_memory.add_ai_message(str(plan))
    print(plan)
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

    state['attributes']["memory"].chat_memory.add_ai_message(messages[1])

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

    state['attributes']["memory"].chat_memory.add_ai_message(f"Code executed successfully. {result}")

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

def general_info(state: GraphState):
    """
    """
    conversation = state['messages']

    answer = generalInfoTool(conversation)

    conversation = [(
            "assistant",
            f"{answer.content}",
        )]
    
    state['attributes']["memory"].chat_memory.add_ai_message(answer.content)

    return {
        "result": answer.content,
        "error":None,
        "messages": conversation
    }

def create_graph():

    workflow = StateGraph(GraphState)

    # Define the nodes
    try:
        workflow.add_node("planner", query_planner)
        workflow.add_node("executer", executer)
        workflow.add_node("generate", generate_answer)
    except Exception as e: 
        print(f"Failed to add node 'planner': {e}")

    # Build graph
    workflow.add_edge(START, 'planner')
    workflow.add_edge('planner', 'executer')
    workflow.add_edge("executer", 'generate')
    workflow.add_edge("generate", END)
   
    return workflow
