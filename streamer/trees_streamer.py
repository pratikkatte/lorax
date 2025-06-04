import asyncio
import websockets
import tskit
import orjson
import json
from trees_to_taxonium import start_end


def extract_info(start, end, ts):
    nwk_string, genome_positions, mutations, times = start_end(start, end, ts)

    data = json.dumps({
        "nwk": nwk_string,
        "genome_positions": genome_positions, 
        "mutations": mutations,
        "global_times": {'min_time':times[0],
                  'max_time': times[1],
                  'times': times[2]
                }
        })
    print("mutations", mutations)
    print("times", times)
    return data

def get_config(config, ts):

    intervals = [(tree.interval[0], tree.interval[1]) for tree in ts.trees()]
    config = {'intervals':intervals[1:]}
    data = json.dumps({
        "config": config
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
            
            elif metadata_msg['action']=='config':
                try:
                    values = metadata_msg['values']
                    data = get_config(values, ts)
                    await websocket.send(json.dumps({"status": 200, 'data':data}))
                except Exception as e:
                    print("config, error", e)
                    await websocket.send(json.dumps({"status": "error", "message": f"Failed to get config: {str(e)}"}))


                



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