from fastapi.websockets import WebSocket, WebSocketState, WebSocketDisconnect


class WebSocketManager:
    def __init__(self):
        self.connected_clients = set()
        self.client_component = {}  # websocket -> set(component names)

    async def connect(self, websocket: WebSocket):
        client_ip = f"{websocket.client.host}:{websocket.client.port}"
        await websocket.accept()
        self.connected_clients.add(websocket)

    async def cleanup_disconnected_clients(self):
        dead = [ws for ws in self.connected_clients if not self.is_connected(ws)]
        for ws in dead:
            await self.disconnect(ws)

    def get_connected_clients(self):
        """Get list of currently connected clients"""
        return [client for client in self.connected_clients if self.is_connected(client)]

    def is_connected(self, ws: WebSocket) -> bool:
        try:
            return ws.client_state == WebSocketState.CONNECTED
        except Exception:
            return False

    async def send_message(self, ws: WebSocket, message: dict):
        if self.is_connected(ws):
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"send_message error: {e}")
                await self.disconnect(ws)
        else:
            await self.disconnect(ws)

    async def disconnect(self, websocket: WebSocket):
        if websocket in self.connected_clients:
            self.connected_clients.remove(websocket)
        if websocket in self.client_component:
            del self.client_component[websocket]

    async def register_component(self, ws: WebSocket, component: str):
        self.client_component.setdefault(ws, set()).add(component)

    async def send_to_component(self, component: str, message: dict):
        """Send only to sockets in *this* session that registered that component."""
        targets = [
            ws for ws, comps in self.client_component.items()
            if component in comps and self.is_connected(ws)
        ]
        if not targets:
            print(f"⚠️ No sockets registered for component: {component}")
            return
        for ws in targets:
            await self.send_message(ws, message)
