"""
Realistic workflow Locust file: one cycle per user.

LoraxLoadUser: init_session -> projects -> load_file -> process_postorder_layout -> disconnect.
LoraxUploadUser: init_session -> upload -> load_file -> process_postorder_layout -> disconnect.

10 users = 10 requests per type (when all succeed). Uses LoraxLoadUser and/or LoraxUploadUser.

Control user mix via LOAD_TEST_USER_TYPE:
  - load   : only LoraxLoadUser (projects only)
  - upload : only LoraxUploadUser (upload then load from Uploads)
  - both   : 50/50 mix (default)

Requires Socket.IO. Set LOAD_TEST_FILE for deployment:
  export LOAD_TEST_FILE="1000Genomes:1kg_chr20.trees.tsz"
  python scenarios.py realistic https://api.lorax.in

Run from packages/backend/tests/load/ or use full path:
  cd packages/backend/tests/load && locust -f locustfile_realistic.py --host http://localhost:8080
"""

import os
import sys
from pathlib import Path

# Ensure locustfile can be imported when run from any directory
sys.path.insert(0, str(Path(__file__).resolve().parent))

from locustfile import LoraxLoadUser, LoraxUploadUser

user_type = os.getenv("LOAD_TEST_USER_TYPE", "both").lower()
if user_type == "load":
    del LoraxUploadUser
elif user_type == "upload":
    del LoraxLoadUser
# else: keep both for 50/50 mix
