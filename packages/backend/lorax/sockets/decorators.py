"""
Socket event decorators for Lorax.

Provides common patterns as decorators to reduce boilerplate:
- Session validation
- File loaded checks
- CSV not supported handling
- Error wrapping
"""

import functools
from typing import Callable, Any

from lorax.context import session_manager
from lorax.constants import ERROR_SESSION_NOT_FOUND, ERROR_NO_FILE_LOADED
from lorax.sockets.utils import is_csv_session_file


async def require_session(lorax_sid: str, socket_sid: str, sio) -> Any:
    """
    Get session or emit error to client.

    Returns the session if found, None otherwise.
    """
    session = await session_manager.get_session(lorax_sid)
    if not session:
        await sio.emit("error", {
            "code": ERROR_SESSION_NOT_FOUND,
            "message": "Session expired. Please refresh the page."
        }, to=socket_sid)
        return None
    return session


def with_session(sio):
    """
    Decorator that validates session before executing handler.

    The decorated function must accept (sid, data) and data must contain 'lorax_sid'.
    Passes session as third argument to the handler.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(sid, data):
            lorax_sid = data.get("lorax_sid")
            session = await require_session(lorax_sid, sid, sio)
            if not session:
                return
            return await func(sid, data, session)
        return wrapper
    return decorator


def with_file_loaded(sio, error_event: str = "error"):
    """
    Decorator that validates file is loaded before executing handler.

    Must be used after @with_session. The handler receives (sid, data, session).
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(sid, data, session):
            if not session.file_path:
                print(f"⚠️ No file loaded for session {data.get('lorax_sid')}")
                await sio.emit(error_event, {
                    "code": ERROR_NO_FILE_LOADED,
                    "message": "No file loaded. Please load a file first."
                }, to=sid)
                return
            return await func(sid, data, session)
        return wrapper
    return decorator


def csv_not_supported(sio, result_event: str, empty_result: dict = None):
    """
    Decorator that returns early with message if file is CSV.

    Must be used after @with_session. The handler receives (sid, data, session).
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(sid, data, session):
            if is_csv_session_file(session.file_path):
                result = empty_result if empty_result else {"error": f"{func.__name__} is not supported for CSV yet."}
                await sio.emit(result_event, result, to=sid)
                return
            return await func(sid, data, session)
        return wrapper
    return decorator


def socket_error_handler(sio, result_event: str = "error"):
    """
    Decorator that wraps handler in try/except and emits errors.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                print(f"❌ {func.__name__} error: {e}")
                # For callback-style handlers (return dict), return error
                # For emit-style handlers, emit error
                if result_event:
                    sid = args[0] if args else None
                    if sid:
                        await sio.emit(result_event, {"error": str(e)}, to=sid)
                return {"error": str(e)}
        return wrapper
    return decorator
