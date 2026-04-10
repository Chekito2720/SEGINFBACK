import type { FastifyPluginAsync } from 'fastify';
import { Pool } from 'pg';
declare module 'fastify' {
    interface FastifyInstance {
        db: Pool;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
//# sourceMappingURL=db.d.ts.map