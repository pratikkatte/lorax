from flask import Flask, request, jsonify
from langgraph_tskit import api_interface

app = Flask(__name__)

# Test GET endpoint
@app.route('/', methods=['GET'])
def status():
    print("Status endpoint accessed")
    return "Success 200!"

# Define the /api/chat endpoint
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()  # Get the JSON data from the request
    message = data.get('message')


    llm_output = api_interface(message)

    # Process the incoming message here (for now, we simply return it)
    print(f"Response message: {llm_output}")

    # Respond with a simple JSON response
    return jsonify({"response": f"{llm_output}"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)

