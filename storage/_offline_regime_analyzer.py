import csv
import os
from collections import defaultdict
from datetime import datetime

DATA_DIR = "storage"
ROLLING_DAYS = 5        # ← you can change this to 5 later
MIN_SAMPLES = 100
FADE_THRESHOLD = 8.0


def load_recent_impulses():
    files = sorted([
        f for f in os.listdir(DATA_DIR)
        if f.startswith("impulses_") and f.endswith(".csv")
    ])

    recent_files = files[-ROLLING_DAYS:]
    rows = []

    for file in recent_files:
        with open(os.path.join(DATA_DIR, file), newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)

    return rows


def analyze():
    data = load_recent_impulses()

    buckets = defaultdict(list)

    for row in data:
        key = (row["session"], row["signal"])
        buckets[key].append(row["outcome"])

    print("\n📊 OFFLINE IMPULSE REGIME ANALYSIS")
    print(f"Using last {ROLLING_DAYS} days\n")

    for (session, signal), outcomes in buckets.items():
        total = len(outcomes)

        if total < MIN_SAMPLES:
            print(f"{session} | {signal}: skipped (only {total} samples)")
            continue

        rev = outcomes.count("REVERSAL")
        cont = outcomes.count("CONTINUATION")
        stall = outcomes.count("STALL")

        rev_pct = rev / total * 100
        cont_pct = cont / total * 100
        stall_pct = stall / total * 100

        fade_score = rev_pct - cont_pct

        if fade_score >= FADE_THRESHOLD:
            verdict = "ALLOW"
        else:
            verdict = "BLOCK"

        print(f"SESSION: {session}")
        print("-" * 40)
        print(signal)
        print(f"Samples        : {total}")
        print(f"Reversal %     : {rev_pct:.1f}")
        print(f"Continuation % : {cont_pct:.1f}")
        print(f"Stall %        : {stall_pct:.1f}")
        print(f"FadeScore      : {fade_score:.1f}")
        print(f"Verdict        : {verdict}\n")


if __name__ == "__main__":
    analyze()
