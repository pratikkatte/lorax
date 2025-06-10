from fastapi.websockets import WebSocket
from datetime import datetime


class WebSocketManager:
    def __init__(self):
        self.connected_clients = []
        self.client_component = {}  # websocket: role

    async def connect(self, websocket: WebSocket):
        client_ip = f"{websocket.client.host}:{websocket.client.port}"


        # client has connected
        await websocket.accept()


        # add client to list of connected clients
        self.connected_clients.append(websocket)


        # send welcome message to the client
        message = {"client":client_ip,"message": f"Welcome {client_ip}"}

        await websocket.send_json(message)


    async def send_message(self, websocket: WebSocket, message: dict):
        print("Sending message to client", message)
        await websocket.send_json(message)

    async def disconnect(self, websocket: WebSocket):
        self.connected_clients.remove(websocket)
        self.client_component = {}

    async def register_component(self, websocket: WebSocket, component: str):
        print("Registering component", component)
        if websocket not in self.client_component:
            self.client_component[websocket] = set()
        self.client_component[websocket].add(component)

    async def send_to_component(self, component: str, message):
        for ws, ws_component in self.client_component.items():
            print(ws_component)
            if component in ws_component:
                await self.send_message(ws, message)