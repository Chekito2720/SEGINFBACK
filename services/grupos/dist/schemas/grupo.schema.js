// ─── Wrapper universal ────────────────────────────────────────────────────────
const okWrapper = (items) => ({
    type: 'object',
    properties: {
        statusCode: { type: 'number' },
        intOpCode: { type: 'string' },
        data: { type: 'array', items },
    },
});
// Para endpoints que devuelven un único objeto (no array)
const okSingle = (item) => ({
    type: 'object',
    properties: {
        statusCode: { type: 'number' },
        intOpCode: { type: 'string' },
        data: item,
    },
});
export const errorResponse = {
    type: 'object',
    properties: {
        statusCode: { type: 'number' },
        intOpCode: { type: 'string' },
        data: { type: 'null' },
        error: { type: 'string' },
        message: { type: 'string' },
    },
};
// ─── Objeto grupo completo ────────────────────────────────────────────────────
const grupoObject = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        nombre: { type: 'string' },
        descripcion: { type: 'string', nullable: true },
        nivel: { type: 'string', nullable: true },
        model: { type: 'string', nullable: true },
        color: { type: 'string', nullable: true },
        creatorId: { type: 'string' },
        creatorNombre: { type: 'string' },
        creadoEn: { type: 'string' },
        totalMiembros: { type: 'number' },
        totalTickets: { type: 'number' },
    },
};
// ─── GET /grupos ──────────────────────────────────────────────────────────────
export const listGruposSchema = {
    querystring: {
        type: 'object',
        properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
    },
    response: {
        200: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                intOpCode: { type: 'string' },
                data: { type: 'array', items: grupoObject },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' }, page: { type: 'number' },
                        limit: { type: 'number' }, pages: { type: 'number' },
                    },
                },
            },
        },
    },
};
// ─── GET /grupos/:id ──────────────────────────────────────────────────────────
export const getGrupoSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
        200: okSingle(grupoObject),
        404: errorResponse,
    },
};
// ─── POST /grupos ─────────────────────────────────────────────────────────────
export const createGrupoSchema = {
    body: {
        type: 'object',
        required: ['nombre'],
        additionalProperties: false,
        properties: {
            nombre: { type: 'string', minLength: 1, maxLength: 255 },
            descripcion: { type: 'string', maxLength: 1000, nullable: true },
            nivel: { type: 'string', enum: ['Básico', 'Intermedio', 'Avanzado'], nullable: true },
            model: { type: 'string', maxLength: 100, nullable: true },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', nullable: true },
        },
    },
    response: {
        201: okSingle(grupoObject),
        400: errorResponse,
        403: errorResponse,
    },
};
// ─── PATCH /grupos/:id ────────────────────────────────────────────────────────
export const updateGrupoSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
            nombre: { type: 'string', minLength: 1, maxLength: 255 },
            descripcion: { type: 'string', maxLength: 1000, nullable: true },
            nivel: { type: 'string', enum: ['Básico', 'Intermedio', 'Avanzado'], nullable: true },
            model: { type: 'string', maxLength: 100, nullable: true },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', nullable: true },
        },
    },
    response: {
        200: okSingle(grupoObject),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── DELETE /grupos/:id ───────────────────────────────────────────────────────
export const deleteGrupoSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
        200: okSingle({ type: 'object', properties: { message: { type: 'string' } } }),
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── GET /grupos/:id/miembros ─────────────────────────────────────────────────
export const listMiembrosSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                usuarioId: { type: 'string' },
                fullName: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                fechaUnido: { type: 'string' },
                permisosGlobales: { type: 'array', items: { type: 'string' } },
                permisosGrupo: { type: 'array', items: { type: 'string' } },
            },
        }),
        404: errorResponse,
    },
};
// ─── POST /grupos/:id/miembros ────────────────────────────────────────────────
export const addMiembroSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    body: {
        type: 'object',
        required: ['usuarioId'],
        additionalProperties: false,
        properties: {
            usuarioId: { type: 'string', minLength: 1 },
        },
    },
    response: {
        201: okSingle({ type: 'object', properties: { message: { type: 'string' } } }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
    },
};
// ─── DELETE /grupos/:id/miembros/:uid ─────────────────────────────────────────
export const removeMiembroSchema = {
    params: {
        type: 'object',
        required: ['id', 'uid'],
        properties: {
            id: { type: 'string', format: 'uuid' },
            uid: { type: 'string', format: 'uuid' },
        },
    },
    response: {
        200: okSingle({ type: 'object', properties: { message: { type: 'string' } } }),
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── GET /grupos/:id/miembros/:uid/permisos ───────────────────────────────────
// Ver permisos contextuales de un usuario en un grupo específico
export const getPermisosContextualesSchema = {
    params: {
        type: 'object',
        required: ['id', 'uid'],
        properties: {
            id: { type: 'string', format: 'uuid' },
            uid: { type: 'string', format: 'uuid' },
        },
    },
    response: {
        200: okSingle({
            type: 'object',
            properties: {
                grupoId: { type: 'string' },
                usuarioId: { type: 'string' },
                fullName: { type: 'string' },
                permisosGrupo: { type: 'array', items: { type: 'string' } },
            },
        }),
        404: errorResponse,
    },
};
// ─── PUT /grupos/:id/miembros/:uid/permisos ───────────────────────────────────
// Reemplazar permisos contextuales de un usuario en un grupo
// Este es el endpoint clave de "permisos por grupo por usuario"
export const updatePermisosContextualesSchema = {
    params: {
        type: 'object',
        required: ['id', 'uid'],
        properties: {
            id: { type: 'string', format: 'uuid' },
            uid: { type: 'string', format: 'uuid' },
        },
    },
    body: {
        type: 'object',
        required: ['permisos'],
        additionalProperties: false,
        properties: {
            permisos: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true,
                description: 'Lista de nombres de permisos contextuales para este usuario en este grupo',
            },
        },
    },
    response: {
        200: okSingle({
            type: 'object',
            properties: {
                grupoId: { type: 'string' },
                usuarioId: { type: 'string' },
                permisosGrupo: { type: 'array', items: { type: 'string' } },
                message: { type: 'string' },
            },
        }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── GET /grupos/:id/permisos-default ────────────────────────────────────────
export const getPermisosDefaultSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    response: {
        200: okSingle({
            type: 'object',
            properties: {
                grupoId: { type: 'string' },
                permisos: { type: 'array', items: { type: 'string' } },
            },
        }),
        404: errorResponse,
    },
};
// ─── PUT /grupos/:id/permisos-default ────────────────────────────────────────
export const updatePermisosDefaultSchema = {
    params: {
        type: 'object', required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
    },
    body: {
        type: 'object',
        required: ['permisos'],
        additionalProperties: false,
        properties: {
            permisos: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
    },
    response: {
        200: okSingle({
            type: 'object',
            properties: {
                grupoId: { type: 'string' },
                permisos: { type: 'array', items: { type: 'string' } },
                message: { type: 'string' },
            },
        }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── GET /grupos/mis-grupos ───────────────────────────────────────────────────
// Grupos a los que pertenece el usuario autenticado
export const misGruposSchema = {
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                ...grupoObject.properties,
                permisosEnGrupo: { type: 'array', items: { type: 'string' } },
            },
        }),
    },
};
//# sourceMappingURL=grupo.schema.js.map