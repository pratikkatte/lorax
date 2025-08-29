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
import fastapi

import time
import aiofiles

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

# @app.get('/')
# async def root(request: Request):
#     return {"message": "Hello, Loorax!"}

@app.get('/projects')
async def projects():
    projects = await lorax_handler.get_projects(UPLOAD_DIR)
    return {"projects": projects}

@app.get('/test')
async def test(request: Request):
    file_name = "sample.trees"
    file_path = UPLOAD_DIR / file_name
    viz_config, chat_config = await lorax_handler.handle_upload(file_path)

    await manager.send_to_component("viz", {
            "type": "viz", 
            "role": "config",
            "data": viz_config,
        })

    await manager.send_to_component("chat", {
        "type": "chat", 
        "role": "assistant",
        "data": chat_config # send the config to the chat component  
    })
    
    return {
        "message": "File uploaded successfully",
        "filename": file_name,
        "file_path": str(file_path)
    }

# @app.get("/{file}")
# async def get_file(file: str, project: str=None, chrom=None, genomiccoordstart: int=None, genomiccoordend: int=None, regionstart: int=None, regionend: int=None):
#     print("file_path", file) 
#     file_path = UPLOAD_DIR / project / file
    
#     viz_config, chat_config = await lorax_handler.handle_upload(file_path)
#     return {"file_path": str(file_path)}


from fastapi import Query
from typing import Optional

@app.get("/{file}")
async def get_file(
    file: Optional[str] = None,
    project: Optional[str] = Query(None),
    chrom: Optional[str] = Query(None),
    genomiccoordstart: Optional[int] = Query(None),
    genomiccoordend: Optional[int] = Query(None),
    regionstart: Optional[int] = Query(None),
    regionend: Optional[int] = Query(None)
):

    # Case 1: file provided in path
    if file and file != "" and file != "ucgb":
        file_path = UPLOAD_DIR / (project or "") / file
    else:
        # Case 2: no file in path (like just http://localhost:5173?...)
        file_path = None
        file = "1kg_chr20.trees.tsz"
        file_path = UPLOAD_DIR / (project or "1000Genomes") / file

    print("file_path", file_path)
    print("project", project)
    print("chrom", chrom)
    print("genomiccoordstart", genomiccoordstart)
    print("genomiccoordend", genomiccoordend)
    print("regionstart", regionstart)
    print("regionend", regionend)

    try:
        if file_path:
            viz_config, chat_config = await lorax_handler.handle_upload(file_path)
        else:
            viz_config, chat_config = {"data": "no file"}, {"data": "no file"}  # Or handle differently
    except Exception as e:
        print(f"Error loading file: {e}")
        return {"error": str(e)}  

    print("viz_config", file_path)
    return {
        "file_path": str(file_path) if file_path else None,
        "project": project,
        "chrom": chrom,
        "genomiccoordstart": genomiccoordstart,
        "genomiccoordend": genomiccoordend,
        "regionstart": regionstart,
        "regionend": regionend,
    }


@app.post('/load_file')
async def load_file(request: Request):
    try:
        form_data = await request.json()
        print("form_data", form_data)
        project = form_data.get("project")
        file = form_data.get("file")
        file_path = UPLOAD_DIR / project / file
        print("file_path", file_path)
        viz_config, chat_config = await lorax_handler.handle_upload(file_path)
        await manager.send_to_component("viz", {
            "type": "viz", 
            "role": "config",
            "data": viz_config,
        })

        await manager.send_to_component("chat", {
            "type": "chat", 
            "role": "assistant",
            "data": chat_config # send the config to the chat component  
        })
        
        return {
            "message": "File uploaded successfully",
            "filename": file,
            "file_path": str(file_path)
        }

    except Exception as e:
        print(f"Error loading file: {e}")
        return {"error": str(e)}

@app.post('/upload')
# async def upload(file: UploadFile = File(...)):
async def upload(request: Request):
    try:
        # Create a safe file path
        form_data = await request.form()
        file = form_data.get("file")
        filename = form_data.get("filename") or file.filename

        file_path = UPLOAD_DIR / filename
        
        start = time.time()
        # Stream 1MB chunks to disk (no memory blow-up)
        async with aiofiles.open(file_path, "wb") as f:
            # Read in chunks to handle large files efficiently
            chunk_size = 10240 * 10240 # 1MB chunks
            while content := await file.read(chunk_size):
                await f.write(content)

        # Notify components about the upload
        viz_config, chat_config = await lorax_handler.handle_upload(file_path)

        # Only send to connected components

         # Only send to connected clients
        await manager.send_to_component("viz", {
            "type": "viz", 
            "role": "config",
            "data": viz_config,
        })

        await manager.send_to_component("chat", {
            "type": "chat", 
            "role": "assistant",
            "data": chat_config # send the config to the chat component  
        })
        
        return {
            "message": "File uploaded successfully",
            "filename": filename,
            "file_path": str(file_path)
        }

    except Exception as e:
        print(f"Upload error: {e}")
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

                    continue

                # Broadcast to all connected clients
                connected_clients = manager.get_connected_clients()
                for client in connected_clients:
                    print("Sending message to client" )
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