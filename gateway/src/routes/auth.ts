import type { FastifyPluginAsync } from 'fastify';
import { ok, fail }           from '../helpers/response.js';

const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 horas en segundos

const authRoutes: FastifyPluginAsync = async (fastify) => {

  // ═══════════════════════════════════════════════════════════════════
  // POST /auth/register
  // ═══════════════════════════════════════════════════════════════════
  fastify.post<{
    Body: {
      fullName:        string;
      username:        string;
      email:           string;
      phone:           string;
      birthDate:       string;
      address:         string;
      password:        string;
      confirmPassword: string;
    }
  }>('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: [
          'fullName', 'username', 'email',
          'phone', 'birthDate', 'address',
          'password', 'confirmPassword',
        ],
        additionalProperties: false,
        properties: {
          fullName:        { type: 'string', minLength: 3 },
          username:        { type: 'string', minLength: 3, pattern: '^[a-zA-Z0-9_]+$' },
          email:           { type: 'string', format: 'email' },
          phone:           { type: 'string', minLength: 8 },
          birthDate:       { type: 'string', format: 'date' },
          address:         { type: 'string', minLength: 1 },
          password: {
            type: 'string',
            minLength: 10,
            pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"|,.<>\\/?]).{10,}$',
          },
          confirmPassword: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const svcUrl = `${process.env.USUARIOS_URL ?? 'http://localhost:3001'}/usuarios/registro`;

      // Reenviar exactamente los mismos campos en inglés al microservicio
      const svcRes = await fetch(svcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(req.body),
      });

      const svcData: any = await svcRes.json();

      if (!svcRes.ok) {
        return reply.code(svcRes.status).send(
          fail(svcRes.status, 'SxUS', svcData.message ?? 'Error en el registro', svcData.error),
        );
      }

      // svcData.data[0] = { token, usuario }
      const { token, usuario } = svcData.data?.[0] ?? svcData;

      // Guardar token en cookie httpOnly
      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   COOKIE_MAX_AGE,
        path:     '/',
      });

      return reply.code(201).send(
        ok(201, 'SxUS', {
          message: '¡Cuenta creada exitosamente!',
          usuario: {
            id:        usuario.id,
            fullName:  usuario.fullName,
            username:  usuario.username,
            email:     usuario.email,
            createdAt: usuario.createdAt,
          },
        }),
      );

    } catch (err) {
      fastify.log.error(err);
      return reply.code(502).send(
        fail(502, 'SxGW', 'Servicio de usuarios no disponible', 'Bad Gateway'),
      );
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // POST /auth/login
  // ═══════════════════════════════════════════════════════════════════
  fastify.post<{
    Body: { email: string; password: string }
  }>('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const svcUrl = `${process.env.USUARIOS_URL ?? 'http://localhost:3001'}/usuarios/login`;

      const svcRes = await fetch(svcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(req.body),
      });

      const svcData: any = await svcRes.json();

      if (!svcRes.ok) {
        return reply.code(svcRes.status).send(
          fail(svcRes.status, 'SxUS', svcData.message ?? 'Error de autenticación', svcData.error),
        );
      }

      const { token, usuario } = svcData.data?.[0] ?? svcData;

      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   COOKIE_MAX_AGE,
        path:     '/',
      });

      // Obtener grupos del usuario
      let groups: unknown[] = [];
      try {
        const gruposUrl = `${process.env.GRUPOS_URL ?? 'http://localhost:3003'}/grupos/mis-grupos`;
        const gruposRes = await fetch(gruposUrl, {
          headers: { 'x-user-id': usuario.id, 'x-user-permisos': JSON.stringify(usuario.permisos ?? []) },
        });
        if (gruposRes.ok) {
          const gruposData: any = await gruposRes.json();
          groups = gruposData.data ?? [];
        }
      } catch { /* no bloquear el login si grupos falla */ }

      return reply.send(
        ok(200, 'SxUS', {
          token,
          user: {
            id:          usuario.id,
            fullName:    usuario.nombre_completo ?? usuario.fullName ?? '',
            username:    usuario.username,
            email:       usuario.email,
            permissions: usuario.permisos ?? [],
          },
          groups,
        }),
      );

    } catch (err) {
      fastify.log.error(err);
      return reply.code(502).send(
        fail(502, 'SxGW', 'Servicio de usuarios no disponible', 'Bad Gateway'),
      );
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // POST /auth/logout
  // ═══════════════════════════════════════════════════════════════════
  fastify.post('/auth/logout', async (req, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return reply.send(ok(200, 'SxGW', { message: 'Sesión cerrada correctamente' }));
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /auth/me
  // ═══════════════════════════════════════════════════════════════════
  fastify.get('/auth/me', async (req: any, reply) => {
    const payload = req.jwtPayload;
    if (!payload) {
      return reply.code(401).send(fail(401, 'SxGW', 'No autenticado', 'Unauthorized'));
    }
    return reply.send(
      ok(200, 'SxGW', {
        id:       payload.sub,
        username: payload.username,
        email:    payload.email,
        permisos: payload.permisos ?? [],
      }),
    );
  });
};

export default authRoutes;