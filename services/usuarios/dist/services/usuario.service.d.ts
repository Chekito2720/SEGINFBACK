import { Pool } from 'pg';
export interface RegistroDTO {
    fullName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    birthDate: string;
    phone: string;
    address: string;
}
export interface UpdatePerfilDTO {
    nombre_completo?: string;
    username?: string;
    telefono?: string;
    direccion?: string;
    password_actual?: string;
    password_nuevo?: string;
}
export declare class UsuarioService {
    private db;
    private bcryptRounds;
    constructor(db: Pool, bcryptRounds?: number);
    registrar(dto: RegistroDTO): Promise<any>;
    login(email: string, password: string): Promise<any>;
    obtenerPorId(id: string): Promise<any>;
    listar(page?: number, limit?: number): Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    actualizar(id: string, solicitanteId: string, dto: UpdatePerfilDTO): Promise<any>;
    actualizarPermisos(usuarioId: string, permisos: string[]): Promise<string[]>;
    eliminar(id: string, solicitanteId: string): Promise<void>;
    /**
     * Valida que el usuario tenga al menos 18 años.
     * fecha: YYYY-MM-DD
     */
    private validarEdadMinima;
}
//# sourceMappingURL=usuario.service.d.ts.map