import type { FastifyPluginAsync } from 'fastify';
import { UsuarioService, type RegistroDTO, type UpdatePerfilDTO } from '../services/usuario.service.js';
import { ok, fail } from '../helpers/response.js';
import {
  registroSchema, loginSchema, getPerfilSchema,
  updatePerfilSchema, updatePermisosSchema, deleteUsuarioSchema,
} from '../schemas/usuario.schema.js';

const usuariosRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new UsuarioService(
    fastify.db,
    Number(process.env.BCRYPT_ROUNDS ?? 10),
  );

  // ── Helper: obtener userId desde header X-User-Id (puesto por el gateway) ──
  const getUserId = (req: any): string => req.headers['x-user-id'] ?? '';
  const getPermisos = (req: any): string[] => {
    try { return JSON.parse(req.headers['x-user-permisos'] ?? '[]'); }
    catch { return []; }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RUTAS PÚBLICAS — accedidas directamente vía gateway /auth/*
  // ═══════════════════════════════════════════════════════════════════

  /** POST /usuarios/registro */
  fastify.post<{ Body: RegistroDTO }>(
    '/registro',
    { schema: registroSchema },
    async (req, reply) => {
      const usuario = await svc.registrar(req.body);
      const token = fastify.jwt.sign({
        sub:      usuario.id,
        username: usuario.username,
        email:    usuario.email,
        permisos: [],
      }, { expiresIn: '8h' });

      return reply.code(201).send(ok(201, 'SxUS', [{ token, usuario }]));
    },
  );

  /** POST /usuarios/login */
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login',
    { schema: loginSchema },
    async (req, reply) => {
      const usuario = await svc.login(req.body.email, req.body.password);
      const token = fastify.jwt.sign({
        sub:      usuario.id,
        username: usuario.username,
        email:    usuario.email,
        permisos: usuario.permisos,
      }, { expiresIn: '8h' });

      // El gateway es quien pone la cookie; el servicio solo devuelve token+usuario
      return reply.send(ok(200, 'SxUS', [{ token, usuario }]));
    },
  );

  // ═══════════════════════════════════════════════════════════════════
  // RUTAS PROTEGIDAS — el gateway ya verificó JWT y permisos
  // Usamos X-User-Id y X-User-Permisos para saber quién hace la petición
  // ═══════════════════════════════════════════════════════════════════

  /** GET /usuarios/me */
  fastify.get('/me', {}, async (req: any, reply) => {
    const id = getUserId(req);
    if (!id) return reply.code(401).send(fail(401, 'SxUS', 'No autenticado', 'Unauthorized'));
    const usuario = await svc.obtenerPorId(id);
    return reply.send(ok(200, 'SxUS', [usuario]));
  });

  /** GET /usuarios — lista paginada */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:  { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (req: any, reply) => {
    const { page = 1, limit = 20 } = req.query as any;
    const result = await svc.listar(page, limit);
    return reply.send(ok(200, 'SxUS', result));
  });

  /** GET /usuarios/:id */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: getPerfilSchema },
    async (req, reply) => {
      const usuario = await svc.obtenerPorId(req.params.id);
      return reply.send(ok(200, 'SxUS', [usuario]));
    },
  );

  /** PATCH /usuarios/:id */
  fastify.patch<{ Params: { id: string }; Body: UpdatePerfilDTO }>(
    '/:id',
    { schema: updatePerfilSchema },
    async (req: any, reply) => {
      const solicitanteId = getUserId(req);
      const permisos      = getPermisos(req);
      const targetId      = req.params.id;

      // Solo puede editar otro usuario si tiene user_edit o users_edit
      if (targetId !== solicitanteId && !permisos.includes('user_edit') && !permisos.includes('users_edit')) {
        return reply.code(403).send(fail(403, 'SxUS', 'Sin permiso para editar este usuario', 'Forbidden'));
      }

      const updated = await svc.actualizar(targetId, solicitanteId, req.body);
      return reply.send(ok(200, 'SxUS', [{ message: 'Perfil actualizado', usuario: updated }]));
    },
  );

  /** PUT /usuarios/:id/permisos */
  fastify.put<{ Params: { id: string }; Body: { permisos: string[] } }>(
    '/:id/permisos',
    { schema: updatePermisosSchema },
    async (req, reply) => {
      const permisos = await svc.actualizarPermisos(req.params.id, req.body.permisos);
      return reply.send(ok(200, 'SxUS', [{ message: 'Permisos actualizados', permisos }]));
    },
  );

  /** DELETE /usuarios/:id */
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: deleteUsuarioSchema },
    async (req: any, reply) => {
      await svc.eliminar(req.params.id, getUserId(req));
      return reply.send(ok(200, 'SxUS', [{ message: 'Usuario eliminado correctamente' }]));
    },
  );
};

export default usuariosRoutes;