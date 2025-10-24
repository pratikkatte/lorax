from fastapi import (
    FastAPI, Request, Response, UploadFile, File,
    WebSocket, WebSocketDisconnect, status
)
from lorax.manager import WebSocketManager
from fastapi.middleware.cors import CORSMiddleware
from lorax.handlers import LoraxHandler
import shutil
import os
from pathlib import Path
import fastapi
import asyncio
from uuid import uuid4
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


# ────────────────────────────────
# Session store (in-memory)
# ────────────────────────────────
class Session:
    """Per-user session with its own LoraxHandler + WebSocketManager"""
    def __init__(self):
        self.handler = LoraxHandler()
        self.manager = WebSocketManager()
        self.pending_messages = []

    async def send_or_queue(self, component: str, message: dict):
        if self.manager.connected_clients:
            await self.manager.send_to_component(component, message)
        else:
            print(f"🕓 Queuing message for {component}: {message['role']}")
            self.pending_messages.append((component, message))

    async def flush_pending(self):
        """Send all queued messages once connected."""
        while self.pending_messages:
            comp, msg = self.pending_messages.pop(0)
            await self.manager.send_to_component(comp, msg)


sessions = {}               # sid → Session()
SESSION_COOKIE = "lorax_sid"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60   # 7 days


def get_or_create_session(request: Request, response: Response):
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid or sid not in sessions:
        sid = str(uuid4())
        sessions[sid] = Session()
        response.set_cookie(
            key=SESSION_COOKIE,
            value=sid,
            httponly=True,
            samesite="Lax",
            max_age=COOKIE_MAX_AGE
        )
    return sid, sessions[sid]

# ────────────────────────────────
# Routes
# ────────────────────────────────
@app.get("/healthz")
async def healthz():
    return {"ok": True}

@app.get('/projects')
async def projects():
    projects = await lorax_handler.get_projects(UPLOAD_DIR)
    return {"projects": projects}

# @app.get('/test')
# async def test(request: Request):
#     file_name = "sample.trees"
#     file_path = UPLOAD_DIR / file_name
#     viz_config, chat_config = await lorax_handler.handle_upload(file_path)

#     await manager.send_to_component("viz", {
#             "type": "viz", 
#             "role": "config",
#             "data": viz_config,
#         })

#     await manager.send_to_component("chat", {
#         "type": "chat", 
#         "role": "assistant",
#         "data": chat_config # send the config to the chat component  
#     })
    
#     return {
#         "message": "File uploaded successfully",
#         "filename": file_name,
#         "file_path": str(file_path)
#     }

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

    try:
        if file_path:
            viz_config, chat_config = await lorax_handler.handle_upload(file_path)
            viz_config['value'] = [genomiccoordstart, genomiccoordend]
        else:
            viz_config, chat_config = {"data": "no file"}, {"data": "no file"}  # Or handle differently
        
        
        await manager.send_to_component("viz", {
            "type": "viz", 
            "role": "config",
            "data": viz_config,
        })
        
    except Exception as e:
        print(f"Error loading file: {e}")
        return {"error": str(e)}  

    return {
        "file_path": str(file_path) if file_path else None,
        "project": project,
        "chrom": chrom,
        "genomiccoordstart": genomiccoordstart,
        "genomiccoordend": genomiccoordend,
        "regionstart": regionstart,
        "regionend": regionend,
    }


from fastapi import status
from fastapi.responses import JSONResponse

@app.post('/load_file')
async def load_file(request: Request, response: Response):
    """Reload an existing file for this session."""
    sid, session = get_or_create_session(request, response)
    data = await request.json()
    project = data.get("project")
    print("data", data);
    filename = data.get("file")

    if not filename:
        return JSONResponse(status_code=400, content={"error": "Missing 'file'."})
    
    if project == 'uploads':
        file_path = UPLOAD_DIR / sid / filename
    else:
        file_path = UPLOAD_DIR / project / filename

    if not file_path.exists():
        return JSONResponse(status_code=404, content={"error": "File not found."})

    viz_config, chat_config = await session.handler.handle_upload(str(file_path))

    # await session.manager.send_to_component("viz", {
    #     "type": "viz", "role": "config", "data": viz_config
    # })

    await session.send_or_queue("viz", {"type": "viz", "role": "config", "data": viz_config})

    # await session.manager.send_to_component("chat", {
    #     "type": "chat", "role": "assistant", "data": chat_config
    # })

    return {"message": "File loaded", "sid": sid, "filename": filename}

    # try:
    #     form_data = await request.json()
    #     project = form_data.get("project")
    #     file = form_data.get("file")
    #     file_path = UPLOAD_DIR / project / file
    #     viz_config, chat_config = await lorax_handler.handle_upload(file_path)
    #     await manager.send_to_component("viz", {
    #         "type": "viz", 
    #         "role": "config",
    #         "data": viz_config,
    #     })

    #     await manager.send_to_component("chat", {
    #         "type": "chat", 
    #         "role": "assistant",
    #         "data": chat_config # send the config to the chat component  
    #     })
        
    #     return {
    #         "message": "File uploaded successfully",
    #         "filename": file,
    #         "file_path": str(file_path)
    #     }

    # except Exception as e:
    #     print(f"Error loading file: {e}")
    #     return JSONResponse(
    #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #         content={"error": str(e)}
    #     )

