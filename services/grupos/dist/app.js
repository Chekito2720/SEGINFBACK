import 'dotenv/config';
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db.js';
import gruposRoutes from './routes/grupos.js';
import { fail } from './helpers/response.js';
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
    await server.register(gruposRoutes, { prefix: '/grupos' });
    // ── Error handler universal ────────────────────────────────────────
    server.setErrorHandler((error, req, reply) => {
        const err = error;
        const code = err.statusCode ?? 500;
        if (err.validation) {
            return reply.code(400).send(fail(400, 'SxGR', err.message, 'Validation Error'));
        }
        server.log.error(error);
        return reply.code(code).send(fail(code, 'SxGR', code === 500 ? 'Error interno del servidor' : err.message));
    });
    // ── Health check ───────────────────────────────────────────────────
    server.get('/health', async () => ({
        statusCode: 200,
        intOpCode: 'SxGR200',
        data: [{ service: 'grupos', uptime: process.uptime() }],
    }));
    const port = Number(process.env.PORT ?? 3003);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`✅ Servicio grupos en http://localhost:${port}`);
}
bootstrap().catch((err) => {
    console.error('Error al iniciar el servicio de grupos:', err);
    process.exit(1);
});
//# sourceMappingURL=app.js.map