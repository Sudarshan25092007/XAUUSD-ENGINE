# stream/tick_stream.py

from collections import deque
import time


class TickStream:
    def __init__(self, max_length=1000):
        self.ticks = deque(maxlen=max_length)

    def add_tick(self, tick):
        self.ticks.append(tick)

    def latest(self):
        if not self.ticks:
            return None
        return self.ticks[-1]

    def window(self, seconds):
        cutoff = int(time.time() * 1000) - (seconds * 1000)
        return [t for t in self.ticks if t["timestamp"] >= cutoff]
