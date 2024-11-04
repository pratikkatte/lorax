import getpass
import os
import sys
from faiss_vector import get_vector_store, repo_to_text
from tools import generator_tool
from graph import create_graph
from utils import execute_generated_code

print("here")

vector_store = get_vector_store()
retriever = vector_store.as_retriever(
    search_type="similarity",  # Also test "similarity", "mmr"
    search_kwargs={"k": 5})

code_generator = generator_tool()

question = "Calculate the diversity of the given treesequence."

# print(result)

# repo_to_text("../../tskit", 'data.text')

def chat_interface():
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            sys.exit()
        
        app = create_graph()
        solution = app.invoke({"messages": [("user", user_input)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever, "input_files": "./data/sample.trees"})
        llm_output = parseSolution(solution)
        print(llm_output)        
        # print(llm_output['generation'].prefix)
        # print("\n\nGenerated Code:\n {0} \n".format(llm_output['generation'].code))
        # print(llm_output['result'])

def parseSolution(input_solution):
    if input_solution['error'] != None:
        print("error", input_solution['error'])
        llm_output = f"Error: {input_solution['error']}\n\nGenerated Code:\n{input_solution['generation'].imports}\n{input_solution['generation'].code}"
    else:
        if 'generation' in input_solution.keys():
            prefix = input_solution['generation'].prefix
            code = f"{input_solution['generation'].imports} \n\n {input_solution['generation'].code}"
            result = input_solution['result']
            llm_output = f"{prefix} \n\n {code} \n\n {result}"
            print(llm_output)
            return llm_output
        else:
            llm_output = input_solution['result']

    return llm_output

def api_interface(user_input):
    
    app = create_graph()

    solution = app.invoke({"messages": [("user", user_input)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever, "input_files": "./data/sample.trees"})

    llm_output = parseSolution(solution)

    return llm_output
 
if __name__== "__main__":
    chat_interface()
