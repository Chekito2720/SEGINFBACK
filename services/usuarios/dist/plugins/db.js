import fp from 'fastify-plugin';
import { Pool } from 'pg';
const dbPlugin = async (fastify) => {
    const pool = new Pool({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'miapp_db',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
        max: 10, // máximo de conexiones en el pool
        idleTimeoutMillis: 30_000,
    });
    // Verificar conexión al arrancar
    try {
        const client = await pool.connect();
        fastify.log.info('✅ PostgreSQL conectado');
        client.release();
    }
    catch (err) {
        fastify.log.error({ err }, '❌ Error conectando a PostgreSQL');
        throw err;
    }
    // Cerrar pool al apagar el servidor
    fastify.addHook('onClose', async () => {
        await pool.end();
        fastify.log.info('PostgreSQL pool cerrado');
    });
    fastify.decorate('db', pool);
};
export default fp(dbPlugin, { name: 'db' });
//# sourceMappingURL=db.js.map