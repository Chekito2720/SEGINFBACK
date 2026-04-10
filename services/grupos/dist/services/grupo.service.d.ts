import { Pool } from 'pg';
export interface CreateGrupoDTO {
    nombre: string;
    descripcion?: string | null;
    nivel?: string | null;
    model?: string | null;
    color?: string | null;
}
export interface UpdateGrupoDTO {
    nombre?: string;
    descripcion?: string | null;
    nivel?: string | null;
    model?: string | null;
    color?: string | null;
}
export declare class GrupoService {
    private db;
    constructor(db: Pool);
    listar(page?: number, limit?: number): Promise<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    misGrupos(userId: string): Promise<any[]>;
    obtenerPorId(id: string): Promise<any>;
    crear(dto: CreateGrupoDTO, creatorId: string): Promise<any>;
    actualizar(id: string, dto: UpdateGrupoDTO): Promise<any>;
    eliminar(id: string): Promise<void>;
    listarMiembros(grupoId: string): Promise<any[]>;
    agregarMiembro(grupoId: string, usuarioId: string): Promise<void>;
    removerMiembro(grupoId: string, usuarioId: string): Promise<void>;
    getPermisosContextuales(grupoId: string, usuarioId: string): Promise<{
        grupoId: string;
        usuarioId: string;
        fullName: any;
        permisosGrupo: any;
    }>;
    updatePermisosContextuales(grupoId: string, usuarioId: string, permisos: string[]): Promise<{
        grupoId: string;
        usuarioId: string;
        permisosGrupo: string[];
        message: string;
    }>;
    getPermisosDefault(grupoId: string): Promise<string[]>;
    updatePermisosDefault(grupoId: string, permisos: string[]): Promise<string[]>;
    verificarAcceso(grupoId: string, userId: string, permisos: string[]): Promise<boolean>;
}
//# sourceMappingURL=grupo.service.d.ts.map