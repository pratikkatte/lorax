import os
import time
import argparse
import json
import logging
from flask import Flask, request, jsonify, Response, send_from_directory, cli
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from threading import Thread
from werkzeug.utils import secure_filename
from lorax.langgraph_tskit import api_interface

# Disable flask logging
log = logging.getLogger('werkzeug')

log.setLevel(logging.ERROR)
log.disabled = True
cli.show_server_banner = lambda *_: None

# Allowed Extensions
ALLOWED_EXTENSIONS = {'trees'}

# Production/development mode
DEBUG = True

if not DEBUG:
    from pkg_resources import resource_filename

    frontend_path = resource_filename(__name__, 'website/taxonium_component/dist/')
    app = Flask(__name__, static_folder=frontend_path)
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
    CORS(app, resources={r"/*": {"origins": "*"}})

    @app.route('/', methods=['GET'])
    def status():
        print("Status endpoint accessed")
        return "Success 200!"

UPLOAD_FOLDER = os.path.abspath(os.path.dirname(__file__)) + '/data'
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

app.config['ALLOWED_EXTENSIONS'] = {'trees'}

newick_data = "initial data"

# WebSocket
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Function to check allowed file extensions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@socketio.on("newick")
def send_newick():
    global newick_data
    while True:
        time.sleep(5)  # Wait for 5 seconds before sending an update
        socketio.emit('newick', {'data': newick_data})

def allowedFile(filename):
    """Check if the file is of an allowed type."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
def upload():
    """Endpoint to handle file uploads."""
    if request.method == 'POST':
        
        files = request.files.getlist('file')
        for f in files:
            filename = secure_filename(f.filename)
            
            if allowedFile(filename):
                file_save_path = os.path.join(UPLOAD_FOLDER, filename)
                f.save(file_save_path)
                
            print("file saved")
            
        return jsonify({"status": "success"})
    
    return jsonify({"status": "failed"})

# Define the /api/chat endpoint
@app.route('/api/chat', methods=['POST'])
def chat():
    global newick_data
    data = request.get_json()  # Get the JSON data from the request
    message = data.get('message')
    llm_output, llm_visual = api_interface(message)

    newick_data = llm_visual

    # Process the incoming message here (for now, we simply return it)
    print(f"Response message: {llm_output}")

    # Respond with a simple JSON response
    return jsonify({"response": f"{llm_output}"})

# Start the background thread that sends data updates
def start_background_task():
    thread = Thread(target=send_newick)
    thread.daemon = True
    thread.start()

def args_parser():
    input_vals = {
        'model': 'openai',
        'api': ''
    }
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai-api-key", help="OpenAI API Key")
    args = parser.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")

    if api_key is None and args.openai_api_key is None:
        print("Exception: Provide openai-api-key")
        return None
    else:
        input_vals['api'] = api_key

    return input_vals

def main():
    """
    """
    input_vals = args_parser()
    if not input_vals:
        return

    print("\nstart local server....")
    print()
    print("Access the interface at http://localhost:5001/")
    print()
    print("Press CTRL+C to quit")

    start_background_task()
    socketio.run(app, port=5001, debug=DEBUG, use_reloader=False, log_output=False)
