"""Compact graph protocol implementation for artifact genealogies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import numpy as np

from lorax.artifacts.csr_reader import GenealogyCSR
from lorax.tree_graph.time_scale import times_to_y


@runtime_checkable
class GenealogyGraphProtocol(Protocol):
    @property
    def node_ids(self) -> np.ndarray: ...

    def has_node(self, node_id: int) -> bool: ...
    def parent_of(self, node_id: int) -> int: ...
    def children(self, node_id: int) -> np.ndarray: ...
    def is_tip(self, node_id: int) -> bool: ...
    def roots(self) -> np.ndarray: ...
    def ancestors(self, node_id: int) -> list[int]: ...
    def descendants(self, node_id: int) -> list[int]: ...
    def edges(self) -> set[tuple[int, int]]: ...
    def node_time(self, node_id: int) -> float: ...
    def node_x(self, node_id: int) -> float: ...


@dataclass(frozen=True)
class CompactGenealogyGraph:
    genealogy: GenealogyCSR
    time: np.ndarray
    x: np.ndarray
    y: np.ndarray

    @classmethod
    def from_genealogy(
        cls,
        genealogy: GenealogyCSR,
        *,
        global_min_time: float,
        global_max_time: float,
        time_scale: str = "linear",
    ) -> "CompactGenealogyGraph":
        return cls(
            genealogy=genealogy,
            time=np.asarray(genealogy.node_times, dtype=np.float64),
            x=np.asarray(genealogy.layout_x, dtype=np.float32),
            y=times_to_y(
                genealogy.node_times,
                global_min_time,
                global_max_time,
                time_scale,
            ).astype(np.float32),
        )

    @property
    def tree_index(self) -> int:
        return self.genealogy.tree_index

    @property
    def node_ids(self) -> np.ndarray:
        return self.genealogy.node_ids

    def node_offset(self, node_id: int) -> int:
        return self.genealogy.node_offset(node_id)

    def has_node(self, node_id: int) -> bool:
        return self.genealogy.has_node(node_id)

    def parent_of(self, node_id: int) -> int:
        return self.genealogy.parent(node_id)

    def children(self, node_id: int) -> np.ndarray:
        return self.genealogy.children(node_id)

    def is_tip(self, node_id: int) -> bool:
        return self.genealogy.is_tip(node_id)

    def node_time(self, node_id: int) -> float:
        return float(self.time[self.node_offset(node_id)])

    def node_x(self, node_id: int) -> float:
        return float(self.x[self.node_offset(node_id)])

    def node_y(self, node_id: int) -> float:
        return float(self.y[self.node_offset(node_id)])

    def edges(self) -> set[tuple[int, int]]:
        return self.genealogy.edges()

    def roots(self) -> np.ndarray:
        return self.genealogy.roots()

    def ancestors(self, node_id: int) -> list[int]:
        return self.genealogy.ancestors(node_id)

    def descendants(self, node_id: int) -> list[int]:
        return self.genealogy.descendants(node_id)


@dataclass(frozen=True)
class LegacyTreeGraphAdapter:
    """Expose a dense legacy TreeGraph through the compact graph protocol."""

    graph: object

    @property
    def node_ids(self) -> np.ndarray:
        return np.flatnonzero(self.graph.in_tree).astype(np.int32)

    def has_node(self, node_id: int) -> bool:
        node_id = int(node_id)
        return 0 <= node_id < len(self.graph.in_tree) and bool(
            self.graph.in_tree[node_id]
        )

    def parent_of(self, node_id: int) -> int:
        return int(self.graph.parent[int(node_id)])

    def children(self, node_id: int) -> np.ndarray:
        return np.asarray(self.graph.children(int(node_id)), dtype=np.int32)

    def is_tip(self, node_id: int) -> bool:
        return bool(self.graph.is_tip(int(node_id)))

    def roots(self) -> np.ndarray:
        nodes = self.node_ids
        return nodes[np.asarray(self.graph.parent[nodes]) == -1]

    def ancestors(self, node_id: int) -> list[int]:
        path = [int(node_id)]
        while self.parent_of(path[-1]) != -1:
            path.append(self.parent_of(path[-1]))
        return path

    def descendants(self, node_id: int) -> list[int]:
        result: list[int] = []
        stack = [int(node_id)]
        while stack:
            current = stack.pop()
            children = self.children(current).tolist()
            result.extend(children)
            stack.extend(reversed(children))
        return result

    def edges(self) -> set[tuple[int, int]]:
        return {
            (self.parent_of(int(node_id)), int(node_id))
            for node_id in self.node_ids
            if self.parent_of(int(node_id)) != -1
        }

    def node_time(self, node_id: int) -> float:
        return float(self.graph.time[int(node_id)])

    def node_x(self, node_id: int) -> float:
        return float(self.graph.x[int(node_id)])


# TODO(csr): remove the remaining TreeGraph compatibility dependency once all
# genealogy consumers use the compact graph protocol directly.


__all__ = [
    "CompactGenealogyGraph",
    "GenealogyGraphProtocol",
    "LegacyTreeGraphAdapter",
]
