import os
from dotenv import load_dotenv
from lorax.session_manager import SessionManager

load_dotenv()

# Shared Global State
# We initialize the SessionManager here to ensure a singleton instance
# This is critical for in-memory mode so routes and sockets share the same session store

REDIS_URL = os.getenv("REDIS_URL", None)
session_manager = SessionManager(REDIS_URL)

# Common Environment Variables
IS_VM = os.getenv("IS_VM", False)
BUCKET_NAME = os.getenv("BUCKET_NAME", 'lorax_projects')
