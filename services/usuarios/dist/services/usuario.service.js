import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
export class UsuarioService {
    db;
    bcryptRounds;
    constructor(db, bcryptRounds = 10) {
        this.db = db;
        this.bcryptRounds = bcryptRounds;
    }
    // ═══════════════════════════════════════════════════════════════════
    // REGISTRO
    // ═══════════════════════════════════════════════════════════════════
    async registrar(dto) {
        // 1. Validar edad mínima (18 años)
        this.validarEdadMinima(dto.birthDate);
        // 2. Verificar que email y username no existan
        const existe = await this.db.query(`SELECT id, email, username FROM usuarios
       WHERE email = $1 OR username = $2`, [dto.email.toLowerCase(), dto.username.toLowerCase()]);
        if (existe.rows.length > 0) {
            const conflicto = existe.rows[0].email === dto.email.toLowerCase()
                ? 'El correo ya está registrado'
                : 'El nombre de usuario ya está en uso';
            throw Object.assign(new Error(conflicto), { statusCode: 409 });
        }
        // 3. Hash de contraseña
        const hash = await bcrypt.hash(dto.password, this.bcryptRounds);
        // 4. Insertar usuario
        const result = await this.db.query(`INSERT INTO usuarios
         (nombre_completo, username, email, password_hash, telefono, direccion, fecha_nacimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre_completo, username, email, creado_en`, [
            dto.fullName,
            dto.username.toLowerCase(),
            dto.email.toLowerCase(),
            hash,
            dto.phone,
            dto.address,
            dto.birthDate,
        ]);
        // 5. Asignar permisos básicos de lectura al nuevo usuario
        const PERMISOS_BASICOS = [
            'groups_view', 'group_view',
            'users_view', 'user_view',
            'tickets_view', 'ticket_view',
        ];
        const permisosResult = await this.db.query(`SELECT id FROM permisos WHERE nombre = ANY($1)`, [PERMISOS_BASICOS]);
        if (permisosResult.rows.length > 0) {
            const values = permisosResult.rows
                .map((_, i) => `($1, $${i + 2})`)
                .join(', ');
            await this.db.query(`INSERT INTO usuario_permisos (usuario_id, permiso_id)
         VALUES ${values}
         ON CONFLICT DO NOTHING`, [result.rows[0].id, ...permisosResult.rows.map((p) => p.id)]);
        }
        return result.rows[0];
    }
    // ═══════════════════════════════════════════════════════════════════
    // LOGIN
    // ═══════════════════════════════════════════════════════════════════
    async login(email, password) {
        const result = await this.db.query(`SELECT u.id, u.nombre_completo, u.username, u.email, u.password_hash,
              COALESCE(
                json_agg(p.nombre) FILTER (WHERE p.nombre IS NOT NULL),
                '[]'
              ) AS permisos
       FROM usuarios u
       LEFT JOIN usuario_permisos up ON up.usuario_id = u.id
       LEFT JOIN permisos p ON p.id = up.permiso_id
       WHERE u.email = $1
       GROUP BY u.id`, [email.toLowerCase()]);
        if (result.rows.length === 0) {
            throw Object.assign(new Error('Credenciales incorrectas'), { statusCode: 401 });
        }
        const usuario = result.rows[0];
        const passwordOk = await bcrypt.compare(password, usuario.password_hash);
        if (!passwordOk) {
            throw Object.assign(new Error('Credenciales incorrectas'), { statusCode: 401 });
        }
        // Actualizar last_login
        await this.db.query(`UPDATE usuarios SET last_login = NOW() WHERE id = $1`, [usuario.id]);
        // Si el usuario no tiene permisos, asignar los permisos básicos de lectura
        if (usuario.permisos.length === 0) {
            const PERMISOS_BASICOS = [
                'groups_view', 'group_view',
                'users_view', 'user_view',
                'tickets_view', 'ticket_view',
            ];
            const permisosResult = await this.db.query(`SELECT id, nombre FROM permisos WHERE nombre = ANY($1)`, [PERMISOS_BASICOS]);
            if (permisosResult.rows.length > 0) {
                const values = permisosResult.rows
                    .map((_, i) => `($1, $${i + 2})`)
                    .join(', ');
                await this.db.query(`INSERT INTO usuario_permisos (usuario_id, permiso_id)
           VALUES ${values}
           ON CONFLICT DO NOTHING`, [usuario.id, ...permisosResult.rows.map(p => p.id)]);
                usuario.permisos = permisosResult.rows.map(p => p.nombre);
            }
        }
        // No devolver el hash
        const { password_hash, ...usuarioSinHash } = usuario;
        return usuarioSinHash;
    }
    // ═══════════════════════════════════════════════════════════════════
    // OBTENER PERFIL
    // ═══════════════════════════════════════════════════════════════════
    async obtenerPorId(id) {
        const result = await this.db.query(`SELECT u.id, u.nombre_completo, u.username, u.email,
              u.telefono, u.direccion, u.fecha_nacimiento,
              u.last_login, u.creado_en,
              COALESCE(
                json_agg(DISTINCT p.nombre) FILTER (WHERE p.nombre IS NOT NULL),
                '[]'
              ) AS permisos,
              COALESCE(
                json_agg(DISTINCT gm.grupo_id::text) FILTER (WHERE gm.grupo_id IS NOT NULL),
                '[]'
              ) AS grupo_ids
       FROM usuarios u
       LEFT JOIN usuario_permisos up ON up.usuario_id = u.id
       LEFT JOIN permisos p          ON p.id = up.permiso_id
       LEFT JOIN grupo_miembros gm   ON gm.usuario_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`, [id]);
        if (result.rows.length === 0) {
            throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });
        }
        return result.rows[0];
    }
    // ═══════════════════════════════════════════════════════════════════
    // LISTAR TODOS (solo superadmin)
    // ═══════════════════════════════════════════════════════════════════
    async listar(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const [usuarios, total] = await Promise.all([
            this.db.query(`SELECT u.id, u.nombre_completo, u.username, u.email,
                u.last_login, u.creado_en,
                COALESCE(
                  json_agg(DISTINCT p.nombre) FILTER (WHERE p.nombre IS NOT NULL),
                  '[]'
                ) AS permisos,
                COALESCE(
                  json_agg(DISTINCT gm.grupo_id::text) FILTER (WHERE gm.grupo_id IS NOT NULL),
                  '[]'
                ) AS grupo_ids
         FROM usuarios u
         LEFT JOIN usuario_permisos up ON up.usuario_id = u.id
         LEFT JOIN permisos p          ON p.id = up.permiso_id
         LEFT JOIN grupo_miembros gm   ON gm.usuario_id = u.id
         GROUP BY u.id
         ORDER BY u.creado_en DESC
         LIMIT $1 OFFSET $2`, [limit, offset]),
            this.db.query('SELECT COUNT(*) FROM usuarios'),
        ]);
        return {
            data: usuarios.rows,
            total: Number(total.rows[0].count),
            page,
            limit,
            pages: Math.ceil(Number(total.rows[0].count) / limit),
        };
    }
    // ═══════════════════════════════════════════════════════════════════
    // ACTUALIZAR PERFIL
    // ═══════════════════════════════════════════════════════════════════
    async actualizar(id, solicitanteId, dto) {
        const usuario = await this.obtenerPorId(id);
        // Solo el propio usuario puede editar su perfil
        // (el superadmin puede editar cualquiera — se valida en la ruta)
        const fields = [];
        const values = [];
        let idx = 1;
        if (dto.nombre_completo) {
            fields.push(`nombre_completo = $${idx++}`);
            values.push(dto.nombre_completo);
        }
        if (dto.username) {
            // Verificar unicidad del nuevo username
            const dup = await this.db.query('SELECT id FROM usuarios WHERE username = $1 AND id != $2', [dto.username.toLowerCase(), id]);
            if (dup.rows.length > 0) {
                throw Object.assign(new Error('Username ya en uso'), { statusCode: 409 });
            }
            fields.push(`username = $${idx++}`);
            values.push(dto.username.toLowerCase());
        }
        if (dto.telefono !== undefined) {
            fields.push(`telefono = $${idx++}`);
            values.push(dto.telefono);
        }
        if (dto.direccion !== undefined) {
            fields.push(`direccion = $${idx++}`);
            values.push(dto.direccion);
        }
        // Cambio de contraseña
        if (dto.password_nuevo) {
            if (!dto.password_actual) {
                throw Object.assign(new Error('Se requiere la contraseña actual para cambiarla'), { statusCode: 400 });
            }
            // Re-fetch hash para verificar
            const row = await this.db.query('SELECT password_hash FROM usuarios WHERE id = $1', [id]);
            const hashOk = await bcrypt.compare(dto.password_actual, row.rows[0].password_hash);
            if (!hashOk) {
                throw Object.assign(new Error('Contraseña actual incorrecta'), { statusCode: 400 });
            }
            const nuevoHash = await bcrypt.hash(dto.password_nuevo, this.bcryptRounds);
            fields.push(`password_hash = $${idx++}`);
            values.push(nuevoHash);
        }
        if (fields.length === 0) {
            throw Object.assign(new Error('Sin campos para actualizar'), { statusCode: 400 });
        }
        values.push(id);
        const result = await this.db.query(`UPDATE usuarios SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, nombre_completo, username, email`, values);
        return result.rows[0];
    }
    // ═══════════════════════════════════════════════════════════════════
    // ACTUALIZAR PERMISOS (solo superadmin)
    // ═══════════════════════════════════════════════════════════════════
    async actualizarPermisos(usuarioId, permisos) {
        // Verificar que el usuario existe
        await this.obtenerPorId(usuarioId);
        // Obtener UUIDs de los permisos por nombre
        const permisosResult = await this.db.query(`SELECT id, nombre FROM permisos WHERE nombre = ANY($1)`, [permisos]);
        const permisosValidos = permisosResult.rows;
        const nombresInvalidos = permisos.filter(p => !permisosValidos.some(pv => pv.nombre === p));
        if (nombresInvalidos.length > 0) {
            throw Object.assign(new Error(`Permisos inválidos: ${nombresInvalidos.join(', ')}`), { statusCode: 400 });
        }
        // Reemplazar todos los permisos (delete + insert)
        await this.db.query('DELETE FROM usuario_permisos WHERE usuario_id = $1', [usuarioId]);
        if (permisosValidos.length > 0) {
            const values = permisosValidos
                .map((p, i) => `($1, $${i + 2})`)
                .join(', ');
            await this.db.query(`INSERT INTO usuario_permisos (usuario_id, permiso_id) VALUES ${values}`, [usuarioId, ...permisosValidos.map(p => p.id)]);
        }
        return permisos;
    }
    // ═══════════════════════════════════════════════════════════════════
    // ELIMINAR
    // ═══════════════════════════════════════════════════════════════════
    async eliminar(id, solicitanteId) {
        if (id === solicitanteId) {
            throw Object.assign(new Error('No puedes eliminar tu propia cuenta'), { statusCode: 403 });
        }
        const result = await this.db.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });
        }
    }
    // ═══════════════════════════════════════════════════════════════════
    // HELPERS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════
    /**
     * Valida que el usuario tenga al menos 18 años.
     * fecha: YYYY-MM-DD
     */
    validarEdadMinima(fecha, edadMinima = 18) {
        const nacimiento = new Date(fecha);
        if (isNaN(nacimiento.getTime())) {
            throw Object.assign(new Error('Fecha de nacimiento inválida'), { statusCode: 400 });
        }
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        // Ajustar si aún no ha llegado el cumpleaños este año
        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        if (edad < edadMinima) {
            throw Object.assign(new Error(`Debes tener al menos ${edadMinima} años para registrarte`), { statusCode: 400 });
        }
    }
}
//# sourceMappingURL=usuario.service.js.map