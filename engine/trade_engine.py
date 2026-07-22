# engine/trade_engine.py

class TradeEngine:
    def __init__(self, tp=1.2, sl=1.0, be_trigger=0.6):
        self.tp = tp
        self.sl = sl
        self.be_trigger = be_trigger
        self.active_trade = None

    def open_trade(self, impulse):
        """
        impulse = {
            second_ts,
            signal,
            price_1s,
            session
        }
        """

        direction = "SELL" if impulse["signal"] == "IMPULSE_UP" else "BUY"

        entry = impulse["price_1s"]

        trade = {
            "direction": direction,
            "entry": entry,
            "sl": entry + self.sl if direction == "SELL" else entry - self.sl,
            "tp": entry - self.tp if direction == "SELL" else entry + self.tp,
            "be_moved": False,
            "open": True,
            "second_ts": impulse["second_ts"],
            "session": impulse["session"]
        }

        self.active_trade = trade
        return trade

    def update(self, price):
        """
        Call this every tick or candle update
        """

        if not self.active_trade or not self.active_trade["open"]:
            return None

        t = self.active_trade
        direction = t["direction"]

        # --- BREAKEVEN LOGIC ---
        if not t["be_moved"]:
            if direction == "SELL":
                if t["entry"] - price >= self.be_trigger:
                    t["sl"] = t["entry"]
                    t["be_moved"] = True
            else:
                if price - t["entry"] >= self.be_trigger:
                    t["sl"] = t["entry"]
                    t["be_moved"] = True

        # --- EXIT CONDITIONS ---
        if direction == "SELL":
            if price <= t["tp"]:
                return self._close("TP")
            if price >= t["sl"]:
                return self._close("BE" if t["be_moved"] else "SL")

        else:
            if price >= t["tp"]:
                return self._close("TP")
            if price <= t["sl"]:
                return self._close("BE" if t["be_moved"] else "SL")

        return None

    def _close(self, outcome):
        self.active_trade["open"] = False
        self.active_trade["outcome"] = outcome
        closed_trade = self.active_trade
        self.active_trade = None
        return closed_trade
