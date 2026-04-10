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
export declare function ok<T>(statusCode: number, prefix: ServicePrefix, data: T): ApiResponse<T>;
/**
 * Construye una respuesta de error
 */
export declare function fail(statusCode: number, prefix: ServicePrefix, message: string, error?: string): ApiError;
//# sourceMappingURL=response.d.ts.map