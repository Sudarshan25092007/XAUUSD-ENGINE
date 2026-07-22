import time
import os
from datetime import datetime, timezone

# =======================
# DATABASE (STEP-I)
# =======================
from db.db import get_conn, put_conn
from db.tick_repository import TickRepository
from db.candle_repository import CandleRepository
from db.impulse_repository import ImpulseRepository

# =======================
# STREAM + AGGREGATORS
# =======================
from stream.tick_stream import TickStream
from candles.candle_aggregator import CandleAggregator

# =======================
# SIGNALS + TRACKING
# =======================
from signals.impulse_detector import ImpulseDetector

# =======================
# DECISION INTELLIGENCE
# =======================
from stream.news_circuit_breaker import NewsCircuitBreaker  # 🚨 Added Circuit Breaker

# =======================
# EXECUTION (NATIVE TCP BRIDGE)
# =======================
import socket
import json
from engine.trade_engine import TradeEngine
from db.decision_logger import DecisionLogger  # 📝 Added Decision Tracker


# 🔧 EXECUTION ENGINE (can be disabled later)
engine = TradeEngine(tp=1.2, sl=1.0, be_trigger=0.6)

# 📝 LOCAL DECISION TRACKER
decision_logger = DecisionLogger(filename="db/Tick_Data.csv")

# 📊 REGIME CONFIG (session-specific thresholds from regime_analyzer.py)
REGIME_CONFIG = {}
try:
    with open("config/regime_config.json", "r") as f:
        REGIME_CONFIG = json.load(f)
    print(f"✅ Loaded regime_config.json with {len(REGIME_CONFIG)} sessions: {list(REGIME_CONFIG.keys())}")
except FileNotFoundError:
    print("⚠️ regime_config.json not found — engine will run in OBSERVATION mode (all impulses blocked)")
    print("   Run: python storage/_offline_regime_analyzer.py to generate it from your collected data")
except Exception as e:
    print(f"⚠️ Failed to load regime_config.json: {e}")

# 🔒 HARD-CODED SESSION CAP OVERRIDES (survive offline mode)
SESSION_CAP_OVERRIDES = {
    "LONDON": 12.0,
    "TOKYO": 12.0,
}

# 📟 BOOT LOG: Show active caps for all sessions
print("")
print("═" * 50)
for sess_name, sess_data in REGIME_CONFIG.items():
    ss = sess_data.get("sample_size", 0)
    threshold = sess_data.get("density_threshold", "?")
    cap = SESSION_CAP_OVERRIDES.get(sess_name, sess_data.get("density_mean", 1.5) + 4.0 * sess_data.get("density_std", 0.5) if ss >= 500 else 12.0)
    print(f"[BOOT] {sess_name}: threshold={threshold} | cap={cap} | samples={ss}")
print("═" * 50)
print("")

# 🚨 NEWS CIRCUIT BREAKER
# Pauses trading 15 mins before and 15 mins after High Impact USD news
news_breaker = NewsCircuitBreaker(target_currency="USD", pre_minutes=15, post_minutes=15)
# Fetch today's news once when the script starts
news_breaker.fetch_daily_events()

print(">>> main.py started")

# XAUUSD Risk Parameters — SESSION-BASED DYNAMIC SL/TP
PIP_VALUE = 0.01  # XAUUSD: 1 pip = $0.01 (standard Gold pip)
SESSION_RISK = {
    "LONDON": {"sl_pips": 300, "tp_pips": 600},   # 3.0 / 6.0 pts
    "TOKYO":  {"sl_pips": 300, "tp_pips": 600},   # 3.0 / 6.0 pts
    "NEW_YORK": {"sl_pips": 500, "tp_pips": 1000}, # 5.0 / 10.0 pts — more room for NY noise
    "SYDNEY": {"sl_pips": 300, "tp_pips": 600},   # fallback
}
DEFAULT_RISK = {"sl_pips": 300, "tp_pips": 600}
order_fail_count = 0  # Track consecutive failures

