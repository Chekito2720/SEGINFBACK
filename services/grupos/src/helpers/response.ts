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

export type ServicePrefix = 'SxUS' | 'SxTK' | 'SxGR' | 'SxGW';

export interface ApiResponse<T = unknown> {
    statusCode: number;
    intOpCode: string;
    data: T | null;
}

export interface ApiError {
    statusCode: number;
    intOpCode: string;
    data: null;
    error: string;
    message: string;
}

/**
 * Construye una respuesta de éxito
 * @param statusCode  HTTP status code (200, 201, etc.)
 * @param prefix      Prefijo del servicio ('SxUS', 'SxTK', etc.)
 * @param data        Payload de la respuesta
 */
export function ok<T>(
    statusCode: number,
    prefix: ServicePrefix,
    data: T,
): ApiResponse<T> {
    return {
        statusCode,
        intOpCode: `${prefix}${statusCode}`,
        data,
    };
}

/**
 * Construye una respuesta de error
 */
export function fail(
    statusCode: number,
    prefix: ServicePrefix,
    message: string,
    error = 'Error',
): ApiError {
    return {
        statusCode,
        intOpCode: `${prefix}${statusCode}`,
        data: null,
        error,
        message,
    };
}
