import type { FastifySchema } from 'fastify';

// ─── Wrapper universal ────────────────────────────────────────────────────────
const okWrapper = (items: object) => ({
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    intOpCode:  { type: 'string' },
    data: { type: 'array', items },
  },
});

export const errorResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    intOpCode:  { type: 'string' },
    data:       { type: 'null'   },
    error:      { type: 'string' },
    message:    { type: 'string' },
  },
};

// ─── Objeto ticket completo (reutilizable) ────────────────────────────────────
const ticketObject = {
  type: 'object',
  properties: {
    id:             { type: 'string' },
    grupoId:        { type: 'string' },
    titulo:         { type: 'string' },
    descripcion:    { type: 'string', nullable: true },
    autorId:        { type: 'string' },
    autorNombre:    { type: 'string' },
    asignadoId:     { type: 'string', nullable: true },
    asignadoNombre: { type: 'string', nullable: true },
    estado:         { type: 'string' },
    estadoColor:    { type: 'string' },
    prioridad:      { type: 'string' },
    prioridadOrden: { type: 'number' },
    fechaFinal:     { type: 'string', nullable: true },
    creadoEn:       { type: 'string' },
  },
};

// ─── GET /tickets ─────────────────────────────────────────────────────────────
export const listTicketsSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      grupoId:    { type: 'string' },
      estado:     { type: 'string' },
      prioridad:  { type: 'string' },
      asignadoId: { type: 'string' },
      page:       { type: 'integer', minimum: 1, default: 1   },
      limit:      { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        intOpCode:  { type: 'string' },
        data:       { type: 'array', items: ticketObject },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page:  { type: 'number' },
            limit: { type: 'number' },
            pages: { type: 'number' },
          },
        },
      },
    },
    403: errorResponse,
  },
};

// ─── GET /tickets/:id ─────────────────────────────────────────────────────────
export const getTicketSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: okWrapper(ticketObject),
    404: errorResponse,
  },
};

// ─── POST /tickets ────────────────────────────────────────────────────────────
// Acepta nombres de estado y prioridad (el servicio resuelve los UUIDs)
export const createTicketSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['grupoId', 'titulo', 'estado', 'prioridad'],
    additionalProperties: false,
    properties: {
      grupoId:     { type: 'string', format: 'uuid' },
      titulo:      { type: 'string', minLength: 1, maxLength: 500 },
      descripcion: { type: 'string', maxLength: 5000, nullable: true },
      asignadoId:  { type: 'string', format: 'uuid', nullable: true },
      estado:      { type: 'string', enum: ['pendiente', 'en_progreso', 'hecho', 'bloqueado'] },
      prioridad:   { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
      fechaFinal:  { type: 'string', format: 'date-time', nullable: true },
    },
  },
  response: {
    201: okWrapper(ticketObject),
    400: errorResponse,
    403: errorResponse,
  },
};

// ─── PATCH /tickets/:id ───────────────────────────────────────────────────────
// Acepta nombre de prioridad (el servicio resuelve el UUID)
export const updateTicketSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      titulo:      { type: 'string', minLength: 1, maxLength: 500 },
      descripcion: { type: 'string', maxLength: 5000, nullable: true },
      asignadoId:  { type: 'string', format: 'uuid', nullable: true },
      prioridad:   { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
      fechaFinal:  { type: 'string', format: 'date-time', nullable: true },
    },
  },
  response: {
    200: okWrapper(ticketObject),
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── PATCH /tickets/:id/state ─────────────────────────────────────────────────
// Acepta nombre del estado; el servicio verifica que el ticket esté asignado al usuario
export const updateStateSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['estado'],
    additionalProperties: false,
    properties: {
      estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'hecho', 'bloqueado'] },
    },
  },
  response: {
    200: okWrapper(ticketObject),
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── DELETE /tickets/:id ──────────────────────────────────────────────────────
export const deleteTicketSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: okWrapper({ type: 'object', properties: { message: { type: 'string' } } }),
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── GET /tickets/stats/:grupoId ──────────────────────────────────────────────
export const statsSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['grupoId'],
    properties: { grupoId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: okWrapper({
      type: 'object',
      properties: {
        total:      { type: 'number' },
        porEstado:  { type: 'array', items: { type: 'object', properties: {
          estado: { type: 'string' }, color: { type: 'string' }, total: { type: 'number' },
        }}},
        porPrioridad: { type: 'array', items: { type: 'object', properties: {
          prioridad: { type: 'string' }, orden: { type: 'number' }, total: { type: 'number' },
        }}},
        kanban: { type: 'array', items: {
          type: 'object',
          properties: {
            estadoId:     { type: 'string' },
            estadoNombre: { type: 'string' },
            estadoColor:  { type: 'string' },
            tickets:      { type: 'array', items: ticketObject },
          },
        }},
      },
    }),
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── Comentarios ──────────────────────────────────────────────────────────────
export const listComentariosSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: okWrapper({
      type: 'object',
      properties: {
        id:          { type: 'string' },
        ticketId:    { type: 'string' },
        autorId:     { type: 'string' },
        autorNombre: { type: 'string' },
        contenido:   { type: 'string' },
        creadoEn:    { type: 'string' },
      },
    }),
    404: errorResponse,
  },
};

export const createComentarioSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['contenido'],
    additionalProperties: false,
    properties: {
      contenido: { type: 'string', minLength: 1, maxLength: 2000 },
    },
  },
  response: {
    201: okWrapper({
      type: 'object',
      properties: {
        id:        { type: 'string' },
        contenido: { type: 'string' },
        creadoEn:  { type: 'string' },
      },
    }),
    403: errorResponse,
    404: errorResponse,
  },
};

// ─── Historial ────────────────────────────────────────────────────────────────
export const historialSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: okWrapper({
      type: 'object',
      properties: {
        id:            { type: 'string' },
        ticketId:      { type: 'string' },
        usuarioId:     { type: 'string' },
        usuarioNombre: { type: 'string' },
        accion:        { type: 'string' },
        valorAnterior: { type: 'string', nullable: true },
        valorNuevo:    { type: 'string', nullable: true },
        nota:          { type: 'string', nullable: true },
        creadoEn:      { type: 'string' },
      },
    }),
    404: errorResponse,
  },
};
