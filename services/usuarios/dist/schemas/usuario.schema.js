// ─── Reutilizables ────────────────────────────────────────────────────────────
/** Envoltura ok() — data siempre es array */
const okWrapper = (items) => ({
    type: 'object',
    properties: {
        statusCode: { type: 'number' },
        intOpCode: { type: 'string' },
        data: {
            type: 'array',
            items,
        },
    },
});
/** Respuesta de error estándar (fail()) */
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
// ─── Registro ─────────────────────────────────────────────────────────────────
//
// Reglas de negocio validadas aquí (JSON Schema) y en el service:
//   • fullName  : mínimo 3 caracteres
//   • username  : 3-50 chars, solo letras/números/guión_bajo
//   • email     : formato email válido
//   • phone     : solo dígitos, +, guiones y espacios — mínimo 8 chars
//   • birthDate : formato YYYY-MM-DD — edad mínima 18 años (validada en service)
//   • address   : obligatorio
//   • password  : mín 10 chars, 1 mayúscula, 1 número, 1 carácter especial
//   • confirmPassword: debe coincidir con password (validado en el front)
//
export const registroSchema = {
    body: {
        type: 'object',
        required: ['fullName', 'username', 'email', 'phone', 'birthDate', 'address', 'password', 'confirmPassword'],
        additionalProperties: false,
        properties: {
            fullName: {
                type: 'string',
                minLength: 3,
                maxLength: 255,
            },
            username: {
                type: 'string',
                minLength: 3,
                maxLength: 50,
                pattern: '^[a-zA-Z0-9_]+$', // solo letras, números y _
            },
            email: {
                type: 'string',
                format: 'email',
                maxLength: 255,
            },
            phone: {
                type: 'string',
                minLength: 8,
                maxLength: 20,
                pattern: '^[+0-9\\-\\s]{8,20}$',
            },
            birthDate: {
                type: 'string',
                format: 'date', // YYYY-MM-DD
            },
            address: {
                type: 'string',
                minLength: 1,
                maxLength: 255,
            },
            password: {
                type: 'string',
                minLength: 10,
                maxLength: 128,
                // 1 mayúscula, 1 minúscula, 1 dígito, 1 especial
                pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"|,.<>\\/?]).{10,}$',
            },
            confirmPassword: {
                type: 'string',
                minLength: 1,
            },
        },
    },
    response: {
        201: okWrapper({
            type: 'object',
            properties: {
                token: { type: 'string' },
                usuario: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        nombre_completo: { type: 'string' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        creado_en: { type: 'string' },
                    },
                },
            },
        }),
        400: errorResponse,
        409: errorResponse,
    },
};
// ─── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
        },
    },
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                token: { type: 'string' },
                usuario: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        nombre_completo: { type: 'string' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        permisos: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        }),
        401: errorResponse,
    },
};
// ─── Obtener perfil ───────────────────────────────────────────────────────────
export const getPerfilSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'string', format: 'uuid' },
        },
    },
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                id: { type: 'string' },
                nombre_completo: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                telefono: { type: 'string', nullable: true },
                direccion: { type: 'string', nullable: true },
                fecha_nacimiento: { type: 'string', nullable: true },
                last_login: { type: 'string', nullable: true },
                creado_en: { type: 'string' },
                permisos: { type: 'array', items: { type: 'string' } },
            },
        }),
        404: errorResponse,
    },
};
// ─── Actualizar perfil ────────────────────────────────────────────────────────
export const updatePerfilSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'string', format: 'uuid' },
        },
    },
    body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
            nombre_completo: { type: 'string', minLength: 3, maxLength: 255 },
            username: { type: 'string', minLength: 3, maxLength: 50, pattern: '^[a-zA-Z0-9_]+$' },
            telefono: { type: 'string', pattern: '^[+0-9\\-\\s]{7,20}$', nullable: true },
            direccion: { type: 'string', maxLength: 255, nullable: true },
            // Cambio de contraseña opcional
            password_actual: { type: 'string', minLength: 1 },
            password_nuevo: {
                type: 'string',
                minLength: 10,
                maxLength: 128,
                pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"|,.<>\\/?]).{10,}$',
            },
        },
    },
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                message: { type: 'string' },
                usuario: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        nombre_completo: { type: 'string' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                    },
                },
            },
        }),
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── Cambiar permisos (solo superadmin) ───────────────────────────────────────
export const updatePermisosSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'string', format: 'uuid' },
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
            },
        },
    },
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                message: { type: 'string' },
                permisos: { type: 'array', items: { type: 'string' } },
            },
        }),
        403: errorResponse,
        404: errorResponse,
    },
};
// ─── Eliminar usuario ────────────────────────────────────────────────────────
export const deleteUsuarioSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'string', format: 'uuid' },
        },
    },
    response: {
        200: okWrapper({
            type: 'object',
            properties: {
                message: { type: 'string' },
            },
        }),
        403: errorResponse,
        404: errorResponse,
    },
};
//# sourceMappingURL=usuario.schema.js.map