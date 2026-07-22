-- db/schema.sql
DROP TABLE IF EXISTS engine.ticks CASCADE;
CREATE TABLE engine.ticks (
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    symbol TEXT NOT NULL,
    bid NUMERIC,
    ask NUMERIC,
    last NUMERIC,
    volume BIGINT,
    timestamp_ms BIGINT
);

DROP TABLE IF EXISTS engine.candles_1s CASCADE;
CREATE TABLE engine.candles_1s (
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    symbol TEXT NOT NULL,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    tick_count INTEGER,
    spread_avg NUMERIC,
    second_ts BIGINT,
    session TEXT
);
