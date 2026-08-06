#!/usr/bin/env python3
"""Exercise the installed wheel, including the first Numba compilation."""

from __future__ import annotations

from importlib import resources
from importlib.metadata import version

import numpy as np


def main() -> int:
    # This is the same JIT path that exposed the NumPy/SciPy ABI failure on the
    # server. Importing alone is insufficient because Numba compiles lazily.
    from lorax.tree_graph.tree_graph import _build_parent_local

    node_ids = np.asarray([10, 20, 30], dtype=np.int32)
    parent_ids = np.asarray([-1, 10, 10], dtype=np.int32)
    parent_local = _build_parent_local(node_ids, parent_ids, len(node_ids))
    np.testing.assert_array_equal(
        parent_local,
        np.asarray([-1, 0, 0], dtype=np.int32),
    )

    static_root = resources.files("lorax_app").joinpath("static")
    if not static_root.joinpath("index.html").is_file():
        raise RuntimeError("Wheel is missing lorax_app/static/index.html")

    from lorax_app.app import create_asgi_app

    app = create_asgi_app()
    if app is None:
        raise RuntimeError("Lorax ASGI application was not created")

    checked = ("lorax-arg", "numpy", "numba", "tskit", "pandas", "pyarrow")
    versions = ", ".join(f"{name}={version(name)}" for name in checked)
    print(f"Lorax installed-wheel smoke test passed ({versions})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
