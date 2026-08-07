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
    assert project["files"] == [
        {"name": healthy.name, "display_name": "Chromosome 2"}
    ]
    assert project["display_name"] == "Phlag Avian — Stiller et al. (2024)"
    assert project["references"] == [
        {"label": "Dataset on Zenodo", "url": "https://zenodo.org/records/19713363"},
        {
            "label": "Stiller et al. (2024)",
            "url": "https://www.nature.com/articles/s41586-024-07323-1",
        },
        {
            "label": "Phlag",
            "url": "https://academic.oup.com/bioinformatics/article/42/Supplement_1/btag273/8726330",
        },
    ]
    assert phlag.resolve_phlag_source("Phlag Avian", healthy.name) == healthy.resolve()
    assert phlag.resolve_phlag_source("Phlag Avian", stale.name) is None
    assert phlag.resolve_phlag_source("Phlag Avian", "../notes.txt") is None


def test_mammalian_phlag_project_resolves_alltrees_source(monkeypatch, tmp_path):
    source = tmp_path / "alltrees.tree.gz"
    source.write_text("source")
    monkeypatch.setenv("LORAX_PHLAG_MAMMALIAN_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(phlag.artifact_resolver, "resolve", lambda path: object())

    project = phlag.mammalian_project()

    assert project is not None
    assert project["files"] == [
        {"name": "alltrees.tree.gz", "display_name": "Mammals — Chromosome 3"}
    ]
    assert project["references"] == [
        {"label": "Dataset on Zenodo", "url": "https://zenodo.org/records/19713368"},
        {
            "label": "Source alignment study",
            "url": "https://www.science.org/doi/10.1126/science.abl8189",
        },
        {
            "label": "Phlag",
            "url": "https://academic.oup.com/bioinformatics/article/42/Supplement_1/btag273/8726330",
        },
    ]
    assert (
        phlag.resolve_phlag_source("Phlag Mammalian", "alltrees.tree.gz")
        == source.resolve()
    )
    assert phlag.resolve_phlag_source("Phlag Avian", "alltrees.tree.gz") is None


def test_decorate_phlag_projects_adds_provenance_metadata():
    projects = {
        "Phlag Avian": {"files": ["gene_trees-Stiller2024-chr2-sorted.nwk.gz"]},
        "Phlag Mammalian": {"files": ["alltrees.tree.gz"]},
    }

    phlag.decorate_phlag_projects(projects)

    assert projects["Phlag Avian"]["display_name"] == "Phlag Avian — Stiller et al. (2024)"
    assert projects["Phlag Avian"]["references"][0]["url"] == "https://zenodo.org/records/19713363"
    assert projects["Phlag Mammalian"]["references"][1]["url"] == "https://www.science.org/doi/10.1126/science.abl8189"
