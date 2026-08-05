from pathlib import Path

import lorax.phlag as phlag


def test_phlag_lists_only_newick_sources_with_healthy_artifacts(monkeypatch, tmp_path):
    healthy = tmp_path / "gene_trees-Stiller2024-chr2-sorted.nwk.gz"
    stale = tmp_path / "gene_trees-Stiller2024-chr1-sorted.nwk.gz"
    unrelated = tmp_path / "notes.txt"
    for path in (healthy, stale, unrelated):
        path.write_text("source")

    monkeypatch.setenv("LORAX_PHLAG_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        phlag.artifact_resolver,
        "resolve",
        lambda source: object() if Path(source) == healthy else None,
    )

    project = phlag.phlag_project()

    assert project is not None
    assert project["files"] == [healthy.name]
    assert phlag.resolve_phlag_source("PHLaG", healthy.name) == healthy.resolve()
    assert phlag.resolve_phlag_source("PHLaG", stale.name) is None
    assert phlag.resolve_phlag_source("PHLaG", "../notes.txt") is None


def test_mammalian_phlag_project_resolves_alltrees_source(monkeypatch, tmp_path):
    source = tmp_path / "alltrees.tree.gz"
    source.write_text("source")
    monkeypatch.setenv("LORAX_PHLAG_MAMMALIAN_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(phlag.artifact_resolver, "resolve", lambda path: object())

    project = phlag.mammalian_project()

    assert project is not None
    assert project["files"] == ["alltrees.tree.gz"]
    assert (
        phlag.resolve_phlag_source("PHLaG Mammalian", "alltrees.tree.gz")
        == source.resolve()
    )
    assert phlag.resolve_phlag_source("PHLaG", "alltrees.tree.gz") is None
