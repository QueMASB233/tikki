"""Procesador de trabajos en background para documentos."""

import asyncio
import threading
from typing import Optional
from loguru import logger
from supabase import Client
from datetime import datetime

from .document_processor import process_document
from ..supabase import get_supabase_client


def process_document_job(document_id: str):
    """Procesa un documento en background."""
    supabase = get_supabase_client()

    try:
        # Obtener información del documento
        doc_response = (
            supabase.table("knowledge_documents")
            .select("*")
            .eq("id", document_id)
            .single()
            .execute()
        )

        if not doc_response.data:
            logger.error("Documento no encontrado: {}", document_id)
            return

        doc = doc_response.data

        # Verificar que está en cola
        if doc.get("processing_status") != "queued":
            logger.warning(
                "Documento {} no está en cola (status: {})",
                document_id,
                doc.get("processing_status"),
            )
            return

        # Actualizar estado a processing
        supabase.table("knowledge_documents").update(
            {"processing_status": "processing", "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", document_id).execute()

        # Log
        supabase.table("processing_logs").insert(
            {
                "document_id": document_id,
                "log_type": "info",
                "message": "Iniciando procesamiento del documento",
            }
        ).execute()

        # Descargar archivo de Storage
        file_path = doc["file_path"]
        try:
            file_response = supabase.storage.from_("documents").download(file_path)
            
            # El método download puede retornar bytes directamente o un objeto con error
            if isinstance(file_response, bytes):
                file_content = file_response
            elif hasattr(file_response, "error") and file_response.error:
                error_msg = f"Error descargando archivo: {file_response.error}"
                logger.error(error_msg)
                supabase.table("knowledge_documents").update(
                    {
                        "processing_status": "error",
                        "processing_error": error_msg,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", document_id).execute()
                supabase.table("processing_logs").insert(
                    {
                        "document_id": document_id,
                        "log_type": "error",
                        "message": error_msg,
                    }
                ).execute()
                return
            elif hasattr(file_response, "content"):
                file_content = file_response.content
            else:
                # Intentar como bytes
                file_content = file_response
        except Exception as e:
            error_msg = f"Error descargando archivo: {str(e)}"
            logger.error(error_msg)
            supabase.table("knowledge_documents").update(
                {
                    "processing_status": "error",
                    "processing_error": error_msg,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", document_id).execute()
            supabase.table("processing_logs").insert(
                {
                    "document_id": document_id,
                    "log_type": "error",
                    "message": error_msg,
                }
            ).execute()
            return

        # Procesar documento
        num_chunks, error = process_document(
            file_content,
            doc.get("mime_type", ""),
            doc["filename"],
            document_id,
            supabase,
        )

        if error:
            # Actualizar estado a error
            supabase.table("knowledge_documents").update(
                {
                    "processing_status": "error",
                    "processing_error": error,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", document_id).execute()
            supabase.table("processing_logs").insert(
                {
                    "document_id": document_id,
                    "log_type": "error",
                    "message": error,
                }
            ).execute()
        else:
            # Actualizar estado a completed
            # Si el status es "processing", cambiarlo a "active" automáticamente
            update_data = {
                "processing_status": "completed",
                "processed_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            # Si el status actual es "processing", cambiarlo a "active"
            if doc.get("status") == "processing":
                update_data["status"] = "active"
            
            supabase.table("knowledge_documents").update(update_data).eq("id", document_id).execute()
            supabase.table("processing_logs").insert(
                {
                    "document_id": document_id,
                    "log_type": "success",
                    "message": f"Documento procesado exitosamente. {num_chunks} chunks creados.",
                }
            ).execute()
            logger.info("Documento {} procesado exitosamente. {} chunks creados", document_id, num_chunks)

    except Exception as e:
        error_msg = f"Error procesando documento: {str(e)}"
        logger.exception(error_msg)
        try:
            supabase.table("knowledge_documents").update(
                {
                    "processing_status": "error",
                    "processing_error": error_msg,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", document_id).execute()
            supabase.table("processing_logs").insert(
                {
                    "document_id": document_id,
                    "log_type": "error",
                    "message": error_msg,
                }
            ).execute()
        except:
            pass


def enqueue_document_processing(document_id: str):
    """Encola el procesamiento de un documento en un thread separado."""
    thread = threading.Thread(target=process_document_job, args=(document_id,), daemon=True)
    thread.start()
    logger.info("Documento {} encolado para procesamiento", document_id)

