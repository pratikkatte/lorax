"""Pip-installed Lorax application defaults."""

import os

# The ``lorax`` and ``lorax-arg`` entry points run the bundled, single-port
# application in local mode. Prefer adjacent preprocessed CSR artifacts there
# when they are available, while preserving an explicit user opt-out.
os.environ.setdefault("LORAX_CSR_ARTIFACTS_ENABLED", "1")

__all__ = ["__version__"]

__version__ = "0.1.0"
