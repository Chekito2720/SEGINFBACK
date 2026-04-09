import { Pool } from 'pg';

// ─── DTOs ─────────────────────────────────────────────────────────────────────
export interface CreateGrupoDTO {
  nombre:       string;
  descripcion?: string | null;
  nivel?:       string | null;
  model?:       string | null;
  color?:       string | null;
}

export interface UpdateGrupoDTO {
  nombre?:      string;
  descripcion?: string | null;
  nivel?:       string | null;
  model?:       string | null;
  color?:       string | null;
}

// ─── Query base ───────────────────────────────────────────────────────────────
const GRUPO_SELECT = `
  g.id,
  g.nombre,
  g.descripcion,
  g.nivel,
  g.model,
  g.color,
  g.creator_id           AS "creatorId",
  u.nombre_completo      AS "creatorNombre",
  g.creado_en            AS "creadoEn",
  COUNT(DISTINCT gm.usuario_id)::int  AS "totalMiembros",
  COUNT(DISTINCT t.id)::int           AS "totalTickets"
`;

const GRUPO_JOINS = `
  LEFT JOIN usuarios u   ON u.id  = g.creator_id
  LEFT JOIN grupo_miembros gm ON gm.grupo_id = g.id
  LEFT JOIN tickets t    ON t.grupo_id = g.id
`;

export class GrupoService {
  constructor(private db: Pool) {}

