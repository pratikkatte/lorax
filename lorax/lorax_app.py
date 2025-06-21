from fastapi import FastAPI, UploadFile, File
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.websockets import WebSocket, WebSocketDisconnect
from lorax.manager import WebSocketManager
from fastapi.middleware.cors import CORSMiddleware
from lorax.handlers import LoraxHandler
import shutil
import os
from pathlib import Path

app = FastAPI()

lorax_handler = LoraxHandler()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
manager = WebSocketManager()

@app.get('/')
async def root(request: Request):
    return {"message": "Hello, Loorax!"}

@app.post('/api/upload')
async def upload(file: UploadFile = File(...)):
    try:
        # Create a safe file path
        file_path = UPLOAD_DIR / file.filename
        
        # Save the file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Notify components about the upload

        viz_config, chat_config = await lorax_handler.handle_upload(file_path)

        await manager.send_to_component("viz", {
            "type": "viz", 
            "role": "config",
            "config": viz_config,
        })

        await manager.send_to_component("chat", {
            "type": "chat", 
            "role": "assistant",
            "data": str(chat_config)  # send the config to the chat component  
        })

        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "file_path": str(file_path)
        }

    except Exception as e:
        return {"error": str(e)}
    finally:
        file.file.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await manager.register_component(websocket, "viz")
    await manager.register_component(websocket, "chat")
    await manager.register_component(websocket, "ping")
    try:
        while True:
            message = await websocket.receive_json()
            
            if message.get("type") == "ping":
                data = await lorax_handler.handle_ping(message)
                await manager.send_to_component("ping", data)
                continue  # ignore pings

            if message.get("type") == "chat":
                message = await lorax_handler.handle_chat(message)
                await manager.send_to_component("chat", message)
                continue

            if message.get("type") == "viz":
                print("message", message)
                if message.get("role") == "query":
                    result = await lorax_handler.handle_query(message)
                    
                    print("Viz received query")
                    message = {"type": "viz", "role": "query-result", "data": result}
                    await manager.send_to_component("viz", message)
                    continue

                if message.get("role") == "details":
                    result = await lorax_handler.handle_details(message)
                    message = {"type": "viz", "role": "details-result", "data": result}
                    await manager.send_to_component("viz", message)
                    continue

                # print("Viz received")
                # message = await lorax_handler.handle_viz(message)
                # await manager.send_to_component("viz", message)
                continue

            for client in manager.connected_clients:
                print("Sending message to client", message)
                await manager.send_message(client, message)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
        print("Client disconnected")
    except Exception as e:
        print(f"Unexpected error: {e}")
        await manager.disconnect(websocket)