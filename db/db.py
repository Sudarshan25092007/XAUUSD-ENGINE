# db/db.py
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

import logging

logger = logging.getLogger(__name__)

DATABASE_OFFLINE = False

# Persistent connection pool (reuse instead of connect/disconnect per tick)
_conn_pool = None


def get_conn():
    global DATABASE_OFFLINE, _conn_pool

    if DATABASE_OFFLINE:
        return None

    # Return existing connection if it's still alive
    if _conn_pool is not None:
        try:
            # Lightweight check: run a no-op query to verify connection health
            _conn_pool.cursor().execute("SELECT 1")
            return _conn_pool
        except Exception:
            # Connection died, clear it and reconnect below
            try:
                _conn_pool.close()
            except Exception:
                pass
            _conn_pool = None

    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not set - Continuing in Offline Mode")
        DATABASE_OFFLINE = True
        return None

    try:
        _conn_pool = psycopg2.connect(
            DATABASE_URL,
            sslmode="require",
            connect_timeout=2  # Fail fast — don't lag the tick loop
        )
        _conn_pool.autocommit = False
        print("🔗 [DB] Persistent connection established")
        return _conn_pool
    except Exception as e:
        print("⚠️ DB Connection Failed - Continuing in Offline Mode")
        logger.error(f"Postgres Connection Error: {e}")
        DATABASE_OFFLINE = True
        return None


def put_conn(conn):
    # Do NOT close the connection — keep it alive for reuse
    # Only rollback uncommitted state if needed
    pass