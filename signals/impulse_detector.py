class ImpulseDetector:
    def __init__(self):
        # These will be tuned later
        self.MIN_TICK_COUNT = 7
        self.MIN_RANGE = 0.6
        self.MAX_SPREAD = 0.25

    def detect(self, candle):
        rng = candle["high"] - candle["low"]
        ticks = candle["tick_count"]
        spread = candle["spread_avg"]

        # ❌ liquidity stress filter
        if spread > self.MAX_SPREAD:
            return "NO_SIGNAL"

        # ❌ not enough activity
        if ticks < self.MIN_TICK_COUNT:
            return "NO_SIGNAL"

        # ❌ not enough expansion
        if rng < self.MIN_RANGE:
            return "NO_SIGNAL"

        # ✅ impulse detected
        if candle["close"] > candle["open"]:
            return "IMPULSE_UP"
        else:
            return "IMPULSE_DOWN"
