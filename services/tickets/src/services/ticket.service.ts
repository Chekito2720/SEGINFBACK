import { Pool } from 'pg';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CreateTicketDTO {
  grupoId:      string;
  titulo:       string;
  descripcion?: string | null;
  asignadoId?:  string | null;
  estado:       string;    // nombre del estado (ej: 'pendiente')
  prioridad:    string;    // nombre de la prioridad (ej: 'media')
  fechaFinal?:  string | null;
}

export interface UpdateTicketDTO {
  titulo?:       string;
  descripcion?:  string | null;
  asignadoId?:   string | null;
  prioridad?:    string;   // nombre de la prioridad
  fechaFinal?:   string | null;
}

export interface ListTicketsFilter {
  grupoId?:    string;
  estado?:     string;
  prioridad?:  string;
  asignadoId?: string;
  page:        number;
  limit:       number;
  userId:      string;
  permisos:    string[];
}

// ─── Query base reutilizable ──────────────────────────────────────────────────
const TICKET_SELECT = `
  t.id,
  t.grupo_id                            AS "grupoId",
  t.titulo,
  t.descripcion,
  t.autor_id                            AS "autorId",
  ua.nombre_completo                    AS "autorNombre",
  t.asignado_id                         AS "asignadoId",
  uas.nombre_completo                   AS "asignadoNombre",
  e.nombre                              AS estado,
  e.color                               AS "estadoColor",
  p.nombre                              AS prioridad,
  p.orden                               AS "prioridadOrden",
  t.fecha_final                         AS "fechaFinal",
  t.creado_en                           AS "creadoEn"
`;

const TICKET_JOINS = `
  LEFT JOIN usuarios ua  ON ua.id  = t.autor_id
  LEFT JOIN usuarios uas ON uas.id = t.asignado_id
  LEFT JOIN estados  e   ON e.id   = t.estado_id
  LEFT JOIN prioridades p ON p.id  = t.prioridad_id
`;

export class TicketService {
  constructor(private db: Pool) {}

  // ─── Helpers: resolución de catálogos por nombre ──────────────────
  private async resolverEstadoId(nombre: string): Promise<string> {
    const r = await this.db.query('SELECT id FROM estados WHERE nombre = $1', [nombre]);
    if (!r.rows[0]) throw Object.assign(new Error(`Estado inválido: ${nombre}`), { statusCode: 400 });
    return r.rows[0].id;
  }

