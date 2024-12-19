import os
import sys
from graph import create_graph
from dotenv import load_dotenv
import pickle
import uuid

load_dotenv()

assert os.path.exists("data/"), "Ensure that a treesequence file is stored in the src/data folder. A link to an example treesequence file is in src/README.md"

question = "Calculate the diversity of the given treesequence."
app = create_graph()

def generate_thread_id():
    return str(uuid.uuid4())

def load_data(filename='user_threads.pkl'):
    try:
        with open(filename, 'rb') as f:
            data = pickle.load(f)
    except FileNotFoundError:
        data = {}  # Initialize an empty dictionary if file does not exist
    return data

def save_data(data, filename='user_threads.pkl'):
    with open(filename, 'wb') as f:
        pickle.dump(data, f)

def add_thread(user_id, thread_id=None, filename='user_threads.pkl'):
    data = load_data(filename)
    
    # Generate a random thread ID if none is provided
    if thread_id is None:
        thread_id = generate_thread_id()
    
    # Check if user ID already has a list of thread IDs; if not, initialize one
    if user_id not in data:
        data[user_id] = []
    
    # Append the thread ID to the user's list if it isn't already there
    if thread_id not in data[user_id]:
        data[user_id].append(thread_id)
    
    save_data(data, filename)
    return thread_id  # Return the thread ID for reference

def validate_thread_id(user_id, thread_id, filename='user_threads.pkl'):
    data = load_data(filename)

    if user_id in data and thread_id in data[user_id]:
        return True
    else:
        return False

def chat_interface():
    print("Tree-sequence analysis")
    print("Type 'exit' to end the conversation.")

    user_id = input("Enter your user ID: ").strip()

    thread_id_exists = input("Do you have an existing thread ID? (y/n): ").strip().lower()
    if thread_id_exists == 'y' or thread_id_exists == 'yes':
        thread_id = input("Enter your thread ID: ").strip()

        valid_thread_id = validate_thread_id(user_id, thread_id)
        if valid_thread_id:
            print("Using Thread ID:", thread_id)
            
        else: 
            print("Invalid Thread ID. Please try again.")
            sys.exit()
    else:
        thread_id = add_thread(user_id)
        print("Generated and added Thread ID:", thread_id)
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            sys.exit()
        
        config = {"configurable": {"thread_id": thread_id}}
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

def api_interface(user_input, thread_id):

    config = {"configurable": {"thread_id": thread_id}}
    message = {"messages": [("user", user_input)], "iterations": 0, "error": "", "input_files": "./data/sample.trees", "next": None, "generation": None, "result": None}
    solution = app.invoke(message, config)

    llm_output = parseSolution(solution)

    return llm_output
 
if __name__== "__main__":
    chat_interface()
