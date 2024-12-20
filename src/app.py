from flask import Flask, request, jsonify

from flask_cors import CORS
from langgraph_tskit import api_interface, add_thread, load_data, save_data, generate_thread_id
from datetime import timedelta
import uuid

app = Flask(__name__)
CORS(app)

user_cookie = {}

# Function to generate a random user ID
def generate_user_id():
    return str(uuid.uuid4())

# Create endpoint to clear session, generate new thread ID for new session
@app.route('/clear_chat', methods=['POST'])
def clear_chat():
    global user_cookie 
    user_cookie = {}
    return "Session Cleared"


# Test GET endpoint
@app.route('/', methods=['GET'])
def status():
    print("Status endpoint accessed")
    return "Success 200!"

# Define the /api/chat endpoint
@app.route('/api/chat', methods=['POST'])
def chat():

    try:
        data = request.get_json()  # Get the JSON data from the request
        if not data or 'message' not in data:
            return jsonify({"error": "Invalid input, 'message' key is required"}), 400

        message = data['message']

        if 'user_id' in user_cookie:
            user_id, thread_id = user_cookie['user_id']
            print("Using existing User ID:", user_id, "and Thread ID:", thread_id)   
        else:
            user_id = generate_user_id()
            thread_id = add_thread(user_id)
            user_cookie['user_id'] = (user_id, thread_id)
            print("Generating User ID:", user_id, "and Thread ID:", thread_id)   

        # Call the LLM interface with the message and thread ID
        llm_output = api_interface(message, thread_id)
        print(f"Response message: {llm_output}")

        # Respond with the LLM's output
        return jsonify({"response": llm_output})
    
    except Exception as e:
        print(f"Error occurred: {e}")
        return jsonify({"error": "An error occurred while processing the request"}), 500



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
