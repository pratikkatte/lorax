import os
from typing import Annotated, List
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from lorax.config import LLM_TYPE, MODEL_NAME
from langchain_ollama.llms import OllamaLLM
from langchain_ollama import ChatOllama
# from ollama_functions import OllamaFunctions
from langchain_experimental.llms.ollama_functions import OllamaFunctions
from lorax.tools import routerTool, generalInfoTool, generatorTool
from lorax.utils import execute_generated_code
from lorax.planner import QueryPlan
from ollama import chat

import tracemalloc
tracemalloc.start()

if LLM_TYPE == "OPENAI":
    print("Planner using OpenAI LLM")
    planner_llm = ChatOpenAI(model_name=MODEL_NAME)
else:
    print("Planner using Ollama LLM")
    planner_llm = ChatOllama(model="llama3.1", temperature=0)
# planner_llm = ChatOpenAI(model_name=MODEL_NAME)


# Max tries
max_iterations = 3

def generate_answer(state):
    """
    """
    responses = ""
    visual = None
    
    # print("state", state["Tasks"])

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
            """
                You are a specialized query planner for phylogenetics and tree-sequence analysis using tskit in Python.

                Your job is to break down user questions about genetic trees, population structure, or tree-sequence files into a set of sub-questions that can be answered using tools such as code generation, visualizations, or file access.

                Each subquestion must include:
                - id: an integer
                - question: the subquestion
                - tool_type: one of ["VISUALIZATION", "CODE_GENERATE", "GENERAL_ANSWER", "FETCH_FILE"]
                - dependancies: (optional) list of query ids that this subquestion depends on

                **Examples of questions you can handle include**:
                - Calculating tree diversity from a tree sequence
                - Drawing trees at specific genome positions
                - Getting the number of samples or individuals in a sequence
                - Calculating allele frequencies or Fst
                - Any question that involves analyzing a `.trees` file using `tskit`

                **RULES**:
                - If the question can be answered in one step, generate a single query (query_type = SINGLE_QUESTION).
                - Only create multiple steps if intermediate subquestions are needed (query_type = MULTI_DEPENDENCY).
                - Do not generate irrelevant questions about humans or general knowledge.
                - Always assume the data comes from a `.trees` file loaded using `tskit`.

                Only output the structured query graph in JSON. Do not include commentary, explanations, or formatting instructions.
            """
        ),
    ),
    (
        "user",
        (
            "Here is the conversation so far:\n{history}\n\n"
            "Now, based on the above conversation and considering the latest question: '{question}, " 
            "generate the correct query plan. If the query has NO dependencies on other subqueries, then it is a SINGLE_QUESTION query_type; "
            "otherwise, it is MULTI_DEPENDENCY."
        ),
    ),
]
    print("prompt_messages", prompt_messages)

    response = chat(
        messages=[
                {
                'role': 'user',
                'content': str(prompt_messages),
                }
            ],
            model='llama3.1',
            format=QueryPlan.model_json_schema(),
    )

    plan = QueryPlan.model_validate_json(response.message.content)

    print("Planner Response:", plan)
        
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

    state['attributes']["memory"].chat_memory.add_ai_message(messages)

    return {
            "generation": code_solution, 
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
