import os
import logging
import asyncio
from fastapi import FastAPI, Request, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from werkzeug.utils import secure_filename
from fastapi.staticfiles import StaticFiles
from lorax.langgraph_tskit import api_interface

class LoraxApp:
    def __init__(self):
        self.newick_data = "initial data"
        self.app = FastAPI()
        self.build_path = os.path.join(os.path.dirname(__file__), "website/taxonium_component", "dist")
        self.ALLOWED_EXTENSIONS = {"trees"}
        self.file_path = ''

        self._configure_logging()
        self._setup_cors()
        self._setup_routes()
        self._setup_upload_folder()

    def _configure_logging(self):
        log = logging.getLogger("uvicorn")
        log.setLevel(logging.ERROR)

    def _setup_cors(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _setup_upload_folder(self):
        self.UPLOAD_FOLDER = os.path.abspath(os.path.dirname(__file__)) + "/data"
        os.makedirs(self.UPLOAD_FOLDER, exist_ok=True)

    def _setup_routes(self):
        self.app.mount("/assets", StaticFiles(directory=os.path.join(self.build_path, "assets")), name="assets")
        self.app.get("/")(self.serve_react_app)
        self.app.post("/api/upload")(self.upload)
        self.app.post("/api/chat")(self.chat)
        self.app.websocket("/ws/newick")(self.websocket_endpoint)

    def serve_react_app(self):
        return FileResponse(os.path.join(self.build_path, "index.html"))

    async def upload(self, file: UploadFile = File(...)):
        """Endpoint to handle single file upload."""
        filename = secure_filename(file.filename)
        if not filename.lower().endswith(".trees"):
            raise HTTPException(status_code=400, detail="Unsupported file type")
        file_save_path = os.path.join(self.UPLOAD_FOLDER, filename)
        
        with open(file_save_path, "wb") as f:
            f.write(await file.read())
        self.file_path = file_save_path
        return {"status": "success", "filename": filename}

    def allowed_file(self, filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in self.ALLOWED_EXTENSIONS

    async def chat(self, request: Request):
        """Handle chat messages."""
        data = await request.json()
        message = data.get("message")
        llm_output, llm_visual = api_interface(message, self.file_path)
        self.newick_data = llm_visual
        return {"response": llm_output}

    async def websocket_endpoint(self, websocket: WebSocket):
        """WebSocket endpoint for sending newick data."""
        await websocket.accept()
        try:
            while True:
                await websocket.send_json({"data": self.newick_data})
                await asyncio.sleep(5)
        except WebSocketDisconnect:
            logging.info("WebSocket disconnected")

# Instantiate the app
app = LoraxApp().app
