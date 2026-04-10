import 'dotenv/config';
import Fastify              from 'fastify';
import type { FastifyError } from 'fastify';
import fjwt                 from '@fastify/jwt';
import cors                 from '@fastify/cors';
import helmet               from '@fastify/helmet';
import cookie               from '@fastify/cookie';
import rateLimit            from '@fastify/rate-limit';
import proxy                from '@fastify/http-proxy';
import fp                   from 'fastify-plugin';

import permissionChecker    from './plugins/permissionChecker.js';
import authRoutes           from './routes/auth.js';
import { ok, fail }         from './helpers/response.js';

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
});

async function bootstrap() {

  // ── Seguridad HTTP ─────────────────────────────────────────────────────────
  await server.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await server.register(cors, {
    origin:          process.env.FRONTEND_URL ?? 'http://localhost:4200',
    methods:         ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders:  ['Content-Type', 'Authorization', 'x-group-id'],
    credentials:     true,   // necesario para que el browser envíe cookies
  });

  // ── Cookies ────────────────────────────────────────────────────────────────
  await server.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'dev_cookie_secret_change_in_production',
    hook:   'onRequest',
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  await server.register(rateLimit, {
    max:        100,
    timeWindow: '1 minute',
    errorResponseBuilder: () =>
      fail(429, 'SxGW', 'Has superado el límite de peticiones. Intenta en un momento.', 'Too Many Requests'),
  });

  // ── JWT ────────────────────────────────────────────────────────────────────
  await server.register(fjwt, {
    secret: process.env.JWT_SECRET ?? 'dev_secret_change_in_production',
  });

  // ── Verificación de permisos (hook global) ─────────────────────────────────
  // Valida JWT desde cookie + verifica permiso en el mapa antes de proxy
  await server.register(permissionChecker);

  // ── Rutas propias del Gateway (/auth/*) ────────────────────────────────────
  // Registrar ANTES de los proxies para que no sean interceptadas
  await server.register(authRoutes);

  // ── Proxy → Servicio Usuarios (:3001) ──────────────────────────────────────
  // Reescribe /usuarios/* → http://localhost:3001/usuarios/*
  await server.register(proxy, {
    upstream:      process.env.USUARIOS_URL ?? 'http://localhost:3001',
    prefix:        '/usuarios',
    rewritePrefix: '/usuarios',
    http2:         false,
    // Reenviar los headers X-User-* que añadió el permissionChecker
    replyOptions: {
      rewriteRequestHeaders: (req, headers) => ({
        ...headers,
        'x-user-id':       req.headers['x-user-id'] ?? '',
        'x-user-permisos': req.headers['x-user-permisos'] ?? '[]',
        'x-user-email':    req.headers['x-user-email'] ?? '',
      }),
    },
  });

  // ── Proxy → Servicio Tickets (:3002) ───────────────────────────────────────
  await server.register(proxy, {
    upstream:      process.env.TICKETS_URL ?? 'http://localhost:3002',
    prefix:        '/tickets',
    rewritePrefix: '/tickets',
    http2:         false,
    replyOptions: {
      rewriteRequestHeaders: (req: any, headers: any) => ({
        ...headers,
        'x-user-id':       req.headers['x-user-id']       ?? '',
        'x-user-permisos': req.headers['x-user-permisos']  ?? '[]',
        'x-user-email':    req.headers['x-user-email']     ?? '',
      }),
    },
  });

    // ── Proxy → Servicio Grupos (:3003) ────────────────────────────────────────
  await server.register(proxy, {
    upstream:      process.env.GRUPOS_URL ?? 'http://localhost:3003',
    prefix:        '/grupos',
    rewritePrefix: '/grupos',
    http2:         false,
    replyOptions: {
      rewriteRequestHeaders: (req: any, headers: any) => ({
        ...headers,
        'x-user-id':       req.headers['x-user-id']       ?? '',
        'x-user-permisos': req.headers['x-user-permisos']  ?? '[]',
        'x-user-email':    req.headers['x-user-email']     ?? '',
      }),
    },
  });

  server.get('/health', async () =>
    ok(200, 'SxGW', {
      service: 'gateway',
      uptime:  process.uptime(),
      servicios: {
        usuarios: process.env.USUARIOS_URL ?? 'http://localhost:3001',
        tickets:  process.env.TICKETS_URL  ?? 'http://localhost:3002',
        grupos:   process.env.GRUPOS_URL   ?? 'http://localhost:3003',
      },
    }),
  );

  // ── Error handler global ───────────────────────────────────────────────────
  server.setErrorHandler((error: FastifyError, _req, reply) => {
    const code = error.statusCode ?? 500;

    // Errores de validación de schema (Fastify los genera automáticamente)
    if (error.validation) {
      return reply.code(400).send(
        fail(400, 'SxGW', error.message, 'Validation Error'),
      );
    }

    server.log.error(error);

    return reply.code(code).send(
      fail(code, 'SxGW', code === 500 ? 'Error interno del servidor' : error.message),
    );
  });

  // ── Arrancar ───────────────────────────────────────────────────────────────
  const port = Number(process.env.GATEWAY_PORT ?? 3000);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`🚀 API Gateway en http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el Gateway:', err);
  process.exit(1);
});