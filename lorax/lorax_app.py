from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.websockets import WebSocket, WebSocketDisconnect
from lorax.manager import WebSocketManager
from fastapi.middleware.cors import CORSMiddleware
from lorax.handlers import handle_ping, handle_chat, handle_viz

app = FastAPI()

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
async def upload(request: Request):
    print("file uploaded!")
    await manager.send_to_component("viz", {"type": "viz", "data": "A new file was uploaded!"})
    await manager.send_to_component("chat", {"type": "chat", "data": "A new file was uploaded!"})

    return {"message": "file uploaded!"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await manager.register_component(websocket, "viz")
    await manager.register_component(websocket, "chat")
    
    try:
        while True:
            message = await websocket.receive_json()
            
            if message.get("type") == "ping":
                await handle_ping(message)
                continue  # ignore pings

            if message.get("type") == "chat":
                message = await handle_chat(message)
                await manager.send_to_component("chat", message)
                continue

            if message.get("type") == "viz":
                print("Viz received")
                message = await handle_viz(message)
                await manager.send_to_component("viz", message)
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