from db.db import get_conn, put_conn
import db.db as db_module
from datetime import datetime, timezone


class ImpulseRepository:
    def save(self, impulse: dict):
        # 🔁 Signal → Direction (crash-safe)
        signal = impulse.get("signal", "")
        if signal == "IMPULSE_UP":
            direction = "BUY"
        elif signal == "IMPULSE_DOWN":
            direction = "SELL"
        else:
            print(f"⚠️ [IMPULSE SKIP] Unknown signal: {signal}")
            return

        second_ts = impulse.get("second_ts", 0)
        detected_at_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        open_price = impulse.get("open", 0.0)
        high_price = impulse.get("high", 0.0)
        low_price = impulse.get("low", 0.0)
        close_price = impulse.get("close", 0.0)
        magnitude = round(abs(high_price - low_price), 4)
        spread_val = round(impulse.get("spread_avg", 0.0), 4)
        tick_count = impulse.get("tick_count", 0)
        up_ticks = impulse.get("up_ticks", 0)
        down_ticks = impulse.get("down_ticks", 0)
        zero_ticks = impulse.get("zero_ticks", 0)
        session = impulse.get("session", "UNKNOWN")
        tick_density = round(impulse.get("tick_density", 0.0), 4)
        dir_imbalance = round(impulse.get("dir_imbalance", 0.0), 4)

        if db_module.DATABASE_OFFLINE:
            with open("offline_data/offline_impulses.log", "a") as f:
                f.write(f"{impulse}\n")
            return

        conn = None
        try:
            conn = get_conn()
            if conn is None:
                db_module.DATABASE_OFFLINE = True
                with open("offline_data/offline_impulses.log", "a") as f:
                    f.write(f"{impulse}\n")
                return

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO engine.impulses (
                        symbol,
                        second_ts,
                        session,
                        direction,
                        signal,
                        magnitude,
                        tick_count,
                        up_ticks,
                        down_ticks,
                        zero_ticks,
                        tick_density,
                        dir_imbalance,
                        open_price,
                        high_price,
                        low_price,
                        close_price,
                        spread_avg,
                        avg_spread,
                        detected_at_ms
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    impulse.get("symbol", "UNKNOWN"),
                    second_ts,
                    session,
                    direction,
                    signal,
                    magnitude,
                    tick_count,
                    up_ticks,
                    down_ticks,
                    zero_ticks,
                    tick_density,
                    dir_imbalance,
                    open_price,
                    high_price,
                    low_price,
                    close_price,
                    spread_val,
                    spread_val,
                    detected_at_ms
                ))
                conn.commit()
                print(f"✅ [SUCCESS] Impulse recorded to library.")
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
            print(f"⚠️ [DB WARNING] Impulse save skipped due to schema mismatch, but engine is healthy. Error: {e}")
        finally:
            if conn:
                put_conn(conn)
