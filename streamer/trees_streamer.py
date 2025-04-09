# from fastapi import FastAPI, WebSocket, WebSocketDisconnect
# import tskit
# import asyncio
# import json
# import orjson


# from fastapi.middleware.cors import CORSMiddleware
# from trees_to_taxonium import start_end

# app = FastAPI()
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# async def stream_tree_data(ws: WebSocket, ts, start, end):
#     try:
#         print("start", start, end)
#         output, new_data = start_end(start, end, ts)
#         # output = orjson.dumps(new_data)
#         # new_data = {'nodes':"hello", "hello":"nodes"}
#         output = json.dumps(new_data)
#         # print(output)
#         await ws.send_json({"status": "processed", "file": output})

#         print("data sent")
#         await asyncio.sleep(0.3)
#     except Exception as e:
#         print("errror:", e)
#         await ws.send_json({"error": str(e)})
#         # await ws.close()

# @app.websocket("/stream")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     print("websocket connection established.")
#     ts = tskit.load("./sample.trees")
#     try:
#         while True:

#             # Receive file path from Node.js client

#             data = await websocket.receive_text()
#             print("data", data)
#             config = json.loads(data)

#             start = config.get("start")
#             end = config.get("end")

#             # file_path = config.get("filePath", "example.trees")

#             # if type(file_path) == int:
#             #     print("true")
#             # else:
#             #     print("false")

#             # Validate file path
#             # if not file_path.endswith(".trees"):
#             #     raise ValueError("Invalid file format. Expected .trees file")

#             # await websocket.send_json({"status": "processing", "file": file_path})
#             await stream_tree_data(websocket, ts, start, end)
            
#     except WebSocketDisconnect as e:
#         print(f"WebSocket disconnected: {e}")
#     except json.JSONDecodeError:
#         print("errror:")
#         await websocket.send_json({"error": "Invalid JSON format"})
#         # await websocket.close()
#     except Exception as e:
#         print("errror:", e)
#         await websocket.send_json({"error": str(e)})
#         # await websocket.close()


import asyncio
import websockets
import tskit
import orjson
import json
from trees_to_taxonium import start_end

async def handle_connection(websocket):
    print("Python WebSocket connected")
    # ts = tskit.load("./sample.trees")  # Load tree sequence once
    ts = None
    try:
        async for message in websocket:
            data = orjson.loads(message)
            action = data.get("action")
            if action == 'load_file':
                
                path = data.get("path")

                ts = tskit.load(path)
                start = 227217
                end = 227326
            else:
                start = data.get("start")
                end = data.get("end")


            output, new_data = start_end(start, end, ts)

            output = json.dumps(new_data)
            
            # Your processing logic here
            # output = {"nodes": "processed_data", "start": start, "end": end}
           
            await websocket.send(orjson.dumps({"status": "success", "data": output}))

            # await websocket.send(orjson.dumps({"status": "success", "data": output}))
    except Exception as e:
        await websocket.send(orjson.dumps({"status": "error", "message": str(e)}))
        print("Error:", e)

# Create and run the event loop explicitly
async def main():
    async with websockets.serve(handle_connection, "localhost", 8765):
        print("WebSocket server started on ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())  # Properly initialize the event loop