# Spread filter threshold — block if spread > this (low liquidity / slippage risk)
MAX_SPREAD_AVG = 0.80

# Position tracking for one-way rule
active_positions = {"BUY": 0, "SELL": 0}
last_order_time = 0.0          # Timestamp of last order sent (for sync cooldown)
first_drift_time = 0.0         # When drift was first detected (for suppression)


def _send_tcp(client_socket, payload_dict):
    """Low-level TCP send with 3 retries and 100ms backoff."""
    if client_socket is None:
        return False
    json_payload = json.dumps(payload_dict) + "\n"
    for attempt in range(1, 4):
        try:
            client_socket.sendall(json_payload.encode('utf-8'))
            print(f"🌉 [TCP] Sent (attempt {attempt}/3): {json_payload.strip()}")
            return True
        except Exception as e:
            print(f"🔥 [TCP ERROR] Attempt {attempt}/3 failed: {e}")
            if attempt < 3:
                time.sleep(0.1)
    print(f"🔥 [BRIDGE FAILURE] All 3 retries exhausted.")
    return False


def check_and_flush(client_socket, new_action):
    """
    Kill Switch: ALWAYS send CLOSE_ALL for the opposing side before opening.
    We send even if Python thinks there are zero positions, because MT5
    may have positions from manual trading or previous engine runs.
    """
    global active_positions
    opposite = "SELL" if new_action == "BUY" else "BUY"

    print(f"🔥 [CLEANUP] Sending CLOSE_ALL_{opposite} to clear any opposing positions before {new_action}")
    _send_tcp(client_socket, {
        "action": f"CLOSE_ALL_{opposite}",
        "symbol": "XAUUSD",
        "reason": f"Kill Switch: aligning with new {new_action} impulse"
    })
    print(f"🔥 [CLEANUP] Opposite positions closed to align with new Impulse.")
    active_positions[opposite] = 0


def send_signal_to_bridge(client_socket, signal_data):
    """
    Sends trade signal with SESSION-BASED SL/TP to MT5 via Native TCP.
    Always flushes opposing positions first (Kill Switch).
    SL and TP are NEVER zero — enforced with floor values.
    """
    if client_socket is None:
        return False

    action = "BUY" if signal_data["signal"] == "IMPULSE_UP" else "SELL"
    price = signal_data["price_1s"]
    session = signal_data.get("session", "LONDON")

    # KILL SWITCH: close ALL opposing positions first
    check_and_flush(client_socket, action)

    # DYNAMIC SL/TP based on session
    risk = SESSION_RISK.get(session, DEFAULT_RISK)
    sl_distance = risk["sl_pips"] * PIP_VALUE
    tp_distance = risk["tp_pips"] * PIP_VALUE

    # Calculate SL/TP with session-specific distances
    if action == "BUY":
        sl_price = round(price - sl_distance, 2)
        tp_price = round(price + tp_distance, 2)
    else:
        sl_price = round(price + sl_distance, 2)
        tp_price = round(price - tp_distance, 2)

    # SAFETY: if SL/TP somehow ended up at 0 or same as price, force the floor
    if sl_price == 0.0 or sl_price == price:
        sl_price = round(price + sl_distance, 2) if action == "SELL" else round(price - sl_distance, 2)
    if tp_price == 0.0 or tp_price == price:
        tp_price = round(price - tp_distance, 2) if action == "SELL" else round(price + tp_distance, 2)

    payload = {
        "action": action,
        "symbol": signal_data["symbol"],
        "price": price,
        "sl": sl_price,
        "tp": tp_price,
        "request_id": str(signal_data["second_ts"])
    }

    print(f"🛡️ [RISK] {action} @ {price} | SL={sl_price} ({risk['sl_pips']}pip / {sl_distance}pts) | TP={tp_price} ({risk['tp_pips']}pip / {tp_distance}pts) | Session={session}")

    success = _send_tcp(client_socket, payload)
    if success:
        active_positions[action] = active_positions.get(action, 0) + 1
        global last_order_time
        last_order_time = time.time()  # Start cooldown timer
    return success


