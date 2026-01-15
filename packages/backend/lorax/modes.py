"""
Lorax Deployment Mode Detection and Configuration

Supports three deployment modes:
- local: Conda package / desktop use (single user, no Redis/GCS)
- development: Developer mode (single process, optional GCS)
- production: Cloud deployment (multi-worker, Redis + GCS required)
"""

import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class ModeConfig:
    """Configuration for a deployment mode."""
    mode: str
    ts_cache_size: int
    config_cache_size: int
    metadata_cache_size: int
    disk_cache_enabled: bool
    disk_cache_max_gb: int
    max_sockets_per_session: int
    enforce_connection_limits: bool
    data_dir: Path
    require_redis: bool
    require_gcs: bool


# Mode-specific defaults
MODE_CONFIGS = {
    "local": ModeConfig(
        mode="local",
        ts_cache_size=5,
        config_cache_size=2,
        metadata_cache_size=10,
        disk_cache_enabled=False,  # No GCS in local mode
        disk_cache_max_gb=10,
        max_sockets_per_session=100,  # Effectively unlimited
        enforce_connection_limits=False,
        data_dir=Path.home() / ".lorax",
        require_redis=False,
        require_gcs=False,
    ),
    "development": ModeConfig(
        mode="development",
        ts_cache_size=5,
        config_cache_size=2,
        metadata_cache_size=10,
        disk_cache_enabled=True,
        disk_cache_max_gb=10,
        max_sockets_per_session=100,  # Relaxed for testing
        enforce_connection_limits=False,
        data_dir=Path("UPLOADS"),
        require_redis=False,
        require_gcs=False,
    ),
    "production": ModeConfig(
        mode="production",
        ts_cache_size=2,  # Lower for memory efficiency with many workers
        config_cache_size=2,
        metadata_cache_size=5,
        disk_cache_enabled=True,
        disk_cache_max_gb=50,
        max_sockets_per_session=5,
        enforce_connection_limits=True,
        data_dir=Path("/var/lorax"),
        require_redis=True,
        require_gcs=True,
    ),
}


def detect_mode() -> str:
    """
    Detect the deployment mode based on environment variables.

    Priority:
    1. Explicit LORAX_MODE environment variable
    2. Auto-detect based on REDIS_URL and GCS_BUCKET_NAME
    3. Default to 'local' for conda package usage
    """
    explicit_mode = os.getenv("LORAX_MODE", "").lower()
    if explicit_mode in MODE_CONFIGS:
        return explicit_mode

    # Auto-detect based on environment
    has_redis = bool(os.getenv("REDIS_URL"))
    has_gcs = bool(os.getenv("GCS_BUCKET_NAME") or os.getenv("BUCKET_NAME"))
    is_vm = os.getenv("IS_VM", "").lower() in ("true", "1", "yes")

    if has_redis and has_gcs:
        return "production"
    elif has_gcs or is_vm:
        return "development"
    else:
        return "local"


def get_mode_config(mode: Optional[str] = None) -> ModeConfig:
    """
    Get configuration for a specific mode.

    Args:
        mode: Mode name or None to auto-detect

    Returns:
        ModeConfig with all settings for the mode
    """
    if mode is None:
        mode = detect_mode()

    config = MODE_CONFIGS.get(mode, MODE_CONFIGS["local"])

    # Apply environment overrides
    return ModeConfig(
        mode=config.mode,
        ts_cache_size=int(os.getenv("TS_CACHE_SIZE", config.ts_cache_size)),
        config_cache_size=int(os.getenv("CONFIG_CACHE_SIZE", config.config_cache_size)),
        metadata_cache_size=int(os.getenv("METADATA_CACHE_SIZE", config.metadata_cache_size)),
        disk_cache_enabled=config.disk_cache_enabled,
        disk_cache_max_gb=int(os.getenv("DISK_CACHE_MAX_GB", config.disk_cache_max_gb)),
        max_sockets_per_session=int(os.getenv("MAX_SOCKETS_PER_SESSION", config.max_sockets_per_session)),
        enforce_connection_limits=config.enforce_connection_limits,
        data_dir=Path(os.getenv("LORAX_DATA_DIR", config.data_dir)),
        require_redis=config.require_redis,
        require_gcs=config.require_gcs,
    )


def get_data_dir(mode_config: Optional[ModeConfig] = None) -> Path:
    """Get the data directory for the current mode."""
    if mode_config is None:
        mode_config = get_mode_config()
    return mode_config.data_dir


def get_uploads_dir(mode_config: Optional[ModeConfig] = None) -> Path:
    """Get the uploads directory for the current mode."""
    data_dir = get_data_dir(mode_config)
    return data_dir / "uploads" if mode_config and mode_config.mode == "local" else data_dir


def get_cache_dir(mode_config: Optional[ModeConfig] = None) -> Path:
    """Get the disk cache directory for the current mode."""
    if mode_config is None:
        mode_config = get_mode_config()

    cache_dir_env = os.getenv("DISK_CACHE_DIR")
    if cache_dir_env:
        return Path(cache_dir_env)

    if mode_config.mode == "local":
        return mode_config.data_dir / "cache"
    elif mode_config.mode == "development":
        return Path("/tmp/lorax_cache")
    else:
        return Path("/var/lorax/cache")


def validate_mode_requirements(mode_config: ModeConfig) -> list:
    """
    Validate that required services are available for the mode.

    Returns:
        List of validation errors (empty if all requirements met)
    """
    errors = []

    if mode_config.require_redis and not os.getenv("REDIS_URL"):
        errors.append(f"{mode_config.mode} mode requires REDIS_URL environment variable")

    if mode_config.require_gcs:
        bucket = os.getenv("GCS_BUCKET_NAME") or os.getenv("BUCKET_NAME")
        if not bucket:
            errors.append(f"{mode_config.mode} mode requires GCS_BUCKET_NAME environment variable")

    return errors


# Initialize on import
CURRENT_MODE = detect_mode()
CURRENT_CONFIG = get_mode_config(CURRENT_MODE)

print(f"Lorax mode: {CURRENT_MODE}")
