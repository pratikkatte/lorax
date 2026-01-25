"""
Socket utility functions for Lorax.

Common helpers shared across socket event handlers.
"""


def is_csv_session_file(file_path: str | None) -> bool:
    """Check if the session file is a CSV file."""
    return bool(file_path) and str(file_path).lower().endswith(".csv")
