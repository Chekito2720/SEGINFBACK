import 'dotenv/config';
import Fastify                from 'fastify';
import type { FastifyError }  from 'fastify';
import fjwt                   from '@fastify/jwt';
import cors                   from '@fastify/cors';

import dbPlugin       from './plugins/db.js';
import usuariosRoutes from './routes/usuarios.js';
import { fail }       from './helpers/response.js';

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
});

async function bootstrap() {

  await server.register(cors, { origin: true });

  await server.register(fjwt, {
    secret: process.env.JWT_SECRET ?? 'dev_secret_change_in_production',
  });

  await server.register(dbPlugin);

  await server.register(usuariosRoutes, { prefix: '/usuarios' });

  // ── Error handler universal ────────────────────────────────────────
  server.setErrorHandler((error: FastifyError, _req, reply) => {
    const code = error.statusCode ?? 500;

    if (error.validation) {
      return reply.code(400).send(
        fail(400, 'SxUS', error.message, 'Validation Error'),
      );
    }

    server.log.error(error);
    return reply.code(code).send(
      fail(code, 'SxUS', code === 500 ? 'Error interno del servidor' : error.message),
    );
  });

  // ── Health check ───────────────────────────────────────────────────
  server.get('/health', async () => ({
    statusCode: 200,
    intOpCode:  'SxUS200',
    data: { service: 'usuarios', uptime: process.uptime() },
  }));

  const port = Number(process.env.PORT ?? 3001);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`✅ Servicio usuarios en http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el servicio de usuarios:', err);
  process.exit(1);
});

