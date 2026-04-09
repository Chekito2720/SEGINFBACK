import type { FastifyPluginAsync }                         from 'fastify';
import { TicketService }                                    from '../services/ticket.service.js';
import type { CreateTicketDTO, UpdateTicketDTO }            from '../services/ticket.service.js';
import { ok, fail }                                         from '../helpers/response.js';
import {
  listTicketsSchema, getTicketSchema, createTicketSchema,
  updateTicketSchema, updateStateSchema, deleteTicketSchema,
  statsSchema, listComentariosSchema, createComentarioSchema,
  historialSchema,
} from '../schemas/ticket.schema.js';

const ticketsRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new TicketService(fastify.db);

  // ── Helpers para leer headers del gateway ─────────────────────────
  const getUserId   = (req: any): string   => req.headers['x-user-id']      ?? '';
  const getPermisos = (req: any): string[] => {
    try   { return JSON.parse(req.headers['x-user-permisos'] ?? '[]'); }
    catch { return []; }
  };

  // ═══════════════════════════════════════════════════════════════════
  // GET /tickets — listar con filtros
  // ═══════════════════════════════════════════════════════════════════
  fastify.get('/', { schema: listTicketsSchema }, async (req: any, reply) => {
    const { grupoId, estado, prioridad, asignadoId, page = 1, limit = 20 } = req.query;
    const result = await svc.listar({
      grupoId, estado, prioridad, asignadoId,
      page: Number(page), limit: Number(limit),
      userId:   getUserId(req),
      permisos: getPermisos(req),
    });
    return reply.send({
      statusCode: 200,
      intOpCode:  'SxTK200',
      data:       result.items,
      meta:       { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /tickets/stats/:grupoId — estadísticas + kanban
  // ═══════════════════════════════════════════════════════════════════
  fastify.get<{ Params: { grupoId: string } }>(
    '/stats/:grupoId',
    { schema: statsSchema },
    async (req: any, reply) => {
      const data = await svc.stats(req.params.grupoId, getUserId(req), getPermisos(req));
      return reply.send(ok(200, 'SxTK', [data]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // GET /tickets/:id
  // ═══════════════════════════════════════════════════════════════════
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getTicketSchema },
    async (req, reply) => {
      const ticket = await svc.obtenerPorId(req.params.id);
      return reply.send(ok(200, 'SxTK', [ticket]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // POST /tickets — crear
  // ═══════════════════════════════════════════════════════════════════
  fastify.post<{ Body: CreateTicketDTO }>(
    '/',
    { schema: createTicketSchema },
    async (req: any, reply) => {
      const ticket = await svc.crear(req.body, getUserId(req));
      return reply.code(201).send(ok(201, 'SxTK', [ticket]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // PATCH /tickets/:id — editar campos (requiere ticket_edit)
  // ═══════════════════════════════════════════════════════════════════
  fastify.patch<{ Params: { id: string }; Body: UpdateTicketDTO }>(
    '/:id',
    { schema: updateTicketSchema },
    async (req: any, reply) => {
      const ticket = await svc.actualizar(req.params.id, req.body, getUserId(req));
      return reply.send(ok(200, 'SxTK', [ticket]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // PATCH /tickets/:id/state — cambiar estado (requiere ticket_state)
  // El gateway ya verificó que el usuario tiene ticket_state.
  // El service verifica que el ticket esté asignado al usuario.
  // ═══════════════════════════════════════════════════════════════════
  fastify.patch<{ Params: { id: string }; Body: { estadoId: string } }>(
    '/:id/state',
    { schema: updateStateSchema },
    async (req: any, reply) => {
      const ticket = await svc.cambiarEstado(req.params.id, req.body.estadoId, getUserId(req));
      return reply.send(ok(200, 'SxTK', [ticket]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // DELETE /tickets/:id
  // ═══════════════════════════════════════════════════════════════════
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: deleteTicketSchema },
    async (req: any, reply) => {
      await svc.eliminar(req.params.id, getUserId(req));
      return reply.send(ok(200, 'SxTK', [{ message: 'Ticket eliminado correctamente' }]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // COMENTARIOS
  // ═══════════════════════════════════════════════════════════════════
  fastify.get<{ Params: { id: string } }>(
    '/:id/comentarios',
    { schema: listComentariosSchema },
    async (req, reply) => {
      const data = await svc.listarComentarios(req.params.id);
      return reply.send(ok(200, 'SxTK', data));
    },
  );

  fastify.post<{ Params: { id: string }; Body: { contenido: string } }>(
    '/:id/comentarios',
    { schema: createComentarioSchema },
    async (req: any, reply) => {
      const data = await svc.agregarComentario(req.params.id, getUserId(req), req.body.contenido);
      return reply.code(201).send(ok(201, 'SxTK', [data]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // HISTORIAL
  // ═══════════════════════════════════════════════════════════════════
  fastify.get<{ Params: { id: string } }>(
    '/:id/historial',
    { schema: historialSchema },
    async (req, reply) => {
      const data = await svc.listarHistorial(req.params.id);
      return reply.send(ok(200, 'SxTK', data));
    },
  );
};

export default ticketsRoutes;