@app.post('/upload')
# async def upload(file: UploadFile = File(...)):
async def upload(request: Request, response: Response, file: UploadFile = File(...)):

    """
    """
    sid, session = get_or_create_session(request, response)
    user_dir = UPLOAD_DIR / sid
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / file.filename
    
    try:
        # Save file to disk
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                await f.write(chunk)

        # Load tree sequence
        viz_config, chat_config = await session.handler.handle_upload(str(file_path))


        # Notify only this user's WebSocket(s)
        # await session.manager.send_to_component("viz", {
        #     "type": "viz", "role": "config", "data": viz_config
        # })

        await session.send_or_queue("viz", {"type": "viz", "role": "config", "data": viz_config})
        # await session.manager.send_to_component("chat", {
        #     "type": "chat", "role": "assistant", "data": chat_config
        # })

        return {"message": "File uploaded", "sid": sid, "filename": file.filename}

    except Exception as e:
        print(f"❌ Upload error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

    # try:
    #     # Create a safe file path
    #     form_data = await request.form()
    #     file = form_data.get("file")
    #     filename = form_data.get("filename") or file.filename

    #     file_path = UPLOAD_DIR / filename
        
    #     start = time.time()
    #     # Stream 1MB chunks to disk (no memory blow-up)
    #     async with aiofiles.open(file_path, "wb") as f:
    #         # Read in chunks to handle large files efficiently
    #         chunk_size = 10240 * 10240 # 1MB chunks
    #         while content := await file.read(chunk_size):
    #             await f.write(content)

    #     # Notify components about the upload
    #     viz_config, chat_config = await lorax_handler.handle_upload(file_path)

    #     # Only send to connected components

    #      # Only send to connected clients
    #     await manager.send_to_component("viz", {
    #         "type": "viz", 
    #         "role": "config",
    #         "data": viz_config,
    #     })

    #     await manager.send_to_component("chat", {
    #         "type": "chat", 
    #         "role": "assistant",
    #         "data": chat_config # send the config to the chat component  
    #     })
        
    #     return {
    #         "message": "File uploaded successfully",
    #         "filename": filename,
    #         "file_path": str(file_path)
    #     }

    # except Exception as e:
    #     print(f"Upload error: {e}")
    #     return {"error": str(e)}
    # finally:
    #     file.file.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Each browser gets its own WebSocketManager via session ID."""
    # Track tasks per-connection
    sid = websocket.cookies.get(SESSION_COOKIE) or websocket.query_params.get("sid")

    # Fallback: create new session if missing (useful for dev)
    if not sid or sid not in sessions:
        sid = str(uuid4())
        print("new session", sid);
        sessions[sid] = Session()
    
    session = sessions[sid]
    manager = session.manager
    handler = session.handler

    await manager.connect(websocket)
    
    await manager.register_component(websocket, "viz")
    await manager.register_component(websocket, "chat")
    await manager.register_component(websocket, "ping")
    await session.flush_pending()


    active_tasks = {}

    try:
        while True:
            if not manager.is_connected(websocket):
                break

            message = await websocket.receive_json()
            mtype = message.get("type")
            role = message.get("role")

            if mtype == "ping":
                data = await handler.handle_ping(message)
                await manager.send_to_component("ping", data)
                continue

            if mtype == "viz" and role == "query":
                # Cancel previous query if running
                if "query" in active_tasks:
                    prev = active_tasks.pop("query")
                    if not prev.done():
                        prev.cancel()

                task = asyncio.create_task(handler.handle_query(message))
                active_tasks["query"] = task
                try:
                    result = await task
                    print("sending query result", sid);
                    await manager.send_to_component("viz", {
                        "type": "viz",
                        "role": "query-result",
                        "data": result
                    })
                except asyncio.CancelledError:
                    continue
                except Exception as e:
                    await manager.send_to_component("viz", {
                        "type": "viz",
                        "role": "query-result",
                        "data": {"error": str(e)}
                    })
                continue

            if mtype == "viz" and role == "details":
                if "details" in active_tasks:
                    prev = active_tasks.pop("details")
                    if not prev.done():
                        prev.cancel()

                task = asyncio.create_task(handler.handle_details(message))
                active_tasks["details"] = task
                try:
                    result = await task
                    await manager.send_to_component("viz", {
                        "type": "viz",
                        "role": "details-result",
                        "data": result
                    })
                except Exception as e:
                    await manager.send_to_component("viz", {
                        "type": "viz",
                        "role": "details-result",
                        "data": {"error": str(e)}
                    })
                continue

            # Fallback: echo to all sockets in this session only
            for client in manager.connected_clients:
                await manager.send_message(client, message)

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected for {sid}")
    except Exception as e:
        print(f"❗ WebSocket error ({sid}): {e}")
    finally:
        for t in active_tasks.values():
            if not t.done():
                t.cancel()
        active_tasks.clear()
        await manager.disconnect(websocket)
    
    # try:
    #     # --- Connection setup is NOW INSIDE the try block ---
    #     await manager.connect(websocket)
    #     await manager.register_component(websocket, "viz")
    #     await manager.register_component(websocket, "chat")
    #     await manager.register_component(websocket, "ping")

    #     # No need to call cleanup_disconnected_clients() here,
    #     # your send_to_component logic already handles it well.

    #     while True:
    #         # This is the single point of failure we need to watch.
    #         # It will raise WebSocketDisconnect automatically.
    #         message = await websocket.receive_json()

    #         # --- PING ---
    #         if message.get("type") == "ping":
    #             data = await lorax_handler.handle_ping(message)
    #             await manager.send_to_component("ping", data)
    #             continue

    #         # --- VIZ REQUESTS ---
    #         if message.get("type") == "viz":
    #             role = message.get("role")

    #             # --- Handle Frequent Queries (Cancellable) ---
    #             if role == "query":
    #                 try:
    #                     # Cancel previous query task
    #                     if "query" in active_tasks:
    #                         prev_task = active_tasks.pop("query")
    #                         if not prev_task.done():
    #                             prev_task.cancel()
    #                             print("🛑 Cancelled previous query task")

    #                     # Create and await new query task
    #                     current_task = asyncio.create_task(lorax_handler.handle_query(message))
    #                     active_tasks["query"] = current_task
    #                     result = await current_task

    #                     await manager.send_to_component("viz", {
    #                         "type": "viz",
    #                         "role": "query-result",
    #                         "data": result
    #                     })
    #                 except asyncio.CancelledError:
    #                     print("⚠️ Query task cancelled — skipping result send")
    #                     # Optionally send a 'cancelled' status
    #                 except Exception as e:
    #                     print(f"❌ Error handling viz query: {e}")
    #                     # Send error state to UI
    #                 continue

    #             # --- Handle Details (Cancellable) ---
    #             if role == "details":
    #                 try:
    #                     # Cancel previous details task
    #                     if "details" in active_tasks:
    #                         prev_task = active_tasks.pop("details")
    #                         if not prev_task.done():
    #                             prev_task.cancel()
    #                             print("🛑 Cancelled previous details task")

    #                     # Create and await new details task
    #                     current_task = asyncio.create_task(lorax_handler.handle_details(message))
    #                     active_tasks["details"] = current_task
    #                     result = await current_task
                        
    #                     await manager.send_to_component("viz", {
    #                         "type": "viz",
    #                         "role": "details-result",
    #                         "data": result
    #                     })
    #                 except asyncio.CancelledError:
    #                     print("⚠️ Details task cancelled")
    #                 except Exception as e:
    #                     print(f"❌ Error handling viz details: {e}")
    #                 continue

    #         # --- FALLBACK (if you need it) ---
    #         # ...

    # except WebSocketDisconnect:
    #     # This is the expected, clean way a client disconnects.
    #     print(f"🔌 Client disconnected: {websocket.client}")
    
    # except Exception as e:
    #     # This catches any other unexpected errors in the loop.
    #     print(f"❗ Unexpected error: {e}")
    
    # finally:
    #     # This block runs NO MATTER WHAT (clean disconnect, or error).
    #     # It's the perfect place for cleanup.
    #     print(f"Cleaning up tasks and connection for {websocket.client}")
    #     for task in active_tasks.values():
    #         if not task.done():
    #             task.cancel()
    #     active_tasks.clear()
    #     await manager.disconnect(websocket)