import 'dotenv/config';
import Fastify       from 'fastify';
import fjwt          from '@fastify/jwt';
import cors          from '@fastify/cors';

import dbPlugin      from './plugins/db.js';
import ticketsRoutes from './routes/tickets.js';
import { fail }      from './helpers/response.js';

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

  await server.register(ticketsRoutes, { prefix: '/tickets' });

  // ── Error handler universal ────────────────────────────────────────
  server.setErrorHandler((error: Error, req, reply) => {
    const code = (error as any).statusCode ?? 500;

    if ((error as any).validation) {
      return reply.code(400).send(
        fail(400, 'SxTK', error.message, 'Validation Error'),
      );
    }

    server.log.error(error);
    return reply.code(code).send(
      fail(code, 'SxTK', code === 500 ? 'Error interno del servidor' : error.message),
    );
  });

  // ── Health check ───────────────────────────────────────────────────
  server.get('/health', async () => ({
    statusCode: 200,
    intOpCode:  'SxTK200',
    data: [{ service: 'tickets', uptime: process.uptime() }],
  }));

  const port = Number(process.env.PORT ?? 3002);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`✅ Servicio tickets en http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el servicio de tickets:', err);
  process.exit(1);
});

