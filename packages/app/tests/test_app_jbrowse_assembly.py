from __future__ import annotations

from fastapi.testclient import TestClient

from lorax_app.app import create_fastapi_app


def test_jbrowse_missing_static_js_returns_404_instead_of_html(tmp_path):
    static_dir = tmp_path / "static"
    jbrowse_dir = static_dir / "jbrowse"
    js_dir = jbrowse_dir / "static" / "js"
    js_dir.mkdir(parents=True)
    (jbrowse_dir / "index.html").write_text("<html></html>", encoding="utf-8")
    (js_dir / "main.12345678.js").write_text("console.log('ok')", encoding="utf-8")
    (static_dir / "lorax-plugin.js").write_text("", encoding="utf-8")

    app = create_fastapi_app(static_dir=static_dir, jbrowse=True, assembly="hg19")
    client = TestClient(app)

    response = client.get("/static/js/missing.chunk.js")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_lorax_missing_vite_asset_returns_404_instead_of_html(tmp_path):
    static_dir = tmp_path / "static"
    assets_dir = static_dir / "assets"
    assets_dir.mkdir(parents=True)
    (static_dir / "index.html").write_text("<html></html>", encoding="utf-8")
    (assets_dir / "index-12345678.js").write_text("console.log('ok')", encoding="utf-8")

    app = create_fastapi_app(static_dir=static_dir)
    client = TestClient(app)

    response = client.get("/assets/missing.js")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


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


def test_jbrowse_config_adds_hg19_reference_tracks_for_1000_genomes_file(tmp_path):
    static_dir = tmp_path / "static"
    jbrowse_dir = static_dir / "jbrowse"
    jbrowse_dir.mkdir(parents=True)
    (jbrowse_dir / "index.html").write_text("<html></html>", encoding="utf-8")
    (static_dir / "lorax-plugin.js").write_text("", encoding="utf-8")

    app = create_fastapi_app(
        static_dir=static_dir,
        jbrowse=True,
        filename="1kg_chr2.trees.tsz",
        assembly="hg19",
    )
    client = TestClient(app)

    config = client.get("/config.json").json()

    assert [track["trackId"] for track in config["tracks"]] == [
        "lorax_track",
        "hg19-ncbiRefSeq",
        "hg19-dbSnp153",
    ]
    assert config["tracks"][1]["adapter"]["type"] == "Gff3TabixAdapter"
    assert config["tracks"][1]["adapter"]["gffGzLocation"]["uri"] == (
        "https://jbrowse.org/ucsc/hg19/ncbiRefSeq.gff.gz"
    )
    assert config["tracks"][2]["adapter"]["type"] == "BigBedAdapter"
    assert config["tracks"][2]["adapter"]["bigBedLocation"]["uri"] == (
        "https://hgdownload.soe.ucsc.edu/gbdb/hg19/snp/dbSnp153.bb"
    )

    session_tracks = config["defaultSession"]["views"][0]["tracks"]
    assert [track["configuration"] for track in session_tracks] == [
        "hg19-ncbiRefSeq",
        "hg19-dbSnp153",
        "lorax_track",
    ]
    assert session_tracks[0]["type"] == "FeatureTrack"
    assert session_tracks[1]["type"] == "FeatureTrack"
    assert session_tracks[2]["type"] == "LoraxTrack"
