import getpass
import os

from faiss_vector import get_vector_store, repo_to_text
from tools import generator_tool
from graph import create_graph
from utils import execute_generated_code

print("here")


def call_code_generator(question):

    vector_store = get_vector_store()
    retriever = vector_store.as_retriever(
        search_type="similarity",  # Also test "similarity", "mmr"
        search_kwargs={"k": 5})

    code_generator = generator_tool()

    app = create_graph()

    solution = app.invoke({"messages": [("user", question)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever})

    llm_output = solution['generation']

    return llm_output


query = "Calculate the diversity of the given treesequence."
llm_output = call_code_generator(query)

print(llm_output.code)

hitl_output = input("Please view above code and type 'Y' if approved and 'N' if not approved: ")

# While loop to check if code is approved, breaks out once HITL approves of code
while hitl_output not in ['Y', 'y', 'Yes', 'yes']:

    if hitl_output in ['N', 'n', 'No', 'no']:
        print("Code not approved, calling code generator again")

        if "Code not approved, calling code generator again" not in query:
            query += "Code not approved by human-in-the-loop, try again"

        llm_output = call_code_generator(query)
        print(llm_output.code)
    else:
        print("Invalid input, try again")
        
    hitl_output = input("Please view above code and type 'Y' if approved and 'N' if not approved: ")


print("Code approved")


result = execute_generated_code(llm_output, "../data/basics.trees")
print(result)

# repo_to_text("../../tskit", 'data.text')