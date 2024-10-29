import getpass
import os
import sys
from faiss_vector import get_vector_store, repo_to_text
from tools import generator_tool
from graph import create_graph
from utils import execute_generated_code


print("here")


question = "Calculate the diversity of the given treesequence."

def stream_graph_updates(app, user_input: str):
    messages = {
        "messages": [("user", user_input)], 
        "iterations": 3, 
        "error": "", 
        "input_files": "../data/sample.trees"
    }
    config = {"configurable": {"thread_id": "6"}}
    for event in app.stream(messages, config):
        for value in event.values():
            print("value", value)
            prefix = value['generation'].prefix
            code = value['generation'].code
            result = value['result']


    if value['error'] != 'no':
        llm_output = f"Error: {value['error']}\n\nGenerated Code:\n{value['generation'].code}"
    else:
        llm_output = f"Prefix: {prefix}\n\nGenerated Code:\n{code}\n\n RESULT:\n{str(result)}"
            

    return llm_output


def chat_interface():
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    app = create_graph()


    while True:
        # try:
        user_input = input("User: ")
        if user_input.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break

        llm_output = stream_graph_updates(app, user_input)

        print("ASSISTANT:")
        print(llm_output)


def api_interface(app, user_input):

    llm_output = stream_graph_updates(app, user_input)

    return llm_output
        
 
if __name__== "__main__":
    chat_interface()