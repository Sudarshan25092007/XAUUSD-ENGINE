# XAUUSD High-Frequency Analytics Dashboard

A read-only, dark-themed prop-firm analytics terminal built for the **XAUUSD Market Microstructure Engine**. It visualizes sub-second tick telemetry, 1-second sliding OHLCV candles, statistical momentum gating ($\mu + 1.5\sigma$), directional imbalance order flow, and a flight recorder decision log.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Recharts**.

---

## 🌟 Key Features

- **Live Overview Header Stats**: Real-time counts of ticks, 1-second candles, active positions, execute/block decision ratio, and UTC market session tracker.
- **1-Second High-Frequency Candle Chart**: Sliding-window OHLCV and volume bars using Recharts `ComposedChart`.
- **Statistical Gating Spectrum**: Visualizes tick density with active session thresholds ($\mu + 1.5\sigma$) and adverse selection safety caps ($\mu + 4\sigma$).
- **Directional Imbalance Delta**: Order flow buy/sell balance with choppy market filters and trap caps.
- **Decisions Flight Recorder**: Searchable and filterable audit log of the last 50 execution events with full JSON telemetry inspection.
- **Session Regime Baselines**: Live calibration metrics ($\mu$, $\sigma$, sample size) for London, New York, Tokyo, and Sydney sessions.
- **Position Reconciliation**: Live position state with 10-second terminal synchronization verification.
- **Zero-Failure Demo Fallback**: Automatically serves simulated live feeds when Supabase is unreachable, ensuring resume and demo links never fail.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration (Optional)
Copy the example environment file:
```bash
cp .env.example .env.local
```
Configure your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
```
*(If no credentials are provided, the dashboard automatically runs in Demo Mode with high-fidelity simulated streaming.)*

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the terminal.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## ☁️ Deploy to Vercel

### Option 1: Vercel Dashboard
1. Import your `XAUUSD-ENGINE` repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `dashboard`.
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**.

### Option 2: Vercel CLI
```bash
cd dashboard
npx vercel --prod
```
