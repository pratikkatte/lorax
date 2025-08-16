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

    async def cleanup_disconnected_clients(self):
        """Remove any disconnected clients from the lists"""
        disconnected_clients = []
        for client in self.connected_clients:
            if not self.is_connected(client):
                disconnected_clients.append(client)
        
        for client in disconnected_clients:
            await self.disconnect(client)
        
        if disconnected_clients:
            print(f"Cleaned up {len(disconnected_clients)} disconnected clients")

    def get_connected_clients(self):
        """Get list of currently connected clients"""
        return [client for client in self.connected_clients if self.is_connected(client)]

    def is_connected(self, websocket: WebSocket) -> bool:
        """Check if the WebSocket is still connected"""
        try:
            return (websocket in self.connected_clients and 
                   websocket.client_state.value == 1)
        except Exception:
            # If we can't check the state, assume disconnected
            return False

    async def send_message(self, websocket: WebSocket, message: dict):
        """Send message only if WebSocket is still connected"""
        if self.is_connected(websocket):
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error sending message to client: {e}")
                await self.disconnect(websocket)
        else:
            print("Attempted to send message to disconnected client")
            await self.disconnect(websocket)

    async def disconnect(self, websocket: WebSocket):
        if websocket in self.connected_clients:
            self.connected_clients.remove(websocket)
        if websocket in self.client_component:
            del self.client_component[websocket]

    async def register_component(self, websocket: WebSocket, component: str):
        if websocket not in self.client_component:
            self.client_component[websocket] = set()
        self.client_component[websocket].add(component)

    async def send_to_component(self, component: str, message):
        """Send message to all clients registered for a specific component"""
        disconnected_clients = []
        for ws, ws_component in self.client_component.items():
            if component in ws_component:
                if self.is_connected(ws):
                    print("Sending message to component", component)
                    try:
                        await self.send_message(ws, message)
                    except Exception as e:
                        print(f"Error sending to component {component}: {e}")
                        disconnected_clients.append(ws)
                else:
                    print(f"Client for component {component} is disconnected")
                    disconnected_clients.append(ws)
        
        # Clean up disconnected clients
        for ws in disconnected_clients:
            await self.disconnect(ws)