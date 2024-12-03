from flask import Flask, request, jsonify, session
from flask_session import Session
from langgraph_tskit import api_interface, add_thread, load_data, save_data
from datetime import timedelta
import uuid

app = Flask(__name__)
app.config['SESSION_TYPE'] = 'filesystem'  # Store session data on the server
app.config['SESSION_PERMANENT'] = False   # Sessions expire when the client closes
app.config['SESSION_FILE_DIR'] = './flask_session'  # Directory to store session files
app.config['SESSION_FILE_THRESHOLD'] = 100  # Maximum number of session files to store
app.config['SESSION_FILE_MODE'] = 0o600  # File mode for session files
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
app.config['SECRET_KEY'] = "d8f8b4e5a16c8394d0876d3f4c0ae0c6b2ff198730d4fce4eae8b51975f7cde6"
Session(app)

# Function to generate a random user ID
def generate_user_id():
    return str(uuid.uuid4())

@app.before_request
def assign_user_id():
    session.permanent = True  # Mark session as permanent
    print(f"Before request: {session}")
    if 'user_id' not in session:
        session['user_id'] = generate_user_id()
        print(f"Assigned new user ID: {session['user_id']}")

# Create endpoint to clear session, generate new thread ID for new session (add a button to clear session in frontend)
@app.route('/clear_session', methods=['GET'])
def clear_session():
    session.clear()
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
        
        print(session)

        message = data['message']
        user_id = session['user_id']

        
       # Check if the session already has a thread ID
        if 'thread_id' in session:
            thread_id = session['thread_id']
            print("Using existing Thread ID:", thread_id)
        else:
            # If no thread ID, check the pickle file or create a new one
            existing_data = load_data()
            if user_id in existing_data and existing_data[user_id]:
                thread_id = existing_data[user_id][-1]  # Use the last thread ID
                print("Found existing Thread ID in pickle:", thread_id)
            else:
                thread_id = add_thread(user_id)  # Generate and add a new thread ID
                print("Generated new Thread ID:", thread_id)

            # Store the thread ID in the session for future requests
            session['thread_id'] = thread_id

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

