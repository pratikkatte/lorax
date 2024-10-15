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
        # response = f"Bot: You said: {user_input}"
        # print(response)
        solution = app.invoke({"messages": [("user", user_input)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever})

        llm_output = solution['generation']
        print(solution['generation'].code)

        response = execute_generated_code(llm_output, "data/sample.trees")
        print(response)
 
if __name__== "__main__":
    chat_interface()