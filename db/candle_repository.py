from datetime import datetime
from db.db import get_conn, put_conn
import db.db as db_module
import logging

logger = logging.getLogger(__name__)

class CandleRepository:
    def save(self, candle):
        if db_module.DATABASE_OFFLINE:
            with open("offline_data/offline_candles.log", "a", encoding="utf-8") as f:
                f.write(f"CANDLE: TS={candle.get('second_ts')} | SESSION={candle.get('session')} | O={candle.get('open')} H={candle.get('high')} L={candle.get('low')} C={candle.get('close')}\n")
            return

        conn = None
        try:
            conn = get_conn()

            # OFFLINE BACKUP MODE (failsafe)
            if conn is None:
                db_module.DATABASE_OFFLINE = True
                with open("offline_data/offline_candles.log", "a", encoding="utf-8") as f:
                    f.write(f"CANDLE: TS={candle.get('second_ts')} | SESSION={candle.get('session')} | O={candle.get('open')} H={candle.get('high')} L={candle.get('low')} C={candle.get('close')}\n")
                return
                
            with conn.cursor() as cur:
                # Convert the second_ts to timestamp for the "time" column
                dt_time = datetime.fromtimestamp(candle.get("second_ts", 0))

                cur.execute("""
                    INSERT INTO engine.candles_1s (
                        symbol,
                        open,
                        high,
                        low,
                        close,
                        tick_count,
                        spread_avg,
                        second_ts,
                        time,
                        session
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    candle.get("symbol", "UNKNOWN"),
                    candle.get("open", 0.0),
                    candle.get("high", 0.0),
                    candle.get("low", 0.0),
                    candle.get("close", 0.0),
                    candle.get("tick_count", 0),
                    candle.get("spread_avg", 0.0),  # Correctly synced with CandleAggregator key
                    candle.get("second_ts", 0),
                    dt_time,
                    candle.get("session", "UNKNOWN")
                ))
                conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"❌ DB Candle Insert Failed: {e}")
        finally:
            if conn:
                put_conn(conn)
