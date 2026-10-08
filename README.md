# XAUUSD High-Frequency Trading Engine

**A low-latency, event-driven trading engine that connects MetaTrader 5 with Python to process real-time Gold (XAUUSD) tick data, detect high-momentum market impulses, and execute trades safely.**

---

## Key Features

- **Real-Time TCP Socket Bridge**: Streams live tick data between MetaTrader 5 and Python over a local TCP socket (`port 5555`) with newline-delimited JSON framing.
- **1-Second Candle Synthesis**: Aggregates sub-second ticks into clean, sliding 1-second OHLCV candles with real-time volume and spread metrics.
- **Statistical Impulse Detection**: Filters out market noise by entering trades only during statistical momentum spikes ($\mu + 1.5\sigma$ tick density).
- **News Circuit Breaker**: Automatically suspends trading 15 minutes before and after high-impact USD economic events.
- **Dynamic Session Risk**: Scales Stop-Loss (SL) and Take-Profit (TP) levels dynamically based on active trading sessions (London, New York, Tokyo).
- **Ghost Position Protection**: Reconciles active positions with the MT5 terminal every 10 seconds to auto-close unmanaged or conflicting trades.
- **Fail-Safe Persistence**: Saves tick and candle histories asynchronously to PostgreSQL/Supabase, falling back to local CSV storage if the database disconnects.

---

## How It Works

The engine runs as an event-driven loop that separates market data ingestion, quantitative analysis, risk validation, and order execution:

```
┌──────────────────┐       TCP / JSON       ┌──────────────────────┐
│  MT5 Terminal    ├───────────────────────►│  Python TCP Server   │
│ (ExecutionBridge)│                        │      (Port 5555)     │
└────────▲─────────┘                        └──────────┬───────────┘
         │                                             │
         │ Orders / Sync                               ▼
┌────────┴─────────┐   Passed Risk / News   ┌──────────────────────┐
│ Trade Execution  │◄───────────────────────┤ 1s Candle Synthesis  │
│  & Ghost Buster  │                        │  & Impulse Detection │
└────────┬─────────┘                        └──────────┬───────────┘
         │                                             │
         ▼                                             ▼
┌──────────────────┐                        ┌──────────────────────┐
│ PostgreSQL DB    │◄─── Async Logging ─────┤ Local CSV Fallback   │
│  (Supabase/Neon) │     (Fast Failover)    │   (Offline Buffer)   │
└──────────────────┘                        └──────────────────────┘
```

1. **Capture**: The MT5 Expert Advisor (`ExecutionBridge.mq5`) captures live bid/ask quotes and sends them to Python over a local TCP socket.
2. **Aggregate**: Python normalizes timestamps to strict UTC and aggregates incoming ticks into rolling 1-second candles.
3. **Detect**: The impulse detector measures tick density and price acceleration against pre-calculated session baselines.
4. **Filter**: Risk modules verify that the spread is within bounds and confirm that no high-impact USD news events are active.
5. **Execute & Reconcile**: Orders are dispatched to MT5 with session-specific SL/TP targets. A 10-second sync loop checks terminal state and clears ghost positions.
6. **Persist**: All ticks, candles, and signals are written to PostgreSQL. If the database lags or disconnects, the engine switches to local CSV files without interrupting trading.

---

## Prerequisites

| Tool | Version / Requirement | Purpose |
|---|---|---|
| **Python** | 3.11+ | Runs the ingestion engine, risk gates, and TCP server |
| **MetaTrader 5** | Desktop Client (Windows) | Broker terminal for market data and trade execution |
| **PostgreSQL** | 15+ (Local or Supabase) | Stores tick archives, 1-second candles, and trade records |
| **Docker & Compose** | Optional | Runs the engine inside an isolated Linux container |

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Sudarshan25092007/XAUUSD-ENGINE.git
cd XAUUSD-ENGINE
```

### 2. Set Up a Python Virtual Environment
```bash
# Create the virtual environment
python -m venv venv

# Activate on Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Activate on Linux / macOS
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://username:password@hostname:5432/dbname?sslmode=require"
BIND_HOST="127.0.0.1"
```
> **Note**: If `DATABASE_URL` is omitted, the engine automatically operates in **Offline Mode** and writes data directly to local CSV files.

### 5. Apply the Database Schema
```bash
python apply_schema.py
```
*(Alternatively, apply using `psql`: `psql -h <host> -U <user> -d <dbname> -f db/schema.sql`)*

---

## How to Use

### Step 1: Configure MetaTrader 5
1. Copy `mt5/ExecutionBridge.mq5` into your MT5 terminal directory: `MQL5/Experts/`.
2. Compile the EA in MetaEditor (or use the precompiled `mt5/ExecutionBridge.ex5`).
3. In MT5, open **Tools > Options > Expert Advisors** and enable:
   - **Allow Algo Trading**
   - **Allow DLL imports**
4. Attach `ExecutionBridge` to an active **XAUUSD** chart.

### Step 2: Start the Engine

#### Option A: Run Locally
```bash
python main.py
```
*The engine initializes on port `5555` and waits for MT5 to connect.*

#### Option B: Run with Docker Compose
```bash
# Build and run container in background
docker compose -f docker/docker-compose.yml up --build -d

# View live container output
docker logs -f xauusd_trading_engine
```

### Step 3: Utility Commands

- **Check Database Connection & Tables**:
  ```bash
  python db_check.py
  ```
- **Recalculate Session Regime Parameters**:
  ```bash
  python storage/_offline_regime_analyzer.py
  ```

---

## Project Structure

```
XAUUSD_ENGINE/
├── candles/              # 1-second candle aggregation and session mapping
├── config/               # Session thresholds (regime_config.json) & news filters
├── db/                   # Connection pooling, repositories, schema, and CSV loggers
├── docker/               # Dockerfile and Docker Compose configurations
├── engine/               # Trade tracking, breakeven adjustments, and order state
├── mt5/                  # MetaTrader 5 MQL5 Execution Bridge EA (source and binary)
├── signals/              # Statistical momentum and impulse detectors
├── storage/              # Offline regime analyzer and analytical scripts
├── stream/               # Live tick stream buffer and USD news circuit breaker
├── apply_schema.py       # Helper script to apply database schema
├── db_check.py           # Verification script for database tables and connectivity
├── main.py               # Main engine entrypoint and async TCP listen loop
└── requirements.txt      # Python package dependencies
```

---

> 📖 **Deep Dive**: For an in-depth architecture case study, failure modes analysis, and performance benchmarks, see [CASE_STUDY.md](CASE_STUDY.md).
