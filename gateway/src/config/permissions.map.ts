// ═══════════════════════════════════════════════════════════════════
// Mapa de permisos por endpoint
//
// El Gateway consulta este mapa antes de reenviar cada petición.
// Si el JWT del usuario no contiene el permiso requerido → 403.
//
// Rutas públicas (sin permiso): se listan en PUBLIC_ROUTES.
// ═══════════════════════════════════════════════════════════════════

export interface RoutePermission {
  /** Permiso requerido en el JWT del usuario */
  permiso: string;
  /**
   * Validación adicional a nivel de contexto.
   * Se evalúa en el gateway con los datos del JWT.
   * Si devuelve false → 403.
   */
  contextCheck?: (jwtPayload: any, params: Record<string, string>) => boolean;
}

/**
 * Clave del mapa: "METHOD /ruta"
 * Las rutas con parámetros dinámicos usan el patrón :param
 *
 * Ejemplos:
 *   "GET /usuarios"            → permiso users_view
 *   "POST /tickets"            → permiso tickets_add
 *   "PATCH /tickets/:id/status"→ permiso ticket_edit + asignado al usuario
 */
export const PERMISSION_MAP: Record<string, RoutePermission> = {

  // ── Usuarios ────────────────────────────────────────────────────
  'GET /usuarios':              { permiso: 'users_view'    },
  'GET /usuarios/:id':          { permiso: 'user_view'     },
  'PATCH /usuarios/:id':        { permiso: 'user_edit'     },
  'PUT /usuarios/:id/permisos': { permiso: 'user_add'      },
  'DELETE /usuarios/:id':       { permiso: 'user_delete'   },

  // ── Grupos ──────────────────────────────────────────────────────
  'GET /grupos':                { permiso: 'groups_view'   },
  'GET /grupos/:id':            { permiso: 'group_view'    },
  'POST /grupos':               { permiso: 'groups_add'    },
  'PATCH /grupos/:id':          { permiso: 'group_edit'    },
  'DELETE /grupos/:id':         { permiso: 'group_delete'  },
  'POST /grupos/:id/miembros':  { permiso: 'group_add'     },
  'DELETE /grupos/:id/miembros/:uid': { permiso: 'group_delete' },

  // ── Tickets ─────────────────────────────────────────────────────
  'GET /tickets':               { permiso: 'tickets_view'  },
  'GET /tickets/:id':           { permiso: 'ticket_view'   },
  'POST /tickets':              { permiso: 'ticket_add'    },
  'PATCH /tickets/:id':         { permiso: 'ticket_edit'   },
  'DELETE /tickets/:id':        { permiso: 'ticket_delete' },

  // PATCH state: requiere ticket_state Y que el ticket esté asignado al usuario
  // (la verificación de asignación se delega al microservicio de tickets,
  //  que tiene acceso a la BD — el gateway solo verifica el permiso base)
  'PATCH /tickets/:id/state':   { permiso: 'ticket_state'  },

  // Estadísticas + kanban
  'GET /tickets/stats/:id':     { permiso: 'tickets_view'  },

  // Comentarios
  'GET /tickets/:id/comentarios':  { permiso: 'ticket_view' },
  'POST /tickets/:id/comentarios': { permiso: 'ticket_view' },

  // Historial
  'GET /tickets/:id/historial':    { permiso: 'ticket_view' },
};

/**
 * Rutas completamente públicas — el gateway las deja pasar sin JWT ni permiso.
 * Se comparan como prefijo (startsWith).
 */
export const PUBLIC_ROUTES: string[] = [
  '/auth/login',
  '/auth/register',
  '/health',
];

/**
 * Rutas que requieren JWT pero NO un permiso específico del mapa.
 * El usuario solo necesita estar autenticado.
 */
export const AUTH_ONLY_ROUTES: string[] = [
  '/usuarios/me',
  '/auth/me',
];