# XAUUSD High-Frequency Ingestion Engine

A low-latency, event-driven backend infrastructure designed to bridge MetaTrader 5 (MT5) with a stateful Python analytics engine. It processes tick telemetry, synthesizes sliding 1-second candles, and executes real-time statistical regime detection and adverse selection shields.

---

## 🌟 Core System Architecture

The engine functions across four distinct layers to ensure separation of concerns, transactional integrity, and low processing latency:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. DATA SOURCE  │  TCP  │   2. INGESTION  │ Memory│  3. PROCESSING  │  Pool │ 4. PERSISTENCE  │
│  (MT5 Terminal) ├──────►│  (Python Bridge)├──────►│  (Engine Core)  ├──────►│   (Supabase)    │
│  [Unreliable]   │       │   [Persistent]  │       │   [Stateless]   │  Async│ [Degraded Fallback]
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Ingestion Layer (MQL5 EA)**: Establishes a raw tick capture interface on the MT5 trading client, pushing bid/ask changes over a native loopback TCP connection.
2. **Bridging Layer (Python Sockets)**: Maintains an asynchronous client loop that frames TCP stream boundaries using newline-delimited JSON slicing, eliminating partial-read fragmentation.
3. **Decision Core (asyncio)**: Performs stateless arithmetic processing including sliding-window EMA calculation, momentum impulse detection, and risk/gate checks.
4. **Persistence Layer (PostgreSQL)**: Handles asynchronous DB logging of tick histories and analytical candles via a connection pooler, featuring a 2-second timeout switch that gracefully degrades to local CSV logs if the database is unreachable.

---

## 📂 Repository Directory Layout

```
XAUUSD_ENGINE/
├── engine/                    # Core Analytical Logic (No I/O)
│   └── trade_engine.py        # Local trade tracking, breakeven adjustments
│
├── stream/                    # Ingestion Pipeline
│   ├── tick_stream.py         # Thread-safe live tick buffer
│   └── news_circuit_breaker.py # USD high-impact economic news filter
│
├── candles/                   # Telemetry Synthesis
│   └── candle_aggregator.py   # Sliding 1s window aggregator and session mapper
│
├── signals/                   # Quant Signal Layer
│   └── impulse_detector.py    # Raw impulse detection calculations
│
├── db/                        # Persistence Layer (Fault-Tolerant)
│   ├── db.py                  # psycopg2 connection pool with timeout & offline toggle
│   ├── tick_repository.py     # Batch inserts for raw tick data
│   ├── candle_repository.py   # Asynchronous candle storer
│   ├── impulse_repository.py  # Statistical anomaly audit logger
│   ├── decision_logger.py     # Local CSV fallback decision logger
│   └── schema.sql             # PostgreSQL database DDL definitions
│
├── mt5/                       # Execution and Ingestion Terminal EA
│   ├── ExecutionBridge.mq5    # MQL5 TCP client (Sends ticks, parses orders)
│   └── ExecutionBridge.ex5    # Compiled MQL5 execution binary
│
├── storage/                   # Cold Storage & Analysis
│   └── _offline_regime_analyzer.py # Script deriving μ and σ from database csv exports
│
├── config/                    # System Settings
│   ├── regime_config.json     # Dynamically loaded session parameters
│   └── news_config.json       # Manual news event fallbacks (ForexFactory block)
│
├── docker/                    # Infrastructure Containerization
│   ├── Dockerfile             # Multi-stage Python build
│   └── docker-compose.yml     # Service orchestrator (engine container + network)
│
├── CASE_STUDY.md              # Backend Systems Engineering Case Study (Detailed explanation)
├── main.py                    # Engine main entrypoint & listen loop
└── requirements.txt           # Python application dependencies
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python**: Version 3.11 or later
- **MetaTrader 5 Client Terminal**: Installed on Windows (required for socket client bridge)
- **PostgreSQL Database**: Supabase or any PostgreSQL 15 instance

### 2. Database Schema Setup
Apply the DDL schema to your PostgreSQL database instance using the SQL script provided in the repository:
```bash
psql -h <db-host> -U <db-user> -d <db-name> -f db/schema.sql
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://username:password@hostname:5432/dbname?sslmode=require"
BIND_HOST="127.0.0.1"
```

### 4. Running the Engine Locally
Install dependencies:
```bash
pip install -r requirements.txt
```
Run the Python TCP bridge and processing thread:
```bash
python main.py
```

### 5. Running via Docker Compose
Build and start the containerized engine:
```bash
docker compose -f docker/docker-compose.yml up --build -d
```

### 6. MetaTrader 5 Bridge Activation
- Move `mt5/ExecutionBridge.mq5` into your MetaTrader 5 terminal's `MQL5/Experts/` directory.
- Open MT5, allow DLL imports, and attach the Expert Advisor (EA) to an active **XAUUSD** chart.
- The EA will automatically connect to loopback port `5555` and begin pushing real-time tick events.

---

## 🛡️ Systems Engineering Design Highlights

- **TCP Message Framing**: By using newline delimiters (`\n`) for stream boundaries, we guarantee zero JSON parsing crashes even under high message-rate densities exceeding 3,000 packets/minute.
- **Fail-Safe Persistence (Offline Fast-Track)**: The database repository monitors write operations. If a query lags or timeout exceeds 2 seconds, it switches global states to run off inline CSV buffers, preventing the socket threads from freezing.
- **Active Position Heartbeats (Ghost Buster)**: Every 10 seconds, Python initiates a positions reconciliation check. In case of unexpected server crashes, it queries the MT5 terminal state and matches it with local counts, clearing any unmanaged ("ghost") positions immediately.
- **Statistically-Gated Momentum Checks**: Instead of standard indicators, the decision loop checks tick frequency density against historical baselines ($\mu + 1.5\sigma$) to only participate in the top 7% of momentum spikes.

---

## 📚 Systems Case Study
For a comprehensive architectural breakdown, systems failure log, resume impact points, and interview vulnerability audits, refer to the [CASE_STUDY.md](CASE_STUDY.md) file in the root of this repository.
