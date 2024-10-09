import getpass
import os

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


app = create_graph()

question = "Calculate the diversity of the given treesequence."
solution = app.invoke({"messages": [("user", question)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever})

llm_output = solution['generation']

print(solution['generation'].code)

result = execute_generated_code(llm_output, "../../data/sample.trees")
print(result)

# repo_to_text("../../tskit", 'data.text')