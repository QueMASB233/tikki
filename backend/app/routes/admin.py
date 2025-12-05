"""Rutas para el portal de administración académica."""

from typing import List, Optional
from datetime import datetime
import hashlib

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from loguru import logger
from supabase import Client

from ..dependencies import get_supabase, get_current_user
from ..lib.rag.job_processor import enqueue_document_processing
from ..schemas import (
    AdminSignupRequest,
    AdminLoginRequest,
    AdminAuthResponse,
    AdminUserResponse,
    DocumentUploadResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    MetricsResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_DOMAIN = "@estudiaseguro.com"


def is_admin_email(email: str) -> bool:
    """Verifica si el email pertenece al dominio de administradores."""
    return email.endswith(ADMIN_DOMAIN)


def get_current_admin(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Dependency para verificar que el usuario actual es un administrador."""
    email = current_user.get("email", "")
    if not is_admin_email(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo administradores académicos pueden acceder.",
        )
    return current_user


@router.post("/signup", response_model=AdminAuthResponse)
def admin_signup(
    payload: AdminSignupRequest,
    supabase: Client = Depends(get_supabase),
):
    """Registro de administrador académico. Solo emails @estudiaseguro.com."""
    if not is_admin_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se permiten correos con dominio {ADMIN_DOMAIN}",
        )

    logger.info("Creating admin profile for auth_user_id: {}", payload.auth_user_id)

    try:
        # Verificar que el auth_user_id existe en Supabase Auth
        try:
            auth_user = supabase.auth.admin.get_user_by_id(payload.auth_user_id)
            if not auth_user or not auth_user.user:
                logger.error("Auth user not found: {}", payload.auth_user_id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Usuario de autenticación no encontrado.",
                )
        except Exception as e:
            logger.error("Error verifying auth user: {}", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo verificar el usuario de autenticación.",
            )

        # Verificar si ya existe un perfil para este auth_user_id
        existing = (
            supabase.table("users")
            .select("*")
            .eq("auth_user_id", payload.auth_user_id)
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            logger.warning(
                "Admin profile already exists for auth_user_id: {}", payload.auth_user_id
            )
            user = existing.data[0]
            return AdminAuthResponse(
                token="",  # El frontend ya tiene el token
                user=AdminUserResponse(
                    id=user["id"],
                    email=user["email"],
                    status=user["status"],
                    full_name=user.get("full_name"),
                ),
            )

        # Crear perfil en public.users
        insert_response = (
            supabase.table("users")
            .insert(
                {
                    "auth_user_id": payload.auth_user_id,
                    "email": payload.email,
                    "full_name": payload.full_name,
                    "status": "active",  # Los admins están activos por defecto
                }
            )
            .execute()
        )

        if (
            not hasattr(insert_response, "data")
            or not insert_response.data
            or len(insert_response.data) == 0
        ):
            logger.error("Error creating admin in public.users: No data returned")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear el perfil del administrador.",
            )

        user = insert_response.data[0]
        logger.info("Admin profile created successfully: {}", user["id"])

        return AdminAuthResponse(
            token="",  # El frontend ya tiene el token de Supabase Auth
            user=AdminUserResponse(
                id=user["id"],
                email=user["email"],
                status=user["status"],
                full_name=user.get("full_name"),
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in admin signup: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el perfil del administrador.",
        )


@router.get("/me", response_model=AdminUserResponse)
def get_admin_profile(
    current_admin=Depends(get_current_admin),
):
    """Obtiene el perfil del administrador actual."""
    return AdminUserResponse(
        id=current_admin["id"],
        email=current_admin["email"],
        status=current_admin["status"],
        full_name=current_admin.get("full_name"),
    )


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
):
    """Sube un documento académico."""
    # Validar tipo de archivo
    allowed_extensions = {".pdf", ".docx", ".txt"}
    filename = file.filename or "document"
    file_ext = None
    for ext in allowed_extensions:
        if filename.lower().endswith(ext):
            file_ext = ext
            break

    if not file_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos PDF, DOCX o TXT",
        )

    # Leer contenido del archivo
    content = await file.read()
    file_size = len(content)

    # Validar tamaño (máximo 50MB)
    max_size = 50 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo es demasiado grande. Máximo 50MB.",
        )

    try:
        # Calcular hash del contenido
        content_hash = hashlib.sha256(content).hexdigest()

        # Subir a Supabase Storage
        storage_path = f"admin-documents/{current_admin['id']}/{filename}"
        storage_response = supabase.storage.from_("documents").upload(
            storage_path, content, file_options={"content-type": file.content_type}
        )

        if hasattr(storage_response, "error") and storage_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al subir el archivo: {storage_response.error}",
            )

        # Crear registro en knowledge_documents
        doc_response = (
            supabase.table("knowledge_documents")
            .insert(
                {
                    "admin_user_id": current_admin["id"],
                    "filename": filename,
                    "file_path": storage_path,
                    "file_size": file_size,
                    "mime_type": file.content_type,
                    "status": "processing",
                    "content_hash": content_hash,
                    "processing_status": "queued",
                }
            )
            .execute()
        )

        if not doc_response.data or len(doc_response.data) == 0:
            # Intentar eliminar el archivo del storage si falla la inserción
            try:
                supabase.storage.from_("documents").remove([storage_path])
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el registro del documento.",
            )

        doc = doc_response.data[0]

        # Encolar procesamiento en background
        enqueue_document_processing(doc["id"])

        return DocumentUploadResponse(
            id=doc["id"],
            filename=filename,
            status="processing",
            message="Documento subido correctamente. Se procesará en breve.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error uploading document: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al subir el documento.",
        )


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
):
    """Lista todos los documentos del administrador."""
    response = (
        supabase.table("knowledge_documents")
        .select("*")
        .eq("admin_user_id", current_admin["id"])
        .order("created_at", desc=True)
        .execute()
    )

    documents = response.data if hasattr(response, "data") and response.data else []

    return [
        DocumentResponse(
            id=doc["id"],
            filename=doc["filename"],
            file_path=doc["file_path"],
            file_size=doc.get("file_size"),
            mime_type=doc.get("mime_type"),
            status=doc["status"],
            processing_status=doc.get("processing_status"),
            processing_error=doc.get("processing_error"),
            processed_at=datetime.fromisoformat(doc["processed_at"].replace("Z", "+00:00"))
            if doc.get("processed_at")
            else None,
            created_at=datetime.fromisoformat(doc["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(doc["updated_at"].replace("Z", "+00:00")),
        )
        for doc in documents
    ]


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    payload: DocumentUpdateRequest,
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
):
    """Actualiza el estado de un documento (activar, desactivar, eliminar)."""
    # Verificar que el documento pertenece al admin
    doc_response = (
        supabase.table("knowledge_documents")
        .select("*")
        .eq("id", document_id)
        .eq("admin_user_id", current_admin["id"])
        .execute()
    )

    if not doc_response.data or len(doc_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado o no autorizado.",
        )

    doc = doc_response.data[0]
    update_data = {"updated_at": datetime.utcnow().isoformat()}

    if payload.status:
        update_data["status"] = payload.status

        # Si se marca como deleted, eliminar chunks y archivo
        if payload.status == "deleted":
            # Eliminar chunks (no crítico si falla)
            try:
                supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
            except Exception as e:
                logger.warning("Error deleting chunks: {}", e)
                # Continuar aunque falle

            # Eliminar archivo del storage (no crítico si falla)
            try:
                supabase.storage.from_("documents").remove([doc["file_path"]])
            except Exception as e:
                logger.warning("Error deleting file from storage: {}", e)
                # Continuar aunque falle - el documento se marca como deleted de todas formas

        # Si se activa, encolar procesamiento si no está procesado
        if payload.status == "active" and doc.get("processing_status") != "completed":
            update_data["processing_status"] = "queued"
            # Encolar procesamiento
            enqueue_document_processing(document_id)

    # Actualizar documento
    try:
        update_response = (
            supabase.table("knowledge_documents")
            .update(update_data)
            .eq("id", document_id)
            .execute()
        )

        if not update_response.data or len(update_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar el documento.",
            )
    except Exception as e:
        logger.error("Error updating document in database: {}", e)
        # Si es un error de conexión, dar un mensaje más claro
        if "ConnectError" in str(type(e)) or "nodename" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Error de conexión con la base de datos. Verifica la configuración de Supabase.",
            )
        raise

    updated_doc = update_response.data[0]

    return DocumentResponse(
        id=updated_doc["id"],
        filename=updated_doc["filename"],
        file_path=updated_doc["file_path"],
        file_size=updated_doc.get("file_size"),
        mime_type=updated_doc.get("mime_type"),
        status=updated_doc["status"],
        processing_status=updated_doc.get("processing_status"),
        processing_error=updated_doc.get("processing_error"),
        processed_at=datetime.fromisoformat(updated_doc["processed_at"].replace("Z", "+00:00"))
        if updated_doc.get("processed_at")
        else None,
        created_at=datetime.fromisoformat(updated_doc["created_at"].replace("Z", "+00:00")),
        updated_at=datetime.fromisoformat(updated_doc["updated_at"].replace("Z", "+00:00")),
    )


@router.post("/documents/{document_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(
    document_id: str,
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
):
    """Reprocesa un documento."""
    # Verificar que el documento pertenece al admin
    doc_response = (
        supabase.table("knowledge_documents")
        .select("*")
        .eq("id", document_id)
        .eq("admin_user_id", current_admin["id"])
        .execute()
    )

    if not doc_response.data or len(doc_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado o no autorizado.",
        )

    doc = doc_response.data[0]

    # Eliminar chunks existentes
    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()

    # Actualizar estado a queued
    update_response = (
        supabase.table("knowledge_documents")
        .update(
            {
                "processing_status": "queued",
                "processing_error": None,
                "processed_at": None,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", document_id)
        .execute()
    )

    if not update_response.data or len(update_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el documento.",
        )

    updated_doc = update_response.data[0]

    # Encolar reprocesamiento
    enqueue_document_processing(document_id)

    return DocumentResponse(
        id=updated_doc["id"],
        filename=updated_doc["filename"],
        file_path=updated_doc["file_path"],
        file_size=updated_doc.get("file_size"),
        mime_type=updated_doc.get("mime_type"),
        status=updated_doc["status"],
        processing_status=updated_doc.get("processing_status"),
        processing_error=updated_doc.get("processing_error"),
        processed_at=datetime.fromisoformat(updated_doc["processed_at"].replace("Z", "+00:00"))
        if updated_doc.get("processed_at")
        else None,
        created_at=datetime.fromisoformat(updated_doc["created_at"].replace("Z", "+00:00")),
        updated_at=datetime.fromisoformat(updated_doc["updated_at"].replace("Z", "+00:00")),
    )


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics(
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
):
    """Obtiene métricas de usuarios por carrera, tipo de estudio y nacionalidad."""
    # Obtener todos los usuarios activos
    users_response = (
        supabase.table("users")
        .select("career_interest, study_type, nationality")
        .eq("status", "active")
        .execute()
    )

    users = users_response.data if hasattr(users_response, "data") and users_response.data else []

    # Contar por carrera
    career_counts = {}
    for user in users:
        career = user.get("career_interest") or "Sin especificar"
        career_counts[career] = career_counts.get(career, 0) + 1

    # Contar por tipo de estudio
    study_type_counts = {}
    for user in users:
        study_type = user.get("study_type") or "Sin especificar"
        study_type_counts[study_type] = study_type_counts.get(study_type, 0) + 1

    # Contar por nacionalidad
    nationality_counts = {}
    for user in users:
        nationality = user.get("nationality") or "Sin especificar"
        nationality_counts[nationality] = nationality_counts.get(nationality, 0) + 1

    return MetricsResponse(
        career_interest=career_counts,
        study_type=study_type_counts,
        nationality=nationality_counts,
    )


@router.get("/logs")
def get_logs(
    document_id: Optional[str] = None,
    current_admin=Depends(get_current_admin),
    supabase: Client = Depends(get_supabase),
):
    """Obtiene logs de procesamiento."""
    query = supabase.table("processing_logs").select("*")

    if document_id:
        # Verificar que el documento pertenece al admin
        doc_response = (
            supabase.table("knowledge_documents")
            .select("id")
            .eq("id", document_id)
            .eq("admin_user_id", current_admin["id"])
            .execute()
        )
        if not doc_response.data or len(doc_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento no encontrado o no autorizado.",
            )
        query = query.eq("document_id", document_id)

    response = query.order("created_at", desc=True).limit(100).execute()
    logs = response.data if hasattr(response, "data") and response.data else []

    return logs

