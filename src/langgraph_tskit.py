import os
import sys
from graph import create_graph
from dotenv import load_dotenv

load_dotenv()

assert os.path.exists("data/"), "Ensure that a treesequence file is stored in the src/data folder. A link to an example treesequence file is in src/README.md"

question = "Calculate the diversity of the given treesequence."
app = create_graph()

def chat_interface():
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            sys.exit()
        
        config = {"configurable": {"thread_id": "5"}}
        message = {"messages": [("user", user_input)], "iterations": 0, "error": "", "input_files": "./data/sample.trees", "next": None, "generation": None, "result": None}

        solution = app.invoke(message, config)
        llm_output = parseSolution(solution)
        print(llm_output)

def parseSolution(input_solution):
    if input_solution['error'] != None:
        print("error", input_solution['error'])
        llm_output = f"Error: {input_solution['error']}\n\nGenerated Code:\n{input_solution['generation'].imports}\n{input_solution['generation'].code}"
    else:
        if 'generation' in input_solution.keys() and input_solution['generation'] != None:
            prefix = input_solution['generation'].prefix
            code = f"{input_solution['generation'].imports} \n\n {input_solution['generation'].code}"
            result = input_solution['result']
            llm_output = f"{prefix} \n\n {code} \n\n {result}"
            return llm_output
        else:
            llm_output = input_solution['result']

    return llm_output

def api_interface(user_input):

    config = {"configurable": {"thread_id": "5"}}
    message = {"messages": [("user", user_input)], "iterations": 0, "error": "", "input_files": "./data/sample.trees", "next": None, "generation": None, "result": None}
    solution = app.invoke(message, config)

    llm_output = parseSolution(solution)

    return llm_output
 
if __name__== "__main__":
    chat_interface()