  private async resolverPrioridadId(nombre: string): Promise<string> {
    const r = await this.db.query('SELECT id FROM prioridades WHERE nombre = $1', [nombre]);
    if (!r.rows[0]) throw Object.assign(new Error(`Prioridad inválida: ${nombre}`), { statusCode: 400 });
    return r.rows[0].id;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LISTAR
  // ═══════════════════════════════════════════════════════════════════
  async listar(filter: ListTicketsFilter) {
    const { page, limit, userId, permisos } = filter;
    const offset = (page - 1) * limit;

    const canViewAll = permisos.includes('tickets_view');

    const conditions: string[] = [];
    const values:     unknown[] = [];
    let   idx = 1;

    if (filter.grupoId) {
      conditions.push(`t.grupo_id = $${idx++}`);
      values.push(filter.grupoId);
    }
    if (!canViewAll) {
      conditions.push(`t.asignado_id = $${idx++}`);
      values.push(userId);
    }
    if (filter.estado) {
      conditions.push(`e.nombre = $${idx++}`);
      values.push(filter.estado);
    }
    if (filter.prioridad) {
      conditions.push(`p.nombre = $${idx++}`);
      values.push(filter.prioridad);
    }
    if (filter.asignadoId) {
      conditions.push(`t.asignado_id = $${idx++}`);
      values.push(filter.asignadoId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRow] = await Promise.all([
      this.db.query(
        `SELECT ${TICKET_SELECT} FROM tickets t ${TICKET_JOINS}
         ${where}
         ORDER BY p.orden DESC, t.creado_en DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM tickets t ${TICKET_JOINS} ${where}`,
        values,
      ),
    ]);

    const total = Number(countRow.rows[0].count);
    return {
      items: rows.rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // OBTENER POR ID
  // ═══════════════════════════════════════════════════════════════════
  async obtenerPorId(id: string) {
    const result = await this.db.query(
      `SELECT ${TICKET_SELECT} FROM tickets t ${TICKET_JOINS} WHERE t.id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('Ticket no encontrado'), { statusCode: 404 });
    }
    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREAR
  // ═══════════════════════════════════════════════════════════════════
  async crear(dto: CreateTicketDTO, autorId: string) {
    const grupo = await this.db.query('SELECT id FROM grupos WHERE id = $1', [dto.grupoId]);
    if (!grupo.rows[0]) {
      throw Object.assign(new Error('Grupo no encontrado'), { statusCode: 404 });
    }

    const estadoId    = await this.resolverEstadoId(dto.estado);
    const prioridadId = await this.resolverPrioridadId(dto.prioridad);

    const result = await this.db.query(
      `INSERT INTO tickets
         (grupo_id, titulo, descripcion, autor_id, asignado_id, estado_id, prioridad_id, fecha_final)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        dto.grupoId,
        dto.titulo,
        dto.descripcion ?? null,
        autorId,
        dto.asignadoId ?? null,
        estadoId,
        prioridadId,
        dto.fechaFinal ?? null,
      ],
    );

    await this.agregarHistorial(
      result.rows[0].id, autorId, 'created', undefined, undefined, 'Ticket creado',
    );

    return this.obtenerPorId(result.rows[0].id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTUALIZAR
  // ═══════════════════════════════════════════════════════════════════
  async actualizar(id: string, dto: UpdateTicketDTO, userId: string) {
    const ticket = await this.obtenerPorId(id);

    const fields: string[]  = [];
    const values: unknown[] = [];
    let   idx = 1;

    if (dto.titulo !== undefined) {
      fields.push(`titulo = $${idx++}`);
      values.push(dto.titulo);
      await this.agregarHistorial(id, userId, 'title_changed', ticket.titulo, dto.titulo);
    }
    if (dto.descripcion !== undefined) {
      fields.push(`descripcion = $${idx++}`);
      values.push(dto.descripcion);
      await this.agregarHistorial(id, userId, 'description_changed', undefined, undefined, 'Descripción actualizada');
    }
    if (dto.asignadoId !== undefined) {
      fields.push(`asignado_id = $${idx++}`);
      values.push(dto.asignadoId);
      await this.agregarHistorial(id, userId, 'assigned', ticket.asignadoId ?? '—', dto.asignadoId ?? '—');
    }
    if (dto.prioridad !== undefined) {
      const prioridadId = await this.resolverPrioridadId(dto.prioridad);
      fields.push(`prioridad_id = $${idx++}`);
      values.push(prioridadId);
      await this.agregarHistorial(id, userId, 'priority_changed', ticket.prioridad, dto.prioridad);
    }
    if (dto.fechaFinal !== undefined) {
      fields.push(`fecha_final = $${idx++}`);
      values.push(dto.fechaFinal);
      await this.agregarHistorial(id, userId, 'duedate_changed', ticket.fechaFinal ?? '—', dto.fechaFinal ?? '—');
    }

    if (fields.length === 0) {
      throw Object.assign(new Error('Sin campos para actualizar'), { statusCode: 400 });
    }

    values.push(id);
    await this.db.query(
      `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return this.obtenerPorId(id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CAMBIAR ESTADO (requiere ticket_state)
  // Regla: solo si el ticket está asignado al usuario
  // ═══════════════════════════════════════════════════════════════════
  async cambiarEstado(id: string, estadoNombre: string, userId: string) {
    const ticket = await this.obtenerPorId(id);

    if (ticket.asignadoId !== userId) {
      throw Object.assign(
        new Error('Solo puedes cambiar el estado de tickets asignados a ti'),
        { statusCode: 403 },
      );
    }

    const estadoId = await this.resolverEstadoId(estadoNombre);

    await this.db.query(
      'UPDATE tickets SET estado_id = $1 WHERE id = $2',
      [estadoId, id],
    );

    await this.agregarHistorial(id, userId, 'status_changed', ticket.estado, estadoNombre);

    return this.obtenerPorId(id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ELIMINAR
  // ═══════════════════════════════════════════════════════════════════
  async eliminar(id: string, _userId: string) {
    const result = await this.db.query(
      'DELETE FROM tickets WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('Ticket no encontrado'), { statusCode: 404 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS + KANBAN
  // ═══════════════════════════════════════════════════════════════════
  async stats(grupoId: string, userId: string, permisos: string[]) {
    const canViewAll = permisos.includes('tickets_view');
    const queryParams = canViewAll ? [grupoId] : [grupoId, userId];
    const userFilter  = canViewAll ? '' : 'AND t.asignado_id = $2';

    const [totalRow, porEstado, porPrioridad, kanbanTickets, estados] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) FROM tickets t WHERE t.grupo_id = $1 ${userFilter}`,
        queryParams,
      ),
      this.db.query(
        `SELECT e.nombre AS estado, e.color, COUNT(t.id)::int AS total
         FROM estados e
         LEFT JOIN tickets t ON t.estado_id = e.id AND t.grupo_id = $1 ${userFilter}
         GROUP BY e.id, e.nombre, e.color
         ORDER BY e.nombre`,
        queryParams,
      ),
      this.db.query(
        `SELECT p.nombre AS prioridad, p.orden, COUNT(t.id)::int AS total
         FROM prioridades p
         LEFT JOIN tickets t ON t.prioridad_id = p.id AND t.grupo_id = $1 ${userFilter}
         GROUP BY p.id, p.nombre, p.orden
         ORDER BY p.orden`,
        queryParams,
      ),
      this.db.query(
        `SELECT ${TICKET_SELECT} FROM tickets t ${TICKET_JOINS}
         WHERE t.grupo_id = $1 ${userFilter}
         ORDER BY p.orden DESC, t.creado_en DESC`,
        queryParams,
      ),
      this.db.query('SELECT id, nombre, color FROM estados ORDER BY nombre'),
    ]);

    const kanban = estados.rows.map((e: any) => ({
      estadoId:     e.id,
      estadoNombre: e.nombre,
      estadoColor:  e.color,
      tickets:      kanbanTickets.rows.filter((t: any) => t.estado === e.nombre),
    }));

    return {
      total:        Number(totalRow.rows[0].count),
      porEstado:    porEstado.rows,
      porPrioridad: porPrioridad.rows,
      kanban,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMENTARIOS
  // ═══════════════════════════════════════════════════════════════════
  async listarComentarios(ticketId: string) {
    await this.obtenerPorId(ticketId);
    const result = await this.db.query(
      `SELECT c.id, c.ticket_id AS "ticketId", c.autor_id AS "autorId",
              u.nombre_completo AS "autorNombre", c.contenido,
              c.creado_en AS "creadoEn"
       FROM comentarios c
       LEFT JOIN usuarios u ON u.id = c.autor_id
       WHERE c.ticket_id = $1
       ORDER BY c.creado_en ASC`,
      [ticketId],
    );
    return result.rows;
  }

  async agregarComentario(ticketId: string, autorId: string, contenido: string) {
    await this.obtenerPorId(ticketId);
    const result = await this.db.query(
      `INSERT INTO comentarios (ticket_id, autor_id, contenido)
       VALUES ($1, $2, $3)
       RETURNING id, contenido, creado_en AS "creadoEn"`,
      [ticketId, autorId, contenido],
    );
    await this.agregarHistorial(ticketId, autorId, 'comment_added', undefined, undefined, contenido.slice(0, 60));
    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════
  // HISTORIAL
  // ═══════════════════════════════════════════════════════════════════
  async listarHistorial(ticketId: string) {
    await this.obtenerPorId(ticketId);
    const result = await this.db.query(
      `SELECT h.id, h.ticket_id AS "ticketId", h.usuario_id AS "usuarioId",
              u.nombre_completo AS "usuarioNombre",
              h.accion, h.valor_anterior AS "valorAnterior",
              h.valor_nuevo AS "valorNuevo", h.nota,
              h.creado_en AS "creadoEn"
       FROM historial_tickets h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.ticket_id = $1
       ORDER BY h.creado_en DESC`,
      [ticketId],
    );
    return result.rows;
  }

  // ─── Helpers privados ─────────────────────────────────────────────
  private async agregarHistorial(
    ticketId: string, userId: string, accion: string,
    valorAnterior?: string, valorNuevo?: string, nota?: string,
  ) {
    await this.db.query(
      `INSERT INTO historial_tickets
         (ticket_id, usuario_id, accion, valor_anterior, valor_nuevo, nota)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ticketId, userId, accion, valorAnterior ?? null, valorNuevo ?? null, nota ?? null],
    );
  }
}
