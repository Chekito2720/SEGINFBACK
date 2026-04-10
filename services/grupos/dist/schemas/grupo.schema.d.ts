import type { FastifySchema } from 'fastify';
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
export declare const listGruposSchema: FastifySchema;
export declare const getGrupoSchema: FastifySchema;
export declare const createGrupoSchema: FastifySchema;
export declare const updateGrupoSchema: FastifySchema;
export declare const deleteGrupoSchema: FastifySchema;
export declare const listMiembrosSchema: FastifySchema;
export declare const addMiembroSchema: FastifySchema;
export declare const removeMiembroSchema: FastifySchema;
export declare const getPermisosContextualesSchema: FastifySchema;
export declare const updatePermisosContextualesSchema: FastifySchema;
export declare const getPermisosDefaultSchema: FastifySchema;
export declare const updatePermisosDefaultSchema: FastifySchema;
export declare const misGruposSchema: FastifySchema;
//# sourceMappingURL=grupo.schema.d.ts.map