def sync_terminal_state(client_socket):
    """
    Ask the EA for the REAL position count.
    Python's memory is unreliable — MT5 is the source of truth.
    """
    if client_socket is None:
        return False
    req_id = int(time.time() * 1000)
    return _send_tcp(client_socket, {
        "action": "SYNC_POSITIONS",
        "symbol": "XAUUSD",
        "request_id": req_id
    })


def handle_position_sync(msg):
    """
    Process POSITION_SYNC response from EA.
    Updates Python's active_positions and detects ghost positions.
    Only trusts sync if no order was sent in the last 5 seconds.
    """
    global active_positions, first_drift_time
    ea_buys = msg.get("buy_count", 0)
    ea_sells = msg.get("sell_count", 0)
    total_pnl = msg.get("total_pnl", 0.0)

    py_buys = active_positions.get("BUY", 0)
    py_sells = active_positions.get("SELL", 0)

    # COOLDOWN: don't trust sync if we just sent an order (broker may still be filling)
    elapsed = time.time() - last_order_time
    if elapsed < 5.0:
        print(f"⏳ [SYNC COOLDOWN] Skipping sync — order sent {elapsed:.1f}s ago (waiting 5s)")
        return "COOLDOWN"

    # Sync Python state to match EA reality
    active_positions["BUY"] = ea_buys
    active_positions["SELL"] = ea_sells

    print(f"📊 [SYNC] MT5 Actual: BUY={ea_buys} SELL={ea_sells} | P/L=${total_pnl:.2f}")

    if py_buys != ea_buys or py_sells != ea_sells:
        now = time.time()
        if first_drift_time == 0.0:
            first_drift_time = now
        drift_duration = now - first_drift_time
        if drift_duration > 10.0:
            # Persistent drift — escalate to warning
            print(f"⚠️ [SYNC DRIFT] Python had BUY={py_buys} SELL={py_sells} — corrected (drifting for {drift_duration:.0f}s)")
        else:
            # Transient drift — debug only
            print(f"🔍 [SYNC DEBUG] Minor drift: Python BUY={py_buys} SELL={py_sells} vs MT5 BUY={ea_buys} SELL={ea_sells}")
    else:
        first_drift_time = 0.0  # Reset — no drift

    # GHOST DETECTOR: if Python thought 0 positions but EA has active trades
    if (py_buys == 0 and py_sells == 0) and (ea_buys > 0 or ea_sells > 0):
        print(f"🚨 [GHOST DETECTED] Python shows 0 positions but MT5 has {ea_buys + ea_sells} open!")
        return "GHOST_DETECTED"

    return "OK"


def handle_order_filled(msg):
    """Process ORDER_FILLED event from EA — authoritative confirmation."""
    global active_positions, order_fail_count
    ticket = msg.get("ticket", 0)
    order_type = msg.get("order_type", "UNKNOWN")
    order_fail_count = 0  # Reset fail counter on success
    print(f"✅ [ORDER CONFIRMED] Ticket #{ticket} — {order_type} filled by broker")


def handle_order_failed(msg):
    """Process ORDER_FAILED event from EA — broker rejection."""
    global order_fail_count
    order_fail_count += 1
    error = msg.get("error", "Unknown")
    code = msg.get("code", 0)
    order_type = msg.get("order_type", "UNKNOWN")
    price = msg.get("price", 0.0)
    sl = msg.get("sl", 0.0)
    tp = msg.get("tp", 0.0)
    print(f"")
    print(f"██████████████████████████████████████████████████")
    print(f"🛑 [ORDER REJECTED] {order_type} FAILED BY BROKER")
    print(f"🛑 Error    : {error}")
    print(f"🛑 Code     : {code}")
    print(f"🛑 Price    : {price}")
    print(f"🛑 SL Sent  : {sl}")
    print(f"🛑 TP Sent  : {tp}")
    print(f"🛑 Failures : {order_fail_count} consecutive")
    print(f"██████████████████████████████████████████████████")
    print(f"")


def process_tick(tick, stream, tick_repo, aggregator, candle_repo,
                 impulse_detector, impulse_repo,
                 engine, news_breaker, decision_logger,
                 client_socket, last_timestamp, lambda_prev, alpha,
                 tick_save_counter=0):
    """
    Full tick processing pipeline: store -> aggregate -> detect -> decide -> execute.
    Returns (last_timestamp, lambda_prev, client_socket, tick_save_counter) for state updates.
    """
    ts = tick["timestamp"]

    # TIMESTAMP DE-DUP
    if last_timestamp is not None and ts <= last_timestamp:
        return last_timestamp, lambda_prev, client_socket, tick_save_counter

    # STORE TICK (sampled: 1 out of every 5 to reduce DB load by 80%)
    stream.add_tick(tick)
    tick_save_counter += 1
    if tick_save_counter >= 5:
        tick_repo.save(tick)
        tick_save_counter = 0

    mid_price = (tick["bid"] + tick["ask"]) / 2

    # UPDATE TRADE (OPTIONAL)
    trade_result = engine.update(mid_price)
    if trade_result:
        print("🔴 TRADE CLOSED:", trade_result)

    # AGGREGATE 1s CANDLE
    candle = aggregator.add_tick(tick)
    if candle is None:
        return ts, lambda_prev, client_socket, tick_save_counter

    candle_repo.save(candle)

    # TICK DENSITY (ADVERSE SELECTION)
    N = candle["tick_count"]
    U = candle["up_ticks"]
    D = candle["down_ticks"]
    s = U - D

    # EMA Update
    if lambda_prev == 0.0:
        lambda_prev = N
    else:
        lambda_prev = alpha * N + (1 - alpha) * lambda_prev

    # Compute Features
    tick_density = N / max(lambda_prev, 1e-6)
    dir_imbalance = s / max(N, 1)

    # Attach to candle for downstream passing
    candle["tick_density"] = tick_density
    candle["dir_imbalance"] = dir_imbalance

    # 🔍 DEBUG: Show density every second so we can see how close we are
    session = candle["session"]
    regime = REGIME_CONFIG.get(session)
    regime_threshold = regime.get("density_threshold", "N/A") if regime else "N/A"
    print(f"[DEBUG] Density: {tick_density:.4f} | Imbalance: {dir_imbalance:.4f} | Session: {session} | Threshold(μ+1.5σ): {regime_threshold}")

    # DETECT IMPULSE
    signal = impulse_detector.detect(candle)
    if signal == "NO_SIGNAL":
        return ts, lambda_prev, client_socket, tick_save_counter

    impulse = {
        "symbol": candle["symbol"],
        "signal": signal,
        "session": candle["session"],
        "second_ts": candle["second_ts"],
        "open": candle["open"],
        "high": candle["high"],
        "low": candle["low"],
        "close": candle["close"],
        "spread_avg": candle["spread_avg"],
        "tick_count": candle["tick_count"],
        "up_ticks": candle["up_ticks"],
        "down_ticks": candle["down_ticks"],
        "zero_ticks": candle["zero_ticks"],
        "tick_density": candle["tick_density"],
        "dir_imbalance": candle["dir_imbalance"]
    }

    impulse_repo.save(impulse)

    # 🚨 IMPULSE DETECTED — always log, even if gates block it
    print(f"")
    print(f"🚨 IMPULSE DETECTED: {signal} | {session} | Close={candle['close']} | Density={tick_density:.4f} | Imbalance={dir_imbalance:.4f}")
    print(f"")

    # STEP-H DECISION (now uses regime_config.json thresholds)
    regime = REGIME_CONFIG.get(session)

    if regime is None:
        print(f"⏭️ [FILTER] Impulse detected, but no regime config for '{session}'. Observing only.")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"No regime data for {session}")
        return ts, lambda_prev, client_socket, tick_save_counter

    # Regime Gate: density must exceed μ+1.5σ (top ~7% of moves only)
    regime_density_threshold = regime.get("density_threshold", 999)
    regime_imbalance_cap = regime.get("imbalance_cap", 0.95)

    # Floor threshold for sessions still building data (<500 samples)
    sample_size = regime.get("sample_size", 0)
    if sample_size < 500:
        regime_density_threshold = max(regime_density_threshold, 2.0)

    if tick_density < regime_density_threshold:
        print(f"⛔ [REGIME] Density {tick_density:.4f} < threshold {regime_density_threshold:.4f} (μ+1.5σ). Not strong enough.")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"Below regime μ+1.5σ ({tick_density:.2f} < {regime_density_threshold:.2f})")
        return ts, lambda_prev, client_socket, tick_save_counter

    print(f"✅ [REGIME] {session} regime check PASSED: density={tick_density:.4f} >= threshold={regime_density_threshold:.4f} (μ+1.5σ)")

    # 🚨 HARD BLOCK (Macroeconomic News)
    if not news_breaker.is_trading_allowed():
        print("⏭️ Trade blocked by News Circuit Breaker")
        decision_logger.log_decision(signal, candle["session"], candle["close"], "BLOCK", "News Circuit Breaker")
        return ts, lambda_prev, client_socket, tick_save_counter

    # 🌍 SESSION GATE: Only trade in high-quality sessions
    ALLOWED_SESSIONS = ["LONDON", "NEW_YORK", "TOKYO"]
    if session not in ALLOWED_SESSIONS:
        print(f"⏭️ [FILTER] Impulse detected, but {session} is not in ALLOWED_SESSIONS {ALLOWED_SESSIONS}.")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"Session Filter ({session})")
        return ts, lambda_prev, client_socket, tick_save_counter

    # 🛡️ DENSITY SHIELD (only block truly extreme outliers)
    density_mean = regime.get("density_mean", 1.5)
    density_std = regime.get("density_std", 0.5)
    # Check for hard-coded session override FIRST
    if session in SESSION_CAP_OVERRIDES:
        density_cap = SESSION_CAP_OVERRIDES[session]
    elif sample_size < 500:
        density_cap = 12.0
    else:
        density_cap = density_mean + (4.0 * density_std)
    if tick_density > density_cap:
        print(f"⏭️ [SHIELD] Density too HIGH: {tick_density:.2f} > cap {density_cap:.2f} (extreme outlier)")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"Density Shield ({tick_density:.2f} > cap {density_cap:.2f})")
        return ts, lambda_prev, client_socket, tick_save_counter

    # 🛡️ IMBALANCE CAP (block one-sided stampedes)
    if abs(dir_imbalance) > regime_imbalance_cap:
        print(f"⏭️ [SHIELD] Imbalance too HIGH: {dir_imbalance:.2f} > cap {regime_imbalance_cap:.2f} (one-sided stampede)")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"Imbalance Shield ({dir_imbalance:.2f} > {regime_imbalance_cap:.2f})")
        return ts, lambda_prev, client_socket, tick_save_counter

    # 🌀 CHOPPY MARKET FILTER: block if imbalance is too LOW (indecisive)
    min_imbalance = regime.get("min_imbalance", 0.15)
    if abs(dir_imbalance) < min_imbalance:
        print(f"⏭️ [SHIELD] Imbalance too LOW: {abs(dir_imbalance):.2f} < min {min_imbalance:.2f} (choppy market)")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"Choppy Filter (|{dir_imbalance:.2f}| < {min_imbalance:.2f})")
        return ts, lambda_prev, client_socket, tick_save_counter

    # 💰 SPREAD GAP FILTER: block if spread too wide (low liquidity / slippage)
    spread_avg = candle.get("spread_avg", 0.0)
    if spread_avg > MAX_SPREAD_AVG:
        print(f"⏭️ [SPREAD] Spread {spread_avg:.4f} > max {MAX_SPREAD_AVG} — low liquidity, blocking trade")
        decision_logger.log_decision(signal, session, candle["close"], "BLOCK", f"Spread Gap ({spread_avg:.4f} > {MAX_SPREAD_AVG})")
        return ts, lambda_prev, client_socket, tick_save_counter

    # 🚀 EXECUTE SIGNAL — ALL GATES PASSED
    price = candle["close"]
    symbol = candle["symbol"]
    action = "BUY" if signal == "IMPULSE_UP" else "SELL"
    risk = SESSION_RISK.get(session, DEFAULT_RISK)
    print(f"")
    print(f"═" * 50)
    print(f"🚀 [EXECUTION] {action} ORDER SENT TO MT5")
    print(f"🚀 Signal   : {signal}")
    print(f"🚀 Symbol   : {symbol}")
    print(f"🚀 Price    : {price}")
    print(f"🚀 Session  : {session}")
    print(f"🚀 Density  : {tick_density:.4f} (threshold: {regime_density_threshold:.4f})")
    print(f"🚀 Imbalance: {dir_imbalance:.4f} (min: {min_imbalance:.4f} | cap: {regime_imbalance_cap:.4f})")
    print(f"🚀 Spread   : {spread_avg:.4f} (max: {MAX_SPREAD_AVG})")
    print(f"🚀 SL/TP    : {risk['sl_pips']}pip / {risk['tp_pips']}pip")
    print(f"═" * 50)
    print(f"")
    decision_logger.log_decision(signal, session, price, "EXECUTE", "All Gates Passed — Signal Sent to MT5")

    bridge_payload = {
        "second_ts": candle["second_ts"],
        "symbol": symbol,
        "signal": signal,
        "price_1s": price,
        "session": session
    }
    if not send_signal_to_bridge(client_socket, bridge_payload):
        print(f"🔥 [BRIDGE FAILURE] Could not send {signal} to MT5 after 3 retries!")
        if client_socket:
            client_socket.close()
        client_socket = None

    return ts, lambda_prev, client_socket, tick_save_counter

