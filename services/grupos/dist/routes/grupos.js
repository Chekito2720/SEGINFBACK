import { GrupoService } from '../services/grupo.service.js';
import { ok, fail } from '../helpers/response.js';
import { listGruposSchema, getGrupoSchema, createGrupoSchema, updateGrupoSchema, deleteGrupoSchema, listMiembrosSchema, addMiembroSchema, removeMiembroSchema, getPermisosContextualesSchema, updatePermisosContextualesSchema, misGruposSchema, getPermisosDefaultSchema, updatePermisosDefaultSchema, } from '../schemas/grupo.schema.js';
const gruposRoutes = async (fastify) => {
    const svc = new GrupoService(fastify.db);
    // ── Helpers ───────────────────────────────────────────────────────
    const getUserId = (req) => req.headers['x-user-id'] ?? '';
    const getPermisos = (req) => {
        try {
            return JSON.parse(req.headers['x-user-permisos'] ?? '[]');
        }
        catch {
            return [];
        }
    };
    // Verifica permiso de gestión: groups_manage O la combinación clásica
    const puedeGestionar = (permisos) => permisos.includes('groups_manage') ||
        permisos.includes('groups_add') ||
        permisos.includes('groups_edit') ||
        permisos.includes('groups_delete');
    // ═══════════════════════════════════════════════════════════════════
    // GET /grupos/mis-grupos — grupos del usuario autenticado
    // Sin permiso especial — cualquier usuario autenticado
    // ═══════════════════════════════════════════════════════════════════
    fastify.get('/mis-grupos', { schema: misGruposSchema }, async (req, reply) => {
        const data = await svc.misGrupos(getUserId(req));
        return reply.send(ok(200, 'SxGR', data));
    });
    // ═══════════════════════════════════════════════════════════════════
    // GET /grupos — listar todos
    // ═══════════════════════════════════════════════════════════════════
    fastify.get('/', { schema: listGruposSchema }, async (req, reply) => {
        const { page = 1, limit = 20 } = req.query;
        const result = await svc.listar(Number(page), Number(limit));
        return reply.send({
            statusCode: 200,
            intOpCode: 'SxGR200',
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit, pages: result.pages },
        });
    });
    // ═══════════════════════════════════════════════════════════════════
    // GET /grupos/:id
    // ═══════════════════════════════════════════════════════════════════
    fastify.get('/:id', { schema: getGrupoSchema }, async (req, reply) => {
        const grupo = await svc.obtenerPorId(req.params.id);
        return reply.send(ok(200, 'SxGR', grupo));
    });
    // ═══════════════════════════════════════════════════════════════════
    // POST /grupos — crear
    // Requiere groups_manage o groups_add
    // ═══════════════════════════════════════════════════════════════════
    fastify.post('/', { schema: createGrupoSchema }, async (req, reply) => {
        const permisos = getPermisos(req);
        if (!puedeGestionar(permisos)) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso groups_manage o groups_add', 'Forbidden'));
        }
        const grupo = await svc.crear(req.body, getUserId(req));
        return reply.code(201).send(ok(201, 'SxGR', grupo));
    });
    // ═══════════════════════════════════════════════════════════════════
    // PATCH /grupos/:id — actualizar
    // ═══════════════════════════════════════════════════════════════════
    fastify.patch('/:id', { schema: updateGrupoSchema }, async (req, reply) => {
        const permisos = getPermisos(req);
        if (!permisos.includes('groups_manage') && !permisos.includes('group_edit') && !permisos.includes('groups_edit')) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso para editar grupos', 'Forbidden'));
        }
        const grupo = await svc.actualizar(req.params.id, req.body);
        return reply.send(ok(200, 'SxGR', grupo));
    });
    // ═══════════════════════════════════════════════════════════════════
    // DELETE /grupos/:id
    // ═══════════════════════════════════════════════════════════════════
    fastify.delete('/:id', { schema: deleteGrupoSchema }, async (req, reply) => {
        const permisos = getPermisos(req);
        if (!permisos.includes('groups_manage') && !permisos.includes('group_delete') && !permisos.includes('groups_delete')) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso para eliminar grupos', 'Forbidden'));
        }
        await svc.eliminar(req.params.id);
        return reply.send(ok(200, 'SxGR', { message: 'Grupo eliminado correctamente' }));
    });
    // ═══════════════════════════════════════════════════════════════════
    // GET /grupos/:id/miembros
    // ═══════════════════════════════════════════════════════════════════
    fastify.get('/:id/miembros', { schema: listMiembrosSchema }, async (req, reply) => {
        const data = await svc.listarMiembros(req.params.id);
        return reply.send(ok(200, 'SxGR', data));
    });
    // ═══════════════════════════════════════════════════════════════════
    // POST /grupos/:id/miembros — añadir usuario al grupo
    // ═══════════════════════════════════════════════════════════════════
    fastify.post('/:id/miembros', { schema: addMiembroSchema }, async (req, reply) => {
        const permisos = getPermisos(req);
        if (!permisos.includes('groups_manage') && !permisos.includes('group_add')) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso group_add o groups_manage', 'Forbidden'));
        }
        await svc.agregarMiembro(req.params.id, req.body.usuarioId);
        return reply.code(201).send(ok(201, 'SxGR', { message: 'Usuario añadido al grupo' }));
    });
    // ═══════════════════════════════════════════════════════════════════
    // DELETE /grupos/:id/miembros/:uid — remover usuario del grupo
    // ═══════════════════════════════════════════════════════════════════
    fastify.delete('/:id/miembros/:uid', { schema: removeMiembroSchema }, async (req, reply) => {
        const permisos = getPermisos(req);
        if (!permisos.includes('groups_manage') && !permisos.includes('group_delete')) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso group_delete o groups_manage', 'Forbidden'));
        }
        await svc.removerMiembro(req.params.id, req.params.uid);
        return reply.send(ok(200, 'SxGR', { message: 'Usuario removido del grupo' }));
    });
    // ═══════════════════════════════════════════════════════════════════
    // GET /grupos/:id/miembros/:uid/permisos
    // Ver permisos contextuales de un usuario en este grupo
    // ═══════════════════════════════════════════════════════════════════
    fastify.get('/:id/miembros/:uid/permisos', { schema: getPermisosContextualesSchema }, async (req, reply) => {
        const data = await svc.getPermisosContextuales(req.params.id, req.params.uid);
        return reply.send(ok(200, 'SxGR', data));
    });
    // ═══════════════════════════════════════════════════════════════════
    // PUT /grupos/:id/miembros/:uid/permisos
    // Reemplazar permisos contextuales de un usuario en este grupo
    // ─────────────────────────────────────────────────────────────────
    // CASO DE USO PRINCIPAL:
    //   Usuario X tiene ticket_view global pero en el Grupo A
    //   necesita también ticket_add y ticket_state.
    //   Con este endpoint se asignan sin tocar sus permisos globales.
    // ═══════════════════════════════════════════════════════════════════
    fastify.put('/:id/miembros/:uid/permisos', { schema: updatePermisosContextualesSchema }, async (req, reply) => {
        const permisos = getPermisos(req);
        if (!permisos.includes('groups_manage') && !permisos.includes('group_edit')) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso groups_manage o group_edit', 'Forbidden'));
        }
        const result = await svc.updatePermisosContextuales(req.params.id, req.params.uid, req.body.permisos);
        return reply.send(ok(200, 'SxGR', result));
    });
    // ═══════════════════════════════════════════════════════════════════
    // GET /grupos/:id/permisos-default
    // ═══════════════════════════════════════════════════════════════════
    fastify.get('/:id/permisos-default', { schema: getPermisosDefaultSchema }, async (req, reply) => {
        const permisos = await svc.getPermisosDefault(req.params.id);
        return reply.send(ok(200, 'SxGR', { grupoId: req.params.id, permisos }));
    });
    // ═══════════════════════════════════════════════════════════════════
    // PUT /grupos/:id/permisos-default
    // ═══════════════════════════════════════════════════════════════════
    fastify.put('/:id/permisos-default', { schema: updatePermisosDefaultSchema }, async (req, reply) => {
        const permisos_req = getPermisos(req);
        if (!permisos_req.includes('groups_manage') && !permisos_req.includes('group_edit') && !permisos_req.includes('groups_edit')) {
            return reply.code(403).send(fail(403, 'SxGR', 'Se requiere permiso para editar permisos del grupo', 'Forbidden'));
        }
        const permisos = await svc.updatePermisosDefault(req.params.id, req.body.permisos);
        return reply.send(ok(200, 'SxGR', { grupoId: req.params.id, permisos, message: 'Permisos base actualizados' }));
    });
};
export default gruposRoutes;
//# sourceMappingURL=grupos.js.map