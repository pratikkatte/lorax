
from flask import Flask, request, jsonify, Response, send_from_directory

from lorax.langgraph_tskit import api_interface

from flask_cors import CORS
import os
import json
from threading import Timer
import webbrowser

DEBUG = False

if not DEBUG:

    from pkg_resources import resource_filename

    fronted_path =  resource_filename(__name__, 'website/taxonium_component/dist/')
    

    app = Flask(__name__, static_folder=fronted_path)
    CORS(app)
    # Serve static files (e.g., JS, CSS)
    @app.route('/assets/<path:filename>')
    def static_files(filename):

        return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)
    
    # Serve the React app
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):

        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

else:
    app = Flask(__name__)
    CORS(app)

    @app.route('/', methods=['GET'])
    def status():
        print("Status endpoint accessed")
        return "Success 200!"

class DataStreamer:
    def __init__(self):
        self.json_data = {"message": "", "status": "Updated"}

    def stream_data(self):
        while True:
            # with open("file.txt", 'r') as file:
            #     data = file.read().strip()

            # self.json_data["message"] = data'
            yield f"data: {json.dumps(self.json_data)}\n\n"

data_streamer = DataStreamer()

@app.route('/api/stream')
def stream():
    return Response(data_streamer.stream_data(), content_type='text/event-stream')

# Test GET endpoint


# Define the /api/chat endpoint
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()  # Get the JSON data from the request
    message = data.get('message')

    llm_output, llm_visual = api_interface(message)

    data_streamer.json_data['message'] = llm_visual
    
    # Process the incoming message here (for now, we simply return it)
    print(f"Response message: {llm_output}")

    # Respond with a simple JSON response
    return jsonify({"response": f"{llm_output}"})

def open_browser():
    webbrowser.open_new("http://localhost:5001")

def main():
    # hostname = "lorax.localhost"
    # socket.getaddrinfo(hostname, 5001)  # Ensures the hostname resolves to 127.0.0.1
    Timer(1, open_browser).start()

    app.run(host='0.0.0.0', port=5001, debug=DEBUG)
