import importlib
import os


def test_pip_app_enables_csr_artifacts_by_default(monkeypatch):
    monkeypatch.delenv("LORAX_CSR_ARTIFACTS_ENABLED", raising=False)

    import lorax_app

    importlib.reload(lorax_app)

    assert os.environ["LORAX_CSR_ARTIFACTS_ENABLED"] == "1"


def test_pip_app_preserves_explicit_artifact_setting(monkeypatch):
    monkeypatch.setenv("LORAX_CSR_ARTIFACTS_ENABLED", "false")

    import lorax_app

    importlib.reload(lorax_app)

    assert os.environ["LORAX_CSR_ARTIFACTS_ENABLED"] == "false"
