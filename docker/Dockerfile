# ==========================================
# Stage 1: Build stage (Compile dependencies)
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install compilation tools and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Compile python packages into the user local directory
RUN pip install --no-cache-dir --user -r requirements.txt

# ==========================================
# Stage 2: Runtime stage (Slim final image)
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime PostgreSQL client library
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled python packages from the builder stage
COPY --from=builder /root/.local /root/.local

# Copy the rest of the application
COPY . .

# Expose the TCP server port for the MetaTrader 5 Execution Bridge
EXPOSE 5555

# Configure environment pathing
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Run the trading engine entrypoint
CMD ["python", "main.py"]