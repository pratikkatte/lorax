import getpass
import os
import sys
from faiss_vector import get_vector_store, repo_to_text
from tools import generator_tool
from graph import create_graph
from utils import execute_generated_code


print("here")


question = "Calculate the diversity of the given treesequence."


def chat_interface():
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    app = create_graph()

    def stream_graph_updates(user_input: str):
        messages = {
            "messages": [("user", user_input)], 
            "iterations": 3, 
            "error": "", 
            "input_files": "../data/sample.trees"
        }
        config = {"configurable": {"thread_id": "6"}}
        for event in app.stream(messages, config):
            for value in event.values():
                prefix = value['generation'].prefix
                code = value['generation'].code
                result = value['result']
                

        return prefix, code, result


    while True:
        # try:
        user_input = input("User: ")
        if user_input.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break

        output_prefix, output_code, output_result = stream_graph_updates(user_input)

        print("ASSISTANT:")

        print(output_prefix)
        print("\n\nGenerated Code:\n" + output_code)
        print("\n\n RESULT: " + output_result)

def api_interface(user_input):
    
    
    app = create_graph()

    solution = app.invoke({"messages": [("user", user_input)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever, "input_files": "../data/sample.trees"})


    if solution['error'] != 'no':
        llm_output = f"Error: {solution['error']}\n\nGenerated Code:\n{solution['generation'].code}"
    else:
        llm_output = f"Prefix: {solution['generation'].prefix}\n\nGenerated Code:\n{solution['generation'].code}\n\n RESULT:\n{str(solution['result'])}"

    return llm_output
        
 
if __name__== "__main__":
    chat_interface()