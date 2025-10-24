from fastapi.websockets import WebSocket, WebSocketState, WebSocketDisconnect  # <-- Import WebSocketState
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.connected_clients = set()
        self.client_component = {}  # websocket -> set(component names)

    async def connect(self, websocket: WebSocket):
        client_ip = f"{websocket.client.host}:{websocket.client.port}"
        await websocket.accept()
        # self.connected_clients.append(websocket)
        self.connected_clients.add(websocket)
        
        # This message send can still fail if client disconnects
        # immediately, but now our endpoint will catch it.
        # try:
        #     message = {"client": client_ip, "message": f"Welcome {client_ip}"}
        #     await websocket.send_json(message)
        # except WebSocketDisconnect:
        #     print(f"Client {client_ip} disconnected before welcome message.")
        #     # We can just ignore this and let the endpoint's
        #     # finally block handle the disconnect.
        # except Exception as e:
        #     print(f"Error sending welcome message: {e}")

    async def cleanup_disconnected_clients(self):
            dead = [ws for ws in self.connected_clients if not self.is_connected(ws)]
            for ws in dead:
                await self.disconnect(ws)
    
    # async def cleanup_disconnected_clients(self):
    #     """Remove any disconnected clients from the lists"""

    #     self.connected_clients.discard(websocket)
    #     self.client_component.pop(websocket, None)
    #     try:
    #         await websocket.close()
    #     except Exception:
    #         pass
        # disconnected_clients = [
        #     client for client in self.connected_clients 
        #     if not self.is_connected(client)
        # ]
        
        # for client in disconnected_clients:
        #     await self.disconnect(client)
        
        # if disconnected_clients:
        #     print(f"Cleaned up {len(disconnected_clients)} disconnected clients")

    def get_connected_clients(self):
        """Get list of currently connected clients"""
        return [client for client in self.connected_clients if self.is_connected(client)]

    # def is_connected(self, websocket: WebSocket) -> bool:
    #     """Check if the WebSocket is still connected"""
    #     try:
    #         # --- Use the stable enum instead of a magic number ---
    #         return (websocket in self.connected_clients and 
    #                websocket.client_state == WebSocketState.CONNECTED)
    #     except Exception:
    #         # If we can't check the state, assume disconnected
    #         return False

    def is_connected(self, ws: WebSocket) -> bool:
        try:
            return ws.client_state == WebSocketState.CONNECTED
        except Exception:
            return False

    # async def send_message(self, websocket: WebSocket, message: dict):
    #     """Send message only if WebSocket is still connected"""
    #     if self.is_connected(websocket):
    #         try:
    #             await websocket.send_json(message)
    #         except Exception as e:
    #             # Catching RuntimeErrors or Disconnects here is good
    #             print(f"Error sending message to client, disconnecting: {e}")
    #             await self.disconnect(websocket)
    #     else:
    #         # This check is slightly redundant since send_to_component
    #         # also checks, but it doesn't hurt.
    #         await self.disconnect(websocket)

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

    # async def register_component(self, websocket: WebSocket, component: str):
    #     if websocket not in self.client_component:
    #         self.client_component[websocket] = set()
    #     self.client_component[websocket].add(component)

    async def register_component(self, ws: WebSocket, component: str):
        self.client_component.setdefault(ws, set()).add(component)

    # async def send_to_component(self, component: str, message):
    #     """Send message to all clients registered for a specific component"""
        
    #     if not self.client_component:
    #         print(f"⚠️ No clients connected — skipping send to {component}")
    #         return
    #     # Iterate over a copy in case disconnect() modifies the dict
    #     for ws, ws_components in list(self.client_component.items()):
    #         if component in ws_components:
    #             if self.is_connected(ws):
    #                 try:
    #                     if component != "ping":
    #                         print(f"Sending message to component {component}, client {ws.client.host}:{ws.client.port}")
    #                     await self.send_message(ws, message)
    #                 except Exception as e:
    #                     # send_message should handle disconnect, 
    #                     # but we catch errors here just in case.
    #                     print(f"Error sending to component {component}: {e}")
    #                     await self.disconnect(ws)
    #             else:
    #                 await self.disconnect(ws)

    async def send_to_component(self, component: str, message: dict):
        """Send only to sockets in *this* session that registered that component."""
        targets = [
            ws for ws, comps in self.client_component.items()
            if component in comps and self.is_connected(ws)
        ]
        print("targets", targets);
        if not targets:
            print(f"⚠️ No sockets registered for component: {component}")
            return
        for ws in targets:
            await self.send_message(ws, message)