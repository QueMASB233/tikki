# Portal de Administración - Guía de Configuración

## Requisitos Previos

1. **Base de datos**: Ejecutar las migraciones SQL en Supabase:
   - `supabase/migration_add_admin_tables.sql` - Crea tablas para documentos y chunks
   - `supabase/migration_add_rag_rpc.sql` - Crea función RPC para búsqueda vectorial

2. **Supabase Storage**: Crear un bucket llamado `documents`:
   ```sql
   -- En Supabase Dashboard > Storage, crear bucket:
   -- Nombre: documents
   -- Público: No (privado)
   -- Políticas: Configurar según necesidad
   ```

3. **Dependencias del backend**: Instalar dependencias adicionales:
   ```bash
   cd backend
   pip install pdfplumber python-docx
   ```

## Configuración

### 1. Base de Datos

Ejecutar las migraciones en el orden correcto:

```bash
# En Supabase SQL Editor, ejecutar:
# 1. migration_add_admin_tables.sql
# 2. migration_add_rag_rpc.sql
```

### 2. Storage Bucket

1. Ir a Supabase Dashboard > Storage
2. Crear nuevo bucket:
   - Nombre: `documents`
   - Público: No
3. Configurar políticas RLS si es necesario

### 3. Autenticación

Los administradores deben registrarse con correos que terminen en `@estudiaseguro.com`.

El flujo de autenticación:
1. Usuario se registra en `/admin/login` con email `@estudiaseguro.com`
2. Supabase Auth crea la cuenta (requiere verificación de email)
3. Backend crea el perfil en `public.users` con status `active`

## Uso del Portal

### Acceso

1. Navegar a `/admin`
2. Click en "¿Eres administrador académico? Inicia sesión o regístrate"
3. Login/Registro con email `@estudiaseguro.com`

### Funcionalidades

#### 1. Gestión de Documentos

- **Subir**: PDF, DOCX, TXT (máx. 50MB)
- **Estados**: 
  - `processing`: En proceso
  - `active`: Activo (chunks disponibles para RAG)
  - `inactive`: Inactivo (chunks no se usan en RAG)
  - `deleted`: Eliminado (chunks y archivo borrados)
  - `error`: Error en procesamiento

- **Acciones**:
  - Activar: Marca como activo y procesa si es necesario
  - Desactivar: Marca como inactivo (chunks no se usan)
  - Reprocesar: Elimina chunks existentes y reprocesa
  - Eliminar: Elimina chunks y archivo del storage

#### 2. Métricas

Dashboard con gráficos de:
- Usuarios por carrera de interés
- Usuarios por tipo de estudio
- Usuarios por nacionalidad

#### 3. Procesamiento RAG

Cuando un documento se sube o se activa:
1. Se encola un job de procesamiento
2. Se extrae texto (PDF/DOCX/TXT)
3. Se normaliza el texto
4. Se divide en chunks (~1000 tokens, 200 overlap)
5. Se generan embeddings (384 dimensiones)
6. Se almacenan chunks en `document_chunks`

## Pipeline RAG

### Ingestion

1. **Upload/Activate**: Documento se marca como `processing` → `queued`
2. **Background Job**: 
   - Descarga archivo de Storage
   - Extrae texto según tipo
   - Normaliza y limpia
   - Chunking (1000 tokens, 200 overlap)
   - Genera embeddings
   - Inserta en `document_chunks`
3. **Completion**: Estado → `completed`, `processed_at` actualizado

### Retrieval

En `sendMessage()`:
1. Query del usuario → embedding
2. Búsqueda vectorial en `document_chunks` (solo documentos `active`)
3. Top-K = 8 chunks más relevantes
4. Formatea chunks como `CLIENT_DOCUMENTS`
5. Incluye en prompt del sistema
6. LLM responde usando contexto de documentos

## Estructura de Archivos

```
backend/
  app/
    routes/
      admin.py          # Rutas del portal admin
    lib/
      rag/
        document_processor.py  # Extracción, chunking, embeddings
        retrieval.py           # Búsqueda vectorial
        job_processor.py       # Procesamiento en background

frontend/
  src/
    app/
      admin/
        page.tsx              # Landing page
        login/
          page.tsx            # Login/Registro
        dashboard/
          page.tsx            # Dashboard principal
    lib/
      admin-api-client.ts     # Cliente API admin
      admin-context.tsx       # Context de autenticación admin
```

## Notas Importantes

1. **Dominio de email**: Solo `@estudiaseguro.com` puede registrarse como admin
2. **Storage bucket**: Debe llamarse exactamente `documents`
3. **Procesamiento**: Se hace en background threads (no async/await)
4. **Embeddings**: Usa modelo `all-MiniLM-L6-v2` (384 dimensiones)
5. **Chunking**: Aproximación de tokens (1 token ≈ 4 caracteres)
6. **Límites**: 
   - Archivo máximo: 50MB
   - Chunks por documento: Sin límite (pero se recomienda <200 páginas)
   - Top-K retrieval: 8 chunks

## Troubleshooting

### Documentos no se procesan

1. Verificar que el bucket `documents` existe
2. Verificar logs en `processing_logs`
3. Verificar que las dependencias están instaladas (pdfplumber, python-docx)

### Búsqueda RAG no funciona

1. Verificar que hay documentos con status `active`
2. Verificar que los chunks tienen embeddings (no todos ceros)
3. Verificar que la función RPC `match_document_chunks` existe

### Errores de autenticación

1. Verificar que el email termina en `@estudiaseguro.com`
2. Verificar que el usuario está en `auth.users` y `public.users`
3. Verificar token en localStorage



