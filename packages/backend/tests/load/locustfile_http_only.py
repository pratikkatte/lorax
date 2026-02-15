"""
HTTP-only Locust file for Lorax backend load testing.

Use this when Socket.IO connections fail (e.g. WebSocket/proxy issues on deployment).
Same scenarios, but only LoraxHttpUser and LoraxMixedUser (no Socket.IO).

Usage:
    python scenarios.py smoke https://api.lorax.in --locustfile locustfile_http_only.py
    # Or with scenarios.py - requires passing -f locustfile_http_only.py via env or modifying scenarios
    locust -f locustfile_http_only.py --headless -u 50 -r 5 -t 5m --host https://api.lorax.in
"""

from locustfile import LoraxHttpUser, LoraxMixedUser

# Expose only HTTP user classes (no LoraxSocketUser)
__all__ = ["LoraxHttpUser", "LoraxMixedUser"]
