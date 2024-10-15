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

def call_code_generator(app, question):
    solution = app.invoke({"messages": [("user", question)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever})
    llm_output = solution['generation']

    return llm_output


def chat_interface():
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    while True:
         # Example: Calculate the diversity of the given treesequence.
        user_input = input("You: ").strip()

        # Exit condition        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            sys.exit()
        
        app = create_graph()
        # response = f"Bot: You said: {user_input}"
        # print(response)
        # solution = app.invoke({"messages": [("user", user_input)], "iterations": 0, "error": "", "code_generator":code_generator,"retriever": retriever})

        llm_output = call_code_generator(app, user_input)
        print(llm_output.code)


        # Human in the Loop (HITL) Yes/No feedback
        hitl_output = input("Please view above code and type 'Y' if approved and 'N' if not approved: ").lower()

        # While loop to check if code is approved, breaks out once HITL approves of code
        while hitl_output not in ['y', 'yes']:

            if hitl_output in ['n', 'no']:
                print("Code not approved, calling code generator again")

                if "Code not approved, calling code generator again" not in user_input:
                    user_input += "Code not approved by human-in-the-loop, try again"

                # Regenerate code if not approved by HITL
                llm_output = call_code_generator(app, user_input)
                print(llm_output.code)
            else:
                print("Invalid input, try again")
                
            hitl_output = input("Please view above code and type 'Y' if approved and 'N' if not approved: ").lower()

        print("Code approved")


        response = execute_generated_code(llm_output, "../data/sample.trees")
        print(response)


if __name__== "__main__":
    chat_interface()


# repo_to_text("../../tskit", 'data.text')