  // ═══════════════════════════════════════════════════════════════════
  // LISTAR
  // ═══════════════════════════════════════════════════════════════════
  async listar(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [rows, countRow] = await Promise.all([
      this.db.query(
        `SELECT ${GRUPO_SELECT} FROM grupos g ${GRUPO_JOINS}
         GROUP BY g.id, u.nombre_completo
         ORDER BY g.creado_en DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.db.query('SELECT COUNT(*) FROM grupos'),
    ]);

    const total = Number(countRow.rows[0].count);
    return { items: rows.rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ═══════════════════════════════════════════════════════════════════
  // MIS GRUPOS — grupos del usuario autenticado + sus permisos contextuales
  // ═══════════════════════════════════════════════════════════════════
  async misGrupos(userId: string) {
    // NOTA: No se usa GRUPO_JOINS aquí porque el alias `gm` se necesita filtrado
    // por usuario (INNER JOIN) para obtener solo los grupos del usuario,
    // mientras que totalMiembros requiere contar TODOS los miembros del grupo.
    const rows = await this.db.query(
      `SELECT
         g.id,
         g.nombre,
         g.descripcion,
         g.nivel,
         g.model,
         g.color,
         g.creator_id                                          AS "creatorId",
         u.nombre_completo                                     AS "creatorNombre",
         g.creado_en                                           AS "creadoEn",
         (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS "totalMiembros",
         COUNT(DISTINCT t.id)::int                             AS "totalTickets",
         COALESCE(
           json_agg(p.nombre) FILTER (WHERE p.nombre IS NOT NULL),
           '[]'
         )                                                     AS "permisosEnGrupo"
       FROM grupos g
       INNER JOIN grupo_miembros gm   ON gm.grupo_id = g.id AND gm.usuario_id = $1
       LEFT JOIN  usuarios u           ON u.id = g.creator_id
       LEFT JOIN  tickets t            ON t.grupo_id = g.id
       LEFT JOIN  grupo_usuario_permisos gup
                                       ON gup.grupo_id = g.id AND gup.usuario_id = $1
       LEFT JOIN  permisos p           ON p.id = gup.permiso_id
       GROUP BY g.id, u.nombre_completo
       ORDER BY g.creado_en DESC`,
      [userId],
    );
    return rows.rows;
  }

  // ═══════════════════════════════════════════════════════════════════
  // OBTENER POR ID
  // ═══════════════════════════════════════════════════════════════════
  async obtenerPorId(id: string) {
    const result = await this.db.query(
      `SELECT ${GRUPO_SELECT} FROM grupos g ${GRUPO_JOINS}
       WHERE g.id = $1
       GROUP BY g.id, u.nombre_completo`,
      [id],
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('Grupo no encontrado'), { statusCode: 404 });
    }
    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREAR
  // ═══════════════════════════════════════════════════════════════════
  async crear(dto: CreateGrupoDTO, creatorId: string) {
    const result = await this.db.query(
      `INSERT INTO grupos (nombre, descripcion, nivel, model, color, creator_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        dto.nombre,
        dto.descripcion ?? null,
        dto.nivel       ?? null,
        dto.model       ?? null,
        dto.color       ?? null,
        creatorId,
      ],
    );

    // El creador se añade automáticamente como primer miembro
    await this.db.query(
      'INSERT INTO grupo_miembros (grupo_id, usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [result.rows[0].id, creatorId],
    );

    return this.obtenerPorId(result.rows[0].id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTUALIZAR
  // ═══════════════════════════════════════════════════════════════════
  async actualizar(id: string, dto: UpdateGrupoDTO) {
    await this.obtenerPorId(id);

    const fields: string[]  = [];
    const values: unknown[] = [];
    let   idx = 1;

    if (dto.nombre      !== undefined) { fields.push(`nombre = $${idx++}`);      values.push(dto.nombre);      }
    if (dto.descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); values.push(dto.descripcion); }
    if (dto.nivel       !== undefined) { fields.push(`nivel = $${idx++}`);       values.push(dto.nivel);       }
    if (dto.model       !== undefined) { fields.push(`model = $${idx++}`);       values.push(dto.model);       }
    if (dto.color       !== undefined) { fields.push(`color = $${idx++}`);       values.push(dto.color);       }

    if (fields.length === 0) {
      throw Object.assign(new Error('Sin campos para actualizar'), { statusCode: 400 });
    }

    values.push(id);
    await this.db.query(
      `UPDATE grupos SET ${fields.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return this.obtenerPorId(id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ELIMINAR
  // ═══════════════════════════════════════════════════════════════════
  async eliminar(id: string) {
    await this.obtenerPorId(id);
    // CASCADE elimina grupo_miembros y grupo_usuario_permisos automáticamente
    await this.db.query('DELETE FROM grupos WHERE id = $1', [id]);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MIEMBROS — listar
  // ═══════════════════════════════════════════════════════════════════
  async listarMiembros(grupoId: string) {
    await this.obtenerPorId(grupoId);

    const result = await this.db.query(
      `SELECT
         u.id                    AS "usuarioId",
         u.nombre_completo       AS "fullName",
         u.username,
         u.email,
         gm.fecha_unido          AS "fechaUnido",
         COALESCE(
           json_agg(p.nombre) FILTER (WHERE p.nombre IS NOT NULL),
           '[]'
         ) AS "permisosGrupo"
       FROM grupo_miembros gm
       JOIN usuarios u   ON u.id  = gm.usuario_id
       LEFT JOIN grupo_usuario_permisos gup
         ON gup.grupo_id = gm.grupo_id AND gup.usuario_id = gm.usuario_id
       LEFT JOIN permisos p ON p.id = gup.permiso_id
       WHERE gm.grupo_id = $1
       GROUP BY u.id, gm.fecha_unido
       ORDER BY gm.fecha_unido ASC`,
      [grupoId],
    );

    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════
  // MIEMBROS — añadir
  // ═══════════════════════════════════════════════════════════════════
  async agregarMiembro(grupoId: string, usuarioId: string) {
    await this.obtenerPorId(grupoId);

    // Verificar que el usuario existe
    const user = await this.db.query('SELECT id FROM usuarios WHERE id = $1', [usuarioId]);
    if (!user.rows[0]) {
      throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });
    }

    // Verificar que no sea ya miembro
    const existe = await this.db.query(
      'SELECT 1 FROM grupo_miembros WHERE grupo_id=$1 AND usuario_id=$2',
      [grupoId, usuarioId],
    );
    if (existe.rows[0]) {
      throw Object.assign(new Error('El usuario ya es miembro de este grupo'), { statusCode: 409 });
    }

    await this.db.query(
      'INSERT INTO grupo_miembros (grupo_id, usuario_id) VALUES ($1,$2)',
      [grupoId, usuarioId],
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MIEMBROS — remover
  // ═══════════════════════════════════════════════════════════════════
  async removerMiembro(grupoId: string, usuarioId: string) {
    await this.obtenerPorId(grupoId);

    const result = await this.db.query(
      'DELETE FROM grupo_miembros WHERE grupo_id=$1 AND usuario_id=$2 RETURNING usuario_id',
      [grupoId, usuarioId],
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('El usuario no pertenece a este grupo'), { statusCode: 404 });
    }

    // Al remover el miembro, también borrar sus permisos contextuales en ese grupo
    await this.db.query(
      'DELETE FROM grupo_usuario_permisos WHERE grupo_id=$1 AND usuario_id=$2',
      [grupoId, usuarioId],
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PERMISOS CONTEXTUALES — obtener
  // ═══════════════════════════════════════════════════════════════════
  async getPermisosContextuales(grupoId: string, usuarioId: string) {
    await this.obtenerPorId(grupoId);

    const result = await this.db.query(
      `SELECT
         gup.grupo_id     AS "grupoId",
         gup.usuario_id   AS "usuarioId",
         u.nombre_completo AS "fullName",
         COALESCE(
           json_agg(p.nombre) FILTER (WHERE p.nombre IS NOT NULL),
           '[]'
         ) AS "permisosGrupo"
       FROM usuarios u
       LEFT JOIN grupo_usuario_permisos gup
         ON gup.usuario_id = u.id AND gup.grupo_id = $1
       LEFT JOIN permisos p ON p.id = gup.permiso_id
       WHERE u.id = $2
       GROUP BY gup.grupo_id, gup.usuario_id, u.nombre_completo`,
      [grupoId, usuarioId],
    );

    return {
      grupoId,
      usuarioId,
      fullName:      result.rows[0]?.fullName ?? '—',
      permisosGrupo: result.rows[0]?.permisosGrupo ?? [],
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PERMISOS CONTEXTUALES — actualizar (replace)
  //
  // Este es el endpoint clave:
  // PUT /grupos/:id/miembros/:uid/permisos
  // { "permisos": ["ticket_add", "ticket_edit", "ticket_state"] }
  //
  // Permite definir que el usuario X tenga "tickets:add" en el grupo A
  // pero no en el grupo B — sin tocar sus permisos globales.
  // ═══════════════════════════════════════════════════════════════════
  async updatePermisosContextuales(grupoId: string, usuarioId: string, permisos: string[]) {
    await this.obtenerPorId(grupoId);

    // Verificar que el usuario es miembro del grupo
    const esMiembro = await this.db.query(
      'SELECT 1 FROM grupo_miembros WHERE grupo_id=$1 AND usuario_id=$2',
      [grupoId, usuarioId],
    );
    if (!esMiembro.rows[0]) {
      throw Object.assign(
        new Error('El usuario no es miembro de este grupo'),
        { statusCode: 404 },
      );
    }

    // Validar que todos los permisos existen en el catálogo
    if (permisos.length > 0) {
      const validos = await this.db.query(
        'SELECT id, nombre FROM permisos WHERE nombre = ANY($1)',
        [permisos],
      );
      const invalidos = permisos.filter(p => !validos.rows.some((r: any) => r.nombre === p));
      if (invalidos.length > 0) {
        throw Object.assign(
          new Error(`Permisos inválidos: ${invalidos.join(', ')}`),
          { statusCode: 400 },
        );
      }

      // DELETE + INSERT atómico en una transacción
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          'DELETE FROM grupo_usuario_permisos WHERE grupo_id=$1 AND usuario_id=$2',
          [grupoId, usuarioId],
        );

        if (validos.rows.length > 0) {
          const placeholders = validos.rows
            .map((_: any, i: number) => `($1, $2, $${i + 3})`)
            .join(', ');
          await client.query(
            `INSERT INTO grupo_usuario_permisos (grupo_id, usuario_id, permiso_id)
             VALUES ${placeholders}
             ON CONFLICT DO NOTHING`,
            [grupoId, usuarioId, ...validos.rows.map((r: any) => r.id)],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Lista vacía = borrar todos los permisos contextuales
      await this.db.query(
        'DELETE FROM grupo_usuario_permisos WHERE grupo_id=$1 AND usuario_id=$2',
        [grupoId, usuarioId],
      );
    }

    return {
      grupoId,
      usuarioId,
      permisosGrupo: permisos,
      message: 'Permisos contextuales actualizados correctamente',
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPER — verificar si un usuario tiene acceso al grupo
  // ═══════════════════════════════════════════════════════════════════
  async verificarAcceso(grupoId: string, userId: string, permisos: string[]): Promise<boolean> {
    // Con groups_view o groups_manage → acceso total
    if (permisos.includes('groups_view') || permisos.includes('groups_manage')) return true;

    // Con group_view → solo si es miembro
    if (permisos.includes('group_view')) {
      const miembro = await this.db.query(
        'SELECT 1 FROM grupo_miembros WHERE grupo_id=$1 AND usuario_id=$2',
        [grupoId, userId],
      );
      return !!miembro.rows[0];
    }

    return false;
  }
}