import os
import sys
from lorax.graph import create_graph
from dotenv import load_dotenv
from pkg_resources import resource_filename

load_dotenv()



question = "Calculate the diversity of the given treesequence."
app = create_graph()

def chat_interface():
    data_file_path =  resource_filename(__name__, 'data')

    assert os.path.exists(data_file_path), "Ensure that a treesequence file is stored in the src/data folder. A link to an example treesequence file is in src/README.md"
    
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            sys.exit()
        
        config = {"configurable": {"thread_id": "5"}}
        # message = {"messages": [("user", user_input)], "iterations": 0, "error": "", "input_files": "./data/sample.trees", "next": None, "generation": None, "result": None}
        message = {'question':user_input, "attributes":{"file_path":"data/sample.trees"}}
        solution = app.invoke(message, config)
        
        
        llm_output, _ = parseSolution(solution)
        print()
        print(llm_output)
        print()

def parseSolution(input_solution):

    return input_solution['response'], input_solution['visual']

def api_interface(user_input, file_path):

    config = {"configurable": {"thread_id": "7"}}
    # message = {"messages": [("user", user_input)], "iterations": 0, "error": "", "input_files": "./data/sample.trees", "next": None, "generation": None, "result": None}
    message = {'question':user_input, "attributes":{"file_path":file_path}}

    print("message", message)
    solution = app.invoke(message, config)

    llm_output = parseSolution(solution)

    return llm_output
 
if __name__== "__main__":
    chat_interface()
