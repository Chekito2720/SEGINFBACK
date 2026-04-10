import type { FastifySchema } from 'fastify';
/** Respuesta de error estándar (fail()) */
export declare const errorResponse: {
    type: string;
    properties: {
        statusCode: {
            type: string;
        };
        intOpCode: {
            type: string;
        };
        data: {
            type: string;
        };
        error: {
            type: string;
        };
        message: {
            type: string;
        };
    };
};
export declare const registroSchema: FastifySchema;
export declare const loginSchema: FastifySchema;
export declare const getPerfilSchema: FastifySchema;
export declare const updatePerfilSchema: FastifySchema;
export declare const updatePermisosSchema: FastifySchema;
export declare const deleteUsuarioSchema: FastifySchema;
//# sourceMappingURL=usuario.schema.d.ts.map