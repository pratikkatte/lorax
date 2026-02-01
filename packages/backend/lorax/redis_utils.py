import os
from typing import Optional, Tuple


def get_redis_config() -> Tuple[Optional[str], bool]:
    """
    Returns (redis_url, is_cluster).

    - REDIS_CLUSTER provides the cluster endpoint URL.
    """
    url = os.getenv("REDIS_CLUSTER")
    is_cluster = bool(url)
    return url, is_cluster


def create_redis_client(
    redis_url: Optional[str],
    *,
    decode_responses: bool,
    cluster: bool,
):
    if not redis_url:
        return None

    if cluster:
        from redis.asyncio.cluster import RedisCluster
        return RedisCluster.from_url(redis_url, decode_responses=decode_responses)

    import redis.asyncio as aioredis
    return aioredis.from_url(redis_url, decode_responses=decode_responses)
