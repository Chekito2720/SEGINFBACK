// ═══════════════════════════════════════════════════════════════════
// Mapa de permisos por endpoint
// El Gateway verifica este mapa ANTES de hacer proxy al microservicio.
// ═══════════════════════════════════════════════════════════════════

export interface RoutePermission {
  permiso: string;
  contextCheck?: (jwtPayload: any, params: Record<string, string>) => boolean;
}

export const PERMISSION_MAP: Record<string, RoutePermission> = {

  // ── Usuarios ──────────────────────────────────────────────────────
  'GET /usuarios':                    { permiso: 'users_view'    },
  'GET /usuarios/:id':                { permiso: 'user_view'     },
  'PATCH /usuarios/:id':              { permiso: 'user_edit'     },
  'PUT /usuarios/:id/permisos':       { permiso: 'user_add'      },
  'DELETE /usuarios/:id':             { permiso: 'user_delete'   },

  // ── Grupos ────────────────────────────────────────────────────────
  // groups_manage cubre todas las operaciones de gestión (nuevo permiso unificado)
  'GET /grupos':                                   { permiso: 'groups_view'   },
  'GET /grupos/:id':                               { permiso: 'group_view'    },
  // GET /grupos/mis-grupos → está en AUTH_ONLY_ROUTES (solo JWT, sin permiso específico)
  'POST /grupos':                                  { permiso: 'groups_add'    },
  'PATCH /grupos/:id':                             { permiso: 'group_edit'    },
  'DELETE /grupos/:id':                            { permiso: 'group_delete'  },
  'GET /grupos/:id/miembros':                      { permiso: 'group_view'    },
  'POST /grupos/:id/miembros':                     { permiso: 'group_add'     },
  'DELETE /grupos/:id/miembros/:uid':              { permiso: 'group_delete'  },
  'GET /grupos/:id/miembros/:uid/permisos':        { permiso: 'group_view'    },
  'PUT /grupos/:id/miembros/:uid/permisos':        { permiso: 'groups_manage' },

  // ── Tickets — CRUD ────────────────────────────────────────────────
  'GET /tickets':                     { permiso: 'tickets_view'  },
  'GET /tickets/:id':                 { permiso: 'ticket_view'   },
  'POST /tickets':                    { permiso: 'ticket_add'    },
  'PATCH /tickets/:id':               { permiso: 'ticket_edit'   },
  'DELETE /tickets/:id':              { permiso: 'ticket_delete' },

  // ── Tickets — Cambio de estado (nuevo permiso ticket_state) ───────
  // Solo puede cambiar estado si tiene ticket_state.
  // La verificación "ticket asignado al usuario" la hace el microservicio
  // (necesita consultar la BD para saberlo).
  'PATCH /tickets/:id/state':         { permiso: 'ticket_state'  },

  // ── Tickets — Comentarios e historial ─────────────────────────────
  'GET /tickets/:id/comentarios':     { permiso: 'ticket_view'   },
  'POST /tickets/:id/comentarios':    { permiso: 'ticket_view'   },
  'GET /tickets/:id/historial':       { permiso: 'ticket_view'   },

  // ── Tickets — Estadísticas del dashboard ──────────────────────────
  'GET /tickets/stats':               { permiso: 'tickets_view'  },
  'GET /tickets/stats/:grupoId':      { permiso: 'ticket_view'   },
};

/** Rutas públicas — sin JWT ni permiso */
export const PUBLIC_ROUTES: string[] = [
  '/auth/login',
  '/auth/register',
  '/health',
];

/** Rutas que solo necesitan JWT válido, sin permiso específico */
export const AUTH_ONLY_ROUTES: string[] = [
  '/usuarios/me',
  '/auth/me',
  '/grupos/mis-grupos',
];