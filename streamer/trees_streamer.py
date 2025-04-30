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


def extract_info(start, end, ts):
    nwk_string, genome_positions = start_end(start, end, ts)
    data = json.dumps({
        "nwk": nwk_string,
        "genome_positions": genome_positions
        })
    return data
    
async def handle_connection(websocket):
    print("Python WebSocket connected")
    # ts = tskit.load("./sample.trees")  # Load tree sequence once
    ts = None
    try:

        while True:
            
            # metadata_msg = await websocket.recv()
            metadata_msg = await websocket.recv()
            metadata_msg = json.loads(metadata_msg)

            if metadata_msg['action']=='load_file':
                try:
                    metadata = json.loads(metadata_msg['meta'])
                    print("metadata", metadata)
                except Exception as e:
                    await websocket.send(json.dumps({"status": "error", "message": "Invalid metadata JSON"}))
                    continue
            

                if metadata.get("type") == 'fileUpload':
                    filename = metadata["filename"]
                    size = metadata["size"]

                    print(f"Expecting file: {filename}, size: {size} bytes")

                    print("before receiving here")
                    binary_data = await websocket.recv()  # This should be raw bytes
                    print("after receivign to receive")

                    
                    if not isinstance(binary_data, (bytes, bytearray)):
                        print("about to receive")
                        await websocket.send(json.dumps({"status": "error", "message": "Expected binary data"}))
                        continue
                    
                    path = f"/tmp/{filename}"
                    with open(path, "wb") as f:
                        f.write(binary_data)
                    print(f"Saved file to: {path}")

                    start = 227241
                    end = 227290
                    # end = 3022856

                    try:
                        if ts==None:
                            ts = tskit.load(path)
                        data = extract_info(start, end, ts)

                        
                        await websocket.send(json.dumps({"status": "file_received",'data':data,"filename": filename}))
                    except Exception as e:
                        print("eerror", e)
                        await websocket.send(json.dumps({"status": "error", "message": f"Failed to load .trees: {str(e)}"}))

            elif metadata_msg['action']=='query_trees':
                try:
                    values = metadata_msg['values']
                    print("values", values)
                    data = extract_info(values[0], values[1], ts)
                    await websocket.send(json.dumps({"status": 200, 'data':data}))
                except Exception as e:
                    print("query_trees, error", e)
                    await websocket.send(json.dumps({"status": "error", "message": f"Failed to query trees: {str(e)}"}))

    except Exception as e:
        print("Error:", e)
        await websocket.send(json.dumps({"status": "error", "message": str(e)}))
        

# Create and run the event loop explicitly
async def main():
    async with websockets.serve(handle_connection, "localhost", 8765, max_size=None, ping_interval=1, ping_timeout=300):
        print("WebSocket server started on ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())  # Properly initialize the event loop