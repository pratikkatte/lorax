from __future__ import annotations

from click.testing import CliRunner

from lorax_app import cli


def test_jbrowse_requires_assembly_when_missing(monkeypatch, tmp_path):
    data_file = tmp_path / "erato-sara_chr2.csv"
    data_file.write_text("left,right\n", encoding="utf-8")
    served = False

    def fake_serve(**kwargs):
        nonlocal served
        served = True

    result = CliRunner().invoke(
        cli.main,
        ["--file", str(data_file), "--jbrowse"],
    )

    assert result.exit_code != 0
    assert served is False
    assert "--assembly is required when --jbrowse is used" in result.output
    assert "lorax --file path/to/file.trees --jbrowse --assembly hg19" in result.output
    assert "lorax --file path/to/file.trees --jbrowse --assembly hg38" in result.output
    assert "lorax --file path/to/file.trees --jbrowse --assembly /path/reference.fa.gz" in result.output
    assert "lorax --file path/to/file.trees --jbrowse --assembly /path/reference-folder" in result.output


def test_jbrowse_accepts_builtin_assembly_alias_without_prompt(monkeypatch, tmp_path):
    data_file = tmp_path / "1kg_chr2.trees.tsz"
    data_file.write_text("trees", encoding="utf-8")
    served = {}

    def fake_serve(**kwargs):
        served.update(kwargs)

    monkeypatch.setattr(cli, "_serve", fake_serve)

    result = CliRunner().invoke(
        cli.main,
        ["--file", str(data_file), "--jbrowse", "--assembly", "h38"],
    )

    assert result.exit_code == 0
    assert "Assembly" not in result.output
    assert served["assembly"] == "hg38"


def test_jbrowse_fasta_path_requires_index_files(monkeypatch, tmp_path):
    data_file = tmp_path / "erato-sara_chr2.csv"
    data_file.write_text("left,right\n", encoding="utf-8")
    fasta = tmp_path / "erato.fa.gz"
    fasta.write_text("fasta", encoding="utf-8")

    monkeypatch.setattr(cli, "_serve", lambda **kwargs: None)

    result = CliRunner().invoke(
        cli.main,
        ["--file", str(data_file), "--jbrowse", "--assembly", str(fasta)],
    )

    assert result.exit_code != 0
    assert "Missing FASTA index files" in result.output


def test_jbrowse_accepts_assembly_folder_with_fasta_indexes(monkeypatch, tmp_path):
    data_file = tmp_path / "erato-sara_chr2.csv"
    data_file.write_text("left,right\n", encoding="utf-8")
    assembly_dir = tmp_path / "assembly"
    assembly_dir.mkdir()
    fasta = assembly_dir / "erato.fa.gz"
    fai = assembly_dir / "erato.fa.gz.fai"
    gzi = assembly_dir / "erato.fa.gz.gzi"
    fasta.write_text("fasta", encoding="utf-8")
    fai.write_text("fai", encoding="utf-8")
    gzi.write_text("gzi", encoding="utf-8")
    served = {}

    def fake_serve(**kwargs):
        served.update(kwargs)

    monkeypatch.setattr(cli, "_serve", fake_serve)

    result = CliRunner().invoke(
        cli.main,
        ["--file", str(data_file), "--jbrowse", "--assembly", str(assembly_dir)],
    )

    assert result.exit_code == 0
    assert served["assembly"] == {
        "name": "erato",
        "fasta_path": str(fasta.resolve()),
        "fai_path": str(fai.resolve()),
        "gzi_path": str(gzi.resolve()),
    }


def test_jbrowse_assembly_folder_requires_one_fasta(monkeypatch, tmp_path):
    data_file = tmp_path / "erato-sara_chr2.csv"
    data_file.write_text("left,right\n", encoding="utf-8")
    assembly_dir = tmp_path / "assembly"
    assembly_dir.mkdir()
    (assembly_dir / "erato.fa").write_text("fasta", encoding="utf-8")
    (assembly_dir / "melpomene.fa").write_text("fasta", encoding="utf-8")

    monkeypatch.setattr(cli, "_serve", lambda **kwargs: None)

    result = CliRunner().invoke(
        cli.main,
        ["--file", str(data_file), "--jbrowse", "--assembly", str(assembly_dir)],
    )

    assert result.exit_code != 0
    assert "contains multiple FASTA files" in result.output
    assert "pass the FASTA path directly" in result.output
