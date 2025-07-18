import os
import sys
from lorax.chat.graph import create_graph
from dotenv import load_dotenv
from pkg_resources import resource_filename
from langchain.chains.conversation.memory import ConversationBufferMemory
import time
load_dotenv()

memory = ConversationBufferMemory(return_messages=True)

question = "Calculate the diversity of the given treesequence."
workflow = create_graph()

global_context = {
    "file_path": None,
    "viz_snapshot": None,
    "memory": memory
}

def chat_interface():

    app = create_graph()
    
    data_file_path =  resource_filename(__name__, 'data')

    assert os.path.exists(data_file_path), "Ensure that a treesequence file is stored in the src/data folder. A link to an example treesequence file is in src/README.md"
    
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            sys.exit()

        app = workflow.compile()

        global_context['file_path'] = "data/sample.trees"
        
        message = {'question':user_input, "attributes": global_context}
        solution = app.invoke(message)
        
        llm_output, _ = parseSolution(solution)
        print()
        print(llm_output)
        print()

def parseSolution(input_solution):
    """
    """
    return input_solution['response'], input_solution['visual']

def api_interface(user_input, global_context):
    if memory is None:
        memory = ConversationBufferMemory(return_messages=True)
    
    app = workflow.compile()

    message = {'question': user_input, "attributes": global_context}
    solution = app.invoke(message)

    llm_output = parseSolution(solution)

    return llm_output
 
if __name__== "__main__":
    chat_interface(global_context)
