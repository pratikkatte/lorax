from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import tskit
import asyncio
import json
import orjson


from fastapi.middleware.cors import CORSMiddleware
from trees_to_taxonium import start_end

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def stream_tree_data(ws: WebSocket, ts, start, end):
    try:
        print("start", start, end)
        output, new_data = start_end(start, end, ts)
        # output = orjson.dumps(new_data)
        # new_data = {'nodes':"hello", "hello":"nodes"}
        output = json.dumps(new_data)
        # print(output)
        await ws.send_json({"status": "processed", "file": output})

        print("data sent")
        await asyncio.sleep(0.3)
    except Exception as e:
        print("errror:", e)
        await ws.send_json({"error": str(e)})
        # await ws.close()

@app.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("websocket connection established.")
    ts = tskit.load("./sample.trees")
    try:
        while True:

            # Receive file path from Node.js client

            data = await websocket.receive_text()
            print("data", data)
            config = json.loads(data)

            start = config.get("start")
            end = config.get("end")

            # file_path = config.get("filePath", "example.trees")

            # if type(file_path) == int:
            #     print("true")
            # else:
            #     print("false")

            # Validate file path
            # if not file_path.endswith(".trees"):
            #     raise ValueError("Invalid file format. Expected .trees file")

            # await websocket.send_json({"status": "processing", "file": file_path})
            await stream_tree_data(websocket, ts, start, end)
            
    except WebSocketDisconnect as e:
        print(f"WebSocket disconnected: {e}")
    except json.JSONDecodeError:
        print("errror:")
        await websocket.send_json({"error": "Invalid JSON format"})
        # await websocket.close()
    except Exception as e:
        print("errror:", e)
        await websocket.send_json({"error": str(e)})
        # await websocket.close()