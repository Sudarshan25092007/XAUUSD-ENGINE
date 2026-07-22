from datetime import datetime, timezone

def get_utc_session(dt_utc: datetime) -> str:
    """
    Maps a UTC datetime to a major forex session:
    SYDNEY, TOKYO, LONDON, or NEW_YORK.

    Priority: When sessions overlap, the higher-liquidity session wins.
    TOKYO > SYDNEY during their overlap (0-6 UTC).
    LONDON > TOKYO during their overlap (8-9 UTC).
    NEW_YORK > LONDON during their overlap (13-16 UTC).
    """
    hour = dt_utc.hour

    # NEW_YORK: 13:00 - 21:00 UTC (wins overlap with London 13-16)
    if 13 <= hour < 21:
        return "NEW_YORK"

    # LONDON: 8:00 - 16:00 UTC (wins overlap with Tokyo 8-9)
    if 8 <= hour < 16:
        return "LONDON"

    # TOKYO: 0:00 - 9:00 UTC (wins overlap with Sydney 0-6)
    if 0 <= hour < 9:
        return "TOKYO"

    # SYDNEY: 22:00 - 06:00 UTC (only when no other session is active)
    if 22 <= hour or hour < 6:
        return "SYDNEY"

    # Fallback (should never hit)
    return "SYDNEY"

class CandleAggregator:
    def __init__(self):
        self.ticks = []
        self.current_second = None

    def add_tick(self, tick: dict):
        """
        Accepts raw ticks. Handles tick spurts by aggregating in memory. 
        Returns a closed 1-second candle dict when a new second arrives, else None.
        """
        second = tick["timestamp"] // 1000

        if self.current_second is None:
            self.current_second = second

        # Tick spurt crosses a second boundary
        if second != self.current_second:
            candle = self._build_candle(self.ticks)
            self.ticks = [tick]
            self.current_second = second
            return candle

        self.ticks.append(tick)
        return None

    def _build_candle(self, ticks: list) -> dict:
        up_ticks = 0
        down_ticks = 0
        zero_ticks = 0
        
        # Calculate directional flow
        for i in range(1, len(ticks)):
            if ticks[i]["bid"] > ticks[i-1]["bid"]:
                up_ticks += 1
            elif ticks[i]["bid"] < ticks[i-1]["bid"]:
                down_ticks += 1
            else:
                zero_ticks += 1
                
        dt_utc = datetime.fromtimestamp(self.current_second, tz=timezone.utc)
        session = get_utc_session(dt_utc)
                
        # Extremely lightweight dict
        return {
            "symbol": ticks[0]["symbol"],
            "second_ts": self.current_second,
            "open": ticks[0]["bid"],
            "high": max(t["bid"] for t in ticks),
            "low": min(t["bid"] for t in ticks),
            "close": ticks[-1]["bid"],
            "spread_avg": sum(t["spread"] for t in ticks) / len(ticks),
            "tick_count": len(ticks),
            "up_ticks": up_ticks,
            "down_ticks": down_ticks,
            "zero_ticks": zero_ticks,
            "session": session
        }
