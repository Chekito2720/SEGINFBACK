import fp               from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Pool }          from 'pg';
import { readFile }      from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME     ?? 'Seguridad',
    user:     process.env.DB_USER     ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    max:      5,
    idleTimeoutMillis: 30_000,
  });

  // Verificar conexión y ejecutar migración inicial
  const client = await pool.connect();
  try {
    fastify.log.info('✅ PostgreSQL (gateway) conectado');
    const sql = await readFile(
      join(__dirname, '../../migrations/001_logs_metrics.sql'),
      'utf-8',
    );
    await client.query(sql);
    fastify.log.info('✅ Tablas de logs/métricas listas');
  } catch (err) {
    fastify.log.error({ err }, '❌ Error iniciando BD del gateway');
    throw err;
  } finally {
    client.release();
  }

  fastify.addHook('onClose', async () => {
    await pool.end();
    fastify.log.info('PostgreSQL pool (gateway) cerrado');
  });

  fastify.decorate('db', pool);
};

export default fp(dbPlugin, { name: 'db' });
