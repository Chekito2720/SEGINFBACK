// ═══════════════════════════════════════════════════════════════════
// Esquema de respuesta universal
//
// Todos los endpoints devuelven:
// {
//   "statusCode": 200,
//   "intOpCode":  "SxUS200",
//   "data":       [ ... ] | { ... } | null
// }
//
// Prefijos de intOpCode por servicio:
//   SxUS → Usuarios
//   SxTK → Tickets
//   SxGR → Grupos
//   SxGW → Gateway / auth
// ═══════════════════════════════════════════════════════════════════
/**
 * Construye una respuesta de éxito
 * @param statusCode  HTTP status code (200, 201, etc.)
 * @param prefix      Prefijo del servicio ('SxUS', 'SxTK', etc.)
 * @param data        Payload de la respuesta
 */
export function ok(statusCode, prefix, data) {
    return {
        statusCode,
        intOpCode: `${prefix}${statusCode}`,
        data,
    };
}
/**
 * Construye una respuesta de error
 */
export function fail(statusCode, prefix, message, error = 'Error') {
    return {
        statusCode,
        intOpCode: `${prefix}${statusCode}`,
        data: null,
        error,
        message,
    };
}
//# sourceMappingURL=response.js.map