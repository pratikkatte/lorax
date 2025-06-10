# handlers.py

from lorax.chat.langgraph_tskit import api_interface

async def handle_ping(message):
    print("Ping received")
    # Optionally send a pong or just ignore

async def handle_chat(message):
    print("Chat received")
    llm_output = api_interface(message.get("message"), '../data/sample.trees')
    print("llm_output", llm_output)
    message = {"type": "chat", "data": llm_output}
    return message

async def handle_viz(message):
    """
    action: 
    query_trees:
        values: [start, end]
    """
    print("Viz received")
    if message.get("action") == 'query_trees':
        print("query_trees", message)
    message = {"type": "viz", "data": "Your message was received! --> " + message.get("message")}
    return message
    # Add your viz logic here