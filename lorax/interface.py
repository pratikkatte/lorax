import os
import time
import argparse
import logging
import asyncio
from fastapi import FastAPI, Request, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from threading import Thread
from lorax.langgraph_tskit import api_interface
from werkzeug.utils import secure_filename
from fastapi.staticfiles import StaticFiles


newick_data = "initial data"

# Logger configuration
log = logging.getLogger("uvicorn")
log.setLevel(logging.ERROR)

# Initialize FastAPI application
app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to React build directory
build_path = os.path.join(os.path.dirname(__file__), "website/taxonium_component", "dist")

# Serve static files (JS, CSS, images, etc.)
app.mount("/assets", StaticFiles(directory=os.path.join(build_path, "assets")), name="assets")

# Allowed Extensions
ALLOWED_EXTENSIONS = {"trees"}
UPLOAD_FOLDER = os.path.abspath(os.path.dirname(__file__)) + "/data"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Function to check allowed file extensions
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# # Serve the React app's index.html for the root path
@app.get("/")
def serve_react_app():
    return FileResponse(os.path.join(build_path, "index.html"))

@app.post("/api/upload")
async def upload(files: list[UploadFile]):
    """Endpoint to handle file uploads."""
    for file in files:
        filename = secure_filename(file.filename)
        if not allowed_file(filename):
            raise HTTPException(status_code=400, detail="Unsupported file type")
        file_save_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(file_save_path, "wb") as f:
            f.write(await file.read())
    return {"status": "success"}

# # Define the /api/chat endpoint
@app.post("/api/chat")
async def chat(request: Request):
    """Handle chat messages."""
    global newick_data
    data = await request.json()
    message = data.get("message")
    llm_output, llm_visual = api_interface(message)
    newick_data = llm_visual
    return {"response": llm_output}

@app.websocket("/ws/newick")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for sending newick data."""
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({"data": newick_data})
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        print("disconnected")
        log.info("WebSocket disconnected")

# Command-line argument parser
def args_parser():
    input_vals = {
        "model": "openai",
        "api": ""
    }

    parser = argparse.ArgumentParser()
    parser.add_argument("--openai-api-key", help="OpenAI API Key")
    args = parser.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")

    if api_key is None and args.openai_api_key is None:
        print("Exception: Provide openai-api-key")
        return None
    else:
        input_vals["api"] = api_key
    return input_vals

# Main entry point
def main():
    input_vals = args_parser()
    if not input_vals:
        return

    print("\nstart local server....")
    print("Access the interface at http://localhost:8000/")
    print("Press CTRL+C to quit")

    import uvicorn
    uvicorn.run("lorax.interface:app", host="0.0.0.0", port=8000, log_level="info", reload=True)

if __name__ == "__main__":
    main()