def main():
    print(">>> main() entered")

    # =======================
    # ADVERSE SELECTION STATE
    # =======================
    W = 300 # 5-minute EMA window
    alpha = 2.0 / (W + 1)
    lambda_prev = 0.0

    # =======================
    # INIT DATABASE REPOS
    # =======================
    import db.db as db_module
    print("Testing Supabase Connection...")
    test_conn = db_module.get_conn()
    if test_conn is None:
        db_module.DATABASE_OFFLINE = True
        print("⚠️ Supabase Unreachable - Activating OFFLINE FAST-TRACK")
    else:
        db_module.put_conn(test_conn)
        print("✅ Supabase Connected")
    
    print(f"[DEBUG] DATABASE_OFFLINE = {db_module.DATABASE_OFFLINE}")

    tick_repo = TickRepository()
    candle_repo = CandleRepository()
    impulse_repo = ImpulseRepository()

    # =======================
    # MT5 IS NOW HANDLED BY THE EA
    # =======================
    print("ℹ️ MetaTrader5 library removed. Ticks arrive via Native TCP Bridge from EA.")

    # =======================
    # OFFLINE VOLUME MAPPING
    # =======================
    import os
    os.makedirs("offline_data", exist_ok=True)

    # =======================
    # INIT NATIVE TCP SERVER SOCKET
    # =======================
    import os
    server_ip = os.getenv("BIND_HOST", "127.0.0.1")
    server_port = 5555
    print(f"Initializing Native TCP Server on {server_ip}:{server_port}...")
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Enable address reuse to instantly restart if Python crashed
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server_socket.bind((server_ip, server_port))
    except OSError as e:
        print(f"🔥 [TCP BIND ERROR]: Port {server_port} is in use. Check for ghost python processes! Error: {e}")
        raise
        
    server_socket.listen(1)
    server_socket.setblocking(False)
    client_socket = None
    
    print(f"DEBUG: Server listening on {server_ip}:{server_port}")

    # =======================
    # CORE COMPONENTS
    # =======================
    stream = TickStream()
    aggregator = CandleAggregator()
    impulse_detector = ImpulseDetector()

    recv_buffer = ""  # Accumulates partial TCP reads for message framing
    last_timestamp = None
    last_tcp_heartbeat = time.time()
    last_bridge_ping = time.time()
    last_health_print = time.time()
    lambda_prev = 0.0
    tick_save_counter = 0  # For tick sampling (save 1 in 5)
    bridge_reconnect_attempts = 0  # Exponential backoff counter
    bridge_status = "WAITING"
    total_ticks_processed = 0
    last_sync_time = time.time()

    print("Starting live tick stream (via Native TCP Bridge)...")

    while True:
        try:
            # =======================
            # 📊 HEALTH DASHBOARD (every 30 seconds)
            # =======================
            now = time.time()
            if now - last_health_print > 30.0:
                print(f"")
                print(f"📊 [HEALTH] Positions: BUY={active_positions.get('BUY', 0)} SELL={active_positions.get('SELL', 0)} | Bridge: {bridge_status} | Ticks: {total_ticks_processed}")
                print(f"")
                last_health_print = now

            # =======================
            # 🔄 POSITION SYNC (every 10 seconds)
            # =======================
            if client_socket is not None and now - last_sync_time > 10.0:
                sync_terminal_state(client_socket)
                last_sync_time = now

            # =======================
            # 🌉 NATIVE BRIDGE - ACCEPT CLIENT (with exponential backoff)
            # =======================
            if client_socket is None:
                try:
                    client_socket, addr = server_socket.accept()
                    client_socket.setblocking(False)
                    print(f"✅ [NATIVE BRIDGE] MT5 Execution EA has connected!")
                    recv_buffer = ""  # Reset buffer on new connection
                    bridge_reconnect_attempts = 0  # Reset backoff
                    bridge_status = "ONLINE"
                except BlockingIOError:
                    current_time = time.time()
                    if current_time - last_tcp_heartbeat > 5.0:
                        print(f"[STATUS] Engine Heartbeat: Waiting for MT5 Bridge on {server_ip}:{server_port}...")
                        last_tcp_heartbeat = current_time
                    time.sleep(0.01)
                    continue
                        
            # =======================
            # 💗 BRIDGE HEARTBEAT
            # =======================
            if client_socket is not None:
                current_time = time.time()
                if current_time - last_bridge_ping > 60.0:
                    try:
                        ping = json.dumps({"action": "HEARTBEAT"}) + "\n"
                        client_socket.sendall(ping.encode('utf-8'))
                        print("💗 [BRIDGE PING] Heartbeat sent to MT5")
                        last_bridge_ping = current_time
                    except Exception as e:
                        print(f"🔥 [BRIDGE FATAL ERROR] Connection dropped during heartbeat: {e}")
                        client_socket.close()
                        client_socket = None
                        continue

            # =======================
            # 📡 RECEIVE TICKS FROM EA VIA TCP
            # =======================
            tick = None
            if client_socket is not None:
                try:
                    data = client_socket.recv(4096)
                    if data:
                        raw_text = data.decode('utf-8')
                        recv_buffer += raw_text
                    else:
                        # Empty data = connection closed by EA
                        print("🔥 [BRIDGE DISCONNECTED] EA closed the connection.")
                        client_socket.close()
                        client_socket = None
                        bridge_status = "OFFLINE"
                        bridge_reconnect_attempts += 1
                        if bridge_reconnect_attempts >= 5:
                            print("🚨🚨🚨 [CRITICAL WARNING] Bridge failed 5 consecutive reconnects! Check MT5 EA! 🚨🚨🚨")
                        backoff = min(2 ** bridge_reconnect_attempts, 30)
                        print(f"⏳ [BACKOFF] Reconnect attempt {bridge_reconnect_attempts} — waiting {backoff}s...")
                        time.sleep(backoff)
                        continue
                except BlockingIOError:
                    pass  # No data available right now, that's fine
                except Exception as e:
                    print(f"🔥 [TCP READ ERROR]: {e}")
                    client_socket.close()
                    client_socket = None
                    bridge_status = "OFFLINE"
                    bridge_reconnect_attempts += 1
                    if bridge_reconnect_attempts >= 5:
                        print("🚨🚨🚨 [CRITICAL WARNING] Bridge failed 5 consecutive reconnects! 🚨🚨🚨")
                    backoff = min(2 ** bridge_reconnect_attempts, 30)
                    print(f"⏳ [BACKOFF] Reconnect attempt {bridge_reconnect_attempts} — waiting {backoff}s...")
                    time.sleep(backoff)
                    continue

            # Process all complete messages in the buffer (newline-delimited)
            while "\n" in recv_buffer:
                line, recv_buffer = recv_buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"⚠️ [BAD JSON] Error: {e} | Fragment ({len(line)} chars): {line[:150]}")
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "TICK":
                    # Stamp arrival time in strict UTC (fixes broker clock drift)
                    arrival_utc_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                    broker_time_msc = msg.get("time_msc", 0)

                    # Convert EA tick JSON into the internal tick format
                    tick = {
                        "symbol": msg.get("symbol", "XAUUSD"),
                        "timestamp": arrival_utc_ms,
                        "broker_time_msc": broker_time_msc,
                        "bid": msg.get("bid", 0.0),
                        "ask": msg.get("ask", 0.0),
                        "last": msg.get("last", 0.0),
                        "volume": msg.get("volume", 0),
                        "spread": msg.get("ask", 0.0) - msg.get("bid", 0.0),
                        "session": "live",
                        "source": "native_bridge",
                    }
                    # Process this tick through the engine pipeline
                    total_ticks_processed += 1
                    last_timestamp, lambda_prev, client_socket, tick_save_counter = process_tick(
                        tick, stream, tick_repo, aggregator, candle_repo,
                        impulse_detector, impulse_repo,
                        engine, news_breaker, decision_logger,
                        client_socket, last_timestamp, lambda_prev, alpha,
                        tick_save_counter)

                elif msg_type == "POSITION_SYNC":
                    # EA sent us the real position state
                    result = handle_position_sync(msg)
                    if result == "GHOST_DETECTED":
                        print("🚨 [GHOST] Sending SYNC_EMERGENCY_CLOSE to clear unmanaged positions!")
                        _send_tcp(client_socket, {
                            "action": "SYNC_EMERGENCY_CLOSE",
                            "symbol": "XAUUSD",
                            "reason": "Ghost position detected — Python/MT5 out of sync"
                        })

                elif msg_type == "ORDER_FILLED":
                    handle_order_filled(msg)

                elif msg_type == "ORDER_FAILED":
                    handle_order_failed(msg)

                else:
                    print(f"⚠️ [UNKNOWN MSG TYPE]: {msg_type}")

            # 🕯️ RESOURCE GUARD
            time.sleep(0.001)

        except (ConnectionError, socket.error, OSError) as e:
            print(f"🚨 [CRITICAL NETWORK ERROR] Connection lost! Exception: {e}")
            print("⏳ Engine will safely pause for 10 seconds before attempting to resume...")
            if client_socket:
                try: 
                    client_socket.close()
                except:
                    pass
                client_socket = None
            time.sleep(10)
            print("🔄 Attempting to resume Tick Stream and Bridge Listeners...")
            continue
            
        except Exception as e:
            print("🔥 RUNTIME ERROR:", repr(e))
            raise


if __name__ == "__main__":
    main()
