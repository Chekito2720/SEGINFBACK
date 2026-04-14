import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const kStart = Symbol('requestStart');

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalizeEndpoint = (url: string | undefined): string => {
  const [path = ''] = (url ?? '').split('?');
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
};

const getIp = (req: FastifyRequest): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  return req.ip ?? (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? null;
};

const auditLoggerPlugin: FastifyPluginAsync = async (fastify) => {

  // ── Guardar timestamp al inicio de cada request ──────────────────────────────
  fastify.addHook('onRequest', async (req: FastifyRequest) => {
    (req as any)[kStart] = Date.now();
  });

  // ── Guardar log + actualizar métricas al finalizar cada response ─────────────
  fastify.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const responseMs = Date.now() - ((req as any)[kStart] ?? Date.now());
    const endpoint   = normalizeEndpoint(req.url);
    const userId     = (req.headers['x-user-id'] as string) || null;
    const ip         = getIp(req);
    const statusCode = reply.statusCode;

    fastify.db.query(
      `INSERT INTO request_logs (method, endpoint, user_id, ip, status_code, response_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.method, endpoint, userId, ip, statusCode, responseMs],
    ).catch((err) => fastify.log.error({ err }, 'auditLogger: error guardando log'));

    // $3 = responseMs como BIGINT (total_ms)
    // $4 = responseMs como NUMERIC seed inicial (avg_ms en el INSERT base)
    fastify.db.query(
      `INSERT INTO endpoint_metrics (endpoint, method, request_count, total_ms, avg_ms, last_updated)
       VALUES ($1, $2, 1, $3, $4, NOW())
       ON CONFLICT (endpoint, method) DO UPDATE
         SET request_count = endpoint_metrics.request_count + 1,
             total_ms      = endpoint_metrics.total_ms + $3,
             avg_ms        = ROUND(
                               (endpoint_metrics.total_ms + $3)::numeric
                               / (endpoint_metrics.request_count + 1),
                               2
                             ),
             last_updated  = NOW()`,
      [endpoint, req.method, responseMs, responseMs],
    ).catch((err) => fastify.log.error({ err }, 'auditLogger: error actualizando métricas'));
  });

  // ── Guardar errores con stack trace ──────────────────────────────────────────
  fastify.addHook('onError', async (req: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const responseMs = Date.now() - ((req as any)[kStart] ?? Date.now());
    const endpoint   = normalizeEndpoint(req.url);
    const userId     = (req.headers['x-user-id'] as string) || null;
    const ip         = getIp(req);
    const code       = (error as any).statusCode ?? 500;

    fastify.db.query(
      `INSERT INTO request_logs
         (method, endpoint, user_id, ip, status_code, response_ms, error_msg, stack_trace)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.method,
        endpoint,
        userId,
        ip,
        code,
        responseMs,
        error.message ?? null,
        error.stack   ?? null,
      ],
    ).catch((err) => fastify.log.error({ err }, 'auditLogger: error guardando error-log'));
  });
};

export default fp(auditLoggerPlugin, { name: 'auditLogger', dependencies: ['db'] });