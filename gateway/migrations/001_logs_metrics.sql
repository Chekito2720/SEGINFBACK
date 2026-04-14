-- ── Logs de requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_logs (
  id           SERIAL        PRIMARY KEY,
  timestamp    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  method       VARCHAR(10)   NOT NULL,
  endpoint     TEXT          NOT NULL,
  user_id      TEXT,                        -- NULL si no estaba autenticado
  ip           TEXT,
  status_code  INTEGER       NOT NULL,
  response_ms  INTEGER       NOT NULL,      -- duración en milisegundos
  error_msg    TEXT,                        -- NULL si no hubo error
  stack_trace  TEXT                         -- NULL si no hubo error
);

CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp  ON request_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint   ON request_logs (endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id    ON request_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_status     ON request_logs (status_code);

-- ── Métricas por endpoint ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS endpoint_metrics (
  id              SERIAL        PRIMARY KEY,
  endpoint        TEXT          NOT NULL,
  method          VARCHAR(10)   NOT NULL,
  request_count   BIGINT        NOT NULL DEFAULT 0,
  total_ms        BIGINT        NOT NULL DEFAULT 0,   -- suma acumulada de ms
  avg_ms          NUMERIC(10,2) NOT NULL DEFAULT 0,   -- calculado en cada upsert
  last_updated    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint, method)
);

CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_endpoint ON endpoint_metrics (endpoint);
