"""
Unit Tests for Deployment Mode Detection

Tests mode detection, configuration loading,
and environment variable handling.
"""

import pytest
import os
from unittest.mock import patch
from pathlib import Path


class TestModeDetection:
    """Tests for deployment mode detection."""

    def test_detect_mode_local_default(self, monkeypatch):
        """Test that local mode is default when no env vars set."""
        monkeypatch.delenv("LORAX_MODE", raising=False)
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.delenv("GCS_BUCKET_NAME", raising=False)
        monkeypatch.delenv("BUCKET_NAME", raising=False)
        monkeypatch.delenv("IS_VM", raising=False)

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "local"

    def test_detect_mode_explicit_local(self, monkeypatch):
        """Test explicit local mode setting."""
        monkeypatch.setenv("LORAX_MODE", "local")

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "local"

    def test_detect_mode_explicit_development(self, monkeypatch):
        """Test explicit development mode setting."""
        monkeypatch.setenv("LORAX_MODE", "development")

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "development"

    def test_detect_mode_explicit_production(self, monkeypatch):
        """Test explicit production mode setting."""
        monkeypatch.setenv("LORAX_MODE", "production")

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "production"

    def test_detect_mode_auto_production(self, monkeypatch):
        """Test auto-detection of production mode."""
        monkeypatch.delenv("LORAX_MODE", raising=False)
        monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
        monkeypatch.setenv("GCS_BUCKET_NAME", "test-bucket")

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "production"

    def test_detect_mode_auto_development_gcs(self, monkeypatch):
        """Test auto-detection of development mode with GCS."""
        monkeypatch.delenv("LORAX_MODE", raising=False)
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.setenv("GCS_BUCKET_NAME", "test-bucket")

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "development"

    def test_detect_mode_auto_development_vm(self, monkeypatch):
        """Test auto-detection of development mode with IS_VM."""
        monkeypatch.delenv("LORAX_MODE", raising=False)
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.delenv("GCS_BUCKET_NAME", raising=False)
        monkeypatch.setenv("IS_VM", "true")

        from lorax.modes import detect_mode
        mode = detect_mode()

        assert mode == "development"


class TestModeConfig:
    """Tests for mode configuration."""

    def test_local_mode_config(self, monkeypatch):
        """Test local mode configuration values."""
        monkeypatch.setenv("LORAX_MODE", "local")

        from lorax.modes import get_mode_config
        config = get_mode_config("local")

        assert config.mode == "local"
        assert config.ts_cache_size == 5
        assert config.disk_cache_enabled is False
        assert config.enforce_connection_limits is False
        assert config.require_redis is False
        assert config.require_gcs is False

    def test_development_mode_config(self, monkeypatch):
        """Test development mode configuration values."""
        from lorax.modes import get_mode_config
        config = get_mode_config("development")

        assert config.mode == "development"
        assert config.disk_cache_enabled is True
        assert config.enforce_connection_limits is False
        assert config.require_redis is False

    def test_production_mode_config(self, monkeypatch):
        """Test production mode configuration values."""
        from lorax.modes import get_mode_config
        config = get_mode_config("production")

        assert config.mode == "production"
        assert config.ts_cache_size == 2
        assert config.disk_cache_enabled is True
        assert config.enforce_connection_limits is True
        assert config.max_sockets_per_session == 5
        assert config.require_redis is True
        assert config.require_gcs is True

    def test_mode_config_env_override(self, monkeypatch):
        """Test that environment variables override defaults."""
        monkeypatch.setenv("TS_CACHE_SIZE", "10")
        monkeypatch.setenv("DISK_CACHE_MAX_GB", "100")

        from lorax.modes import get_mode_config
        config = get_mode_config("local")

        assert config.ts_cache_size == 10
        assert config.disk_cache_max_gb == 100


class TestDirectoryPaths:
    """Tests for directory path resolution."""

    def test_get_data_dir_local(self, monkeypatch):
        """Test data directory for local mode."""
        monkeypatch.setenv("LORAX_MODE", "local")
        monkeypatch.delenv("LORAX_DATA_DIR", raising=False)

        from lorax.modes import get_mode_config, get_data_dir
        config = get_mode_config("local")
        data_dir = get_data_dir(config)

        assert data_dir == Path.home() / ".lorax"

    def test_get_data_dir_custom(self, monkeypatch, temp_dir):
        """Test custom data directory."""
        monkeypatch.setenv("LORAX_DATA_DIR", str(temp_dir / "custom"))

        from lorax.modes import get_mode_config, get_data_dir
        config = get_mode_config()
        data_dir = get_data_dir(config)

        assert data_dir == temp_dir / "custom"

    def test_get_cache_dir_local(self, monkeypatch):
        """Test cache directory for local mode."""
        from lorax.modes import get_mode_config, get_cache_dir
        config = get_mode_config("local")
        cache_dir = get_cache_dir(config)

        assert cache_dir == config.data_dir / "cache"

    def test_get_cache_dir_development(self, monkeypatch):
        """Test cache directory for development mode."""
        from lorax.modes import get_mode_config, get_cache_dir
        config = get_mode_config("development")
        cache_dir = get_cache_dir(config)

        assert cache_dir == Path("/tmp/lorax_cache")

    def test_get_cache_dir_custom(self, monkeypatch, temp_dir):
        """Test custom cache directory."""
        monkeypatch.setenv("DISK_CACHE_DIR", str(temp_dir / "cache"))

        from lorax.modes import get_mode_config, get_cache_dir
        config = get_mode_config()
        cache_dir = get_cache_dir(config)

        assert cache_dir == temp_dir / "cache"


class TestModeValidation:
    """Tests for mode requirement validation."""

    def test_validate_local_mode(self, monkeypatch):
        """Test local mode validation always passes."""
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.delenv("GCS_BUCKET_NAME", raising=False)

        from lorax.modes import get_mode_config, validate_mode_requirements
        config = get_mode_config("local")
        errors = validate_mode_requirements(config)

        assert errors == []

    def test_validate_production_missing_redis(self, monkeypatch):
        """Test production mode fails without Redis."""
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.setenv("GCS_BUCKET_NAME", "test-bucket")

        from lorax.modes import get_mode_config, validate_mode_requirements
        config = get_mode_config("production")
        errors = validate_mode_requirements(config)

        assert len(errors) == 1
        assert "REDIS_URL" in errors[0]

    def test_validate_production_missing_gcs(self, monkeypatch):
        """Test production mode fails without GCS."""
        monkeypatch.setenv("REDIS_URL", "redis://localhost")
        monkeypatch.delenv("GCS_BUCKET_NAME", raising=False)
        monkeypatch.delenv("BUCKET_NAME", raising=False)

        from lorax.modes import get_mode_config, validate_mode_requirements
        config = get_mode_config("production")
        errors = validate_mode_requirements(config)

        assert len(errors) == 1
        assert "GCS_BUCKET_NAME" in errors[0]

    def test_validate_production_all_present(self, monkeypatch):
        """Test production mode passes with all requirements."""
        monkeypatch.setenv("REDIS_URL", "redis://localhost")
        monkeypatch.setenv("GCS_BUCKET_NAME", "test-bucket")

        from lorax.modes import get_mode_config, validate_mode_requirements
        config = get_mode_config("production")
        errors = validate_mode_requirements(config)

        assert errors == []
