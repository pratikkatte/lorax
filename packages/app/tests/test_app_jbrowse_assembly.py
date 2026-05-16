from __future__ import annotations

from fastapi.testclient import TestClient

from lorax_app.app import create_fastapi_app


def test_jbrowse_config_serves_custom_local_assembly(tmp_path):
    static_dir = tmp_path / "static"
    jbrowse_dir = static_dir / "jbrowse"
    jbrowse_dir.mkdir(parents=True)
    (jbrowse_dir / "index.html").write_text("<html></html>", encoding="utf-8")
    (static_dir / "lorax-plugin.js").write_text("", encoding="utf-8")

    fasta = tmp_path / "erato.fa.gz"
    fai = tmp_path / "erato.fa.gz.fai"
    gzi = tmp_path / "erato.fa.gz.gzi"
    fasta.write_text("fasta", encoding="utf-8")
    fai.write_text("fai", encoding="utf-8")
    gzi.write_text("gzi", encoding="utf-8")

    app = create_fastapi_app(
        static_dir=static_dir,
        jbrowse=True,
        filename="erato-sara_chr2.csv",
        assembly={
            "name": "erato",
            "fasta_path": str(fasta),
            "fai_path": str(fai),
            "gzi_path": str(gzi),
        },
    )
    client = TestClient(app)

    config = client.get("/config.json").json()
    assembly = config["assemblies"][0]
    adapter = assembly["sequence"]["adapter"]

    assert assembly["name"] == "erato"
    assert adapter["type"] == "BgzipFastaAdapter"
    assert adapter["fastaLocation"]["uri"] == "http://testserver/assembly/erato.fa.gz"
    assert adapter["faiLocation"]["uri"] == "http://testserver/assembly/erato.fa.gz.fai"
    assert adapter["gziLocation"]["uri"] == "http://testserver/assembly/erato.fa.gz.gzi"
    assert config["tracks"][0]["assemblyNames"] == ["erato"]

    assert client.get("/assembly/erato.fa.gz").text == "fasta"
