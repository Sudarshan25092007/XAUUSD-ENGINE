# db/tick_repository.py
from datetime import datetime, timezone
from db.db import get_conn, put_conn
import db.db as db_module
import logging

logger = logging.getLogger(__name__)

class TickRepository:
    def save(self, tick: dict):
        if db_module.DATABASE_OFFLINE:
            with open("offline_data/offline_ticks.log", "a") as f:
                f.write(f"{tick}\n")
            return

        conn = None
        try:
            conn = get_conn()
            
            # OFFLINE BACKUP MODE (failsafe)
            if conn is None:
                db_module.DATABASE_OFFLINE = True
                with open("offline_data/offline_ticks.log", "a") as f:
                    f.write(f"{tick}\n")
                return

            with conn.cursor() as cur:
                # Use Python UTC arrival time as the authoritative timestamp
                # This fixes the 86-minute broker clock drift
                arrival_ms = tick.get("timestamp", 0)
                dt_time = datetime.fromtimestamp(arrival_ms / 1000.0, tz=timezone.utc)

                cur.execute("""
                    INSERT INTO engine.ticks (
                        symbol,
                        bid,
                        ask,
                        last,
                        volume,
                        time,
                        timestamp_ms
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (
                    tick.get("symbol", "UNKNOWN"),
                    tick.get("bid", 0.0),
                    tick.get("ask", 0.0),
                    tick.get("last", None),
                    tick.get("volume", None),
                    dt_time,
                    arrival_ms,
                ))
                conn.commit()
                print(f"✅ Saved Tick to Supabase: {tick.get('symbol')} Bid={tick.get('bid')} Ask={tick.get('ask')}")
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"❌ DB Tick Insert Failed: {e}")
            # We don't raise here! We let the engine keep running even if DB drops a tick.
        finally:
            if conn:
                put_conn(conn)
