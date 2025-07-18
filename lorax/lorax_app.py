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

@app.post('/upload')
async def upload(file: UploadFile = File(...)):
    try:
        # Create a safe file path
        file_path = UPLOAD_DIR / file.filename
        
        # Save the file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Notify components about the upload
        print("Upload received", file_path)
        viz_config, chat_config = await lorax_handler.handle_upload(file_path)

        # Only send to connected clients
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
    
    # Clean up any existing disconnected clients
    await manager.cleanup_disconnected_clients()
    
    try:
        while True:
            # Check if client is still connected before processing
            if not manager.is_connected(websocket):
                print("Client disconnected, breaking loop")
                break
                
            try:
                message = await websocket.receive_json()
                
                # Check connection again after receiving message
                if not manager.is_connected(websocket):
                    print("Client disconnected after receiving message")
                    break
                
                # Periodic cleanup of other disconnected clients
                await manager.cleanup_disconnected_clients()
                
                if message.get("type") == "ping":
                    data = await lorax_handler.handle_ping(message)
                    await manager.send_to_component("ping", data)
                    continue  # ignore pings

                if message.get("type") == "chat":
                    try:
                        print("Chat received", message)
                        message = lorax_handler.handle_chat(message)

                        if message.get("action") == True:
                            print("viz action")

                        await manager.send_to_component("chat", message)
                    except Exception as e:
                        print(f"Error handling chat message: {e}")
                        await manager.send_to_component("chat", {
                            "type": "chat", 
                            "role": "assistant",
                            "data": f"Error processing message: {str(e)}"
                        })
                    continue

                if message.get("type") == "viz":
                    print("message", message)
                    if message.get("role") == "query":
                        try:
                            result = await lorax_handler.handle_query(message)
                            print("Viz received query")
                            message = {"type": "viz", "role": "query-result", "data": result}
                            await manager.send_to_component("viz", message)
                        except Exception as e:
                            print(f"Error handling viz query: {e}")
                            await manager.send_to_component("viz", {
                                "type": "viz", 
                                "role": "query-result", 
                                "data": {"error": str(e)}
                            })
                        continue

                    if message.get("role") == "details":
                        try:
                            result = await lorax_handler.handle_details(message)
                            message = {"type": "viz", "role": "details-result", "data": result}
                            await manager.send_to_component("viz", message)
                        except Exception as e:
                            print(f"Error handling viz details: {e}")
                            await manager.send_to_component("viz", {
                                "type": "viz", 
                                "role": "details-result", 
                                "data": {"error": str(e)}
                            })
                        continue

                    # print("Viz received")
                    # message = await lorax_handler.handle_viz(message)
                    # await manager.send_to_component("viz", message)
                    continue

                # Broadcast to all connected clients
                connected_clients = manager.get_connected_clients()
                for client in connected_clients:
                    print("Sending message to client", message)
                    await manager.send_message(client, message)
            except Exception as e:
                print(f"Error processing message: {e}")
                # Don't disconnect for message processing errors, just log them
                continue
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
        print("Client disconnected")
    except Exception as e:
        print(f"Unexpected error: {e}")
        await manager.disconnect(websocket)