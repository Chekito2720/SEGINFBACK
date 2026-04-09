import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PERMISSION_MAP, PUBLIC_ROUTES, AUTH_ONLY_ROUTES } from '../config/permissions.map.js';
import { fail } from '../helpers/response.js';

/**
 * Convierte una URL real con valores en su patrón con :param
 * Ej: /tickets/abc-123/status → /tickets/:id/status
 */
function urlToPattern(url: string): string {
  const path = url.split('?')[0] ?? url;   // quitar query string
  return path
    .replace(/\/[0-9a-f-]{36}/gi, '/:id')  // UUID
    .replace(/\/\d+/g, '/:id');            // IDs numéricos
}

/**
 * Extrae el token de la cookie firmada o del header Authorization
 */
function extractToken(req: FastifyRequest): string | null {
  // 1. Cookie (preferido)
  const fromCookie = (req.cookies as any)?.auth_token;
  if (fromCookie) return fromCookie;

  // 2. Authorization: Bearer <token> (fallback para pruebas con Postman)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

const permissionCheckerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const url    = req.url;
    const method = req.method.toUpperCase();

    // ── 1. Rutas públicas — pasar sin verificar ──────────────────────
    const esPublica = PUBLIC_ROUTES.some((r: string) => url.startsWith(r));
    if (esPublica) return;

    // ── 2. Extraer y verificar JWT ───────────────────────────────────
    const token = extractToken(req);

    if (!token) {
      return reply.code(401).send(fail(401, 'SxGW', 'Token de autenticación requerido', 'Unauthorized'));
    }

    let payload: any;
    try {
      payload = fastify.jwt.verify(token);
      (req as any).jwtPayload = payload;
    } catch {
      return reply.code(401).send(fail(401, 'SxGW', 'Token inválido o expirado', 'Unauthorized'));
    }

    // ── 3. Adjuntar payload al header para el microservicio ──────────
    // Se hace aquí para que todos los microservicios reciban los headers,
    // independientemente de si la ruta está en el mapa de permisos.
    req.headers['x-user-id']       = payload.sub;
    req.headers['x-user-permisos'] = JSON.stringify(payload.permisos ?? []);
    req.headers['x-user-email']    = payload.email;

    // ── 4. Rutas que solo necesitan autenticación ────────────────────
    const soloAuth = AUTH_ONLY_ROUTES.some((r: string) => url.startsWith(r));
    if (soloAuth) return;

    // ── 5. Buscar permiso requerido en el mapa ───────────────────────
    const pattern   = urlToPattern(url);
    const mapKey    = `${method} ${pattern}`;
    const ruleEntry = PERMISSION_MAP[mapKey];

    // Si la ruta no está en el mapa, dejar pasar
    // (el microservicio tiene su propia validación interna)
    if (!ruleEntry) return;

    // ── 6. Verificar que el JWT contiene el permiso ──────────────────
    const permisos: string[] = payload.permisos ?? [];
    const tienePermiso = permisos.includes(ruleEntry.permiso);

    if (!tienePermiso) {
      fastify.log.warn({
        userId:   payload.sub,
        url,
        method,
        permiso:  ruleEntry.permiso,
        msg: 'Acceso denegado — permiso insuficiente',
      });

      return reply.code(403).send(
        fail(403, 'SxGW', `Permiso requerido: ${ruleEntry.permiso}`, 'Forbidden'),
      );
    }

    // ── 7. Validación contextual (si existe) ─────────────────────────
    if (ruleEntry.contextCheck) {
      const urlParts   = url.split('/').filter(Boolean);
      const params: Record<string, string> = {};

      // Extraer el primer segmento que parece un UUID o número como :id
      const idMatch = urlParts.find(p => /^[0-9a-f-]{36}$/.test(p) || /^\d+$/.test(p));
      if (idMatch) params['id'] = idMatch;

      const pasa = ruleEntry.contextCheck(payload, params);
      if (!pasa) {
        return reply.code(403).send(
          fail(403, 'SxGW', 'No tienes acceso a este recurso', 'Forbidden'),
        );
      }
    }
  });
};

export default fp(permissionCheckerPlugin, { name: 'permission-checker' });