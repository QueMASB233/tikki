"""Procesador de documentos para RAG: extracción de texto, chunking, embeddings."""

import hashlib
import io
import re
from typing import List, Tuple, Optional
from loguru import logger

from ..embeddings import get_embedding_generator


def extract_text_from_pdf(content: bytes) -> str:
    """Extrae texto de un archivo PDF."""
    try:
        import pdfplumber
        text = ""
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except ImportError:
        logger.error("pdfplumber no está instalado. Instala con: pip install pdfplumber")
        raise
    except Exception as e:
        logger.error("Error extrayendo texto de PDF: {}", e)
        raise


def extract_text_from_docx(content: bytes) -> str:
    """Extrae texto de un archivo DOCX."""
    try:
        from docx import Document
        import io
        doc = Document(io.BytesIO(content))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except ImportError:
        logger.error("python-docx no está instalado. Instala con: pip install python-docx")
        raise
    except Exception as e:
        logger.error("Error extrayendo texto de DOCX: {}", e)
        raise


def extract_text_from_txt(content: bytes) -> str:
    """Extrae texto de un archivo TXT."""
    try:
        # Intentar diferentes encodings
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                return content.decode(encoding).strip()
            except UnicodeDecodeError:
                continue
        # Si todos fallan, usar utf-8 con errores ignorados
        return content.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        logger.error("Error extrayendo texto de TXT: {}", e)
        raise


def extract_text(content: bytes, mime_type: str, filename: str) -> str:
    """Extrae texto de un archivo según su tipo."""
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        return extract_text_from_pdf(content)
    elif (
        mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or filename.lower().endswith(".docx")
    ):
        return extract_text_from_docx(content)
    elif mime_type == "text/plain" or filename.lower().endswith(".txt"):
        return extract_text_from_txt(content)
    else:
        raise ValueError(f"Tipo de archivo no soportado: {mime_type}")


def normalize_text(text: str) -> str:
    """Normaliza y limpia el texto."""
    # Eliminar espacios múltiples
    text = re.sub(r"\s+", " ", text)
    # Eliminar saltos de línea múltiples
    text = re.sub(r"\n\s*\n", "\n\n", text)
    # Eliminar caracteres de control excepto saltos de línea y tabs
    text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f]", "", text)
    return text.strip()


def estimate_tokens(text: str) -> int:
    """Estima el número de tokens en un texto (aproximación: 1 token ≈ 4 caracteres)."""
    return len(text) // 4


def chunk_text(
    text: str, chunk_size_tokens: int = 1000, overlap_tokens: int = 200
) -> List[Tuple[str, int]]:
    """Divide el texto en chunks con overlap.
    
    Args:
        text: Texto a dividir.
        chunk_size_tokens: Tamaño objetivo del chunk en tokens.
        overlap_tokens: Overlap entre chunks en tokens.
        
    Returns:
        Lista de tuplas (chunk_text, chunk_index).
    """
    if not text or not text.strip():
        return []

    # Normalizar texto
    normalized = normalize_text(text)

    # Si no podemos tokenizar, usar aproximación por caracteres
    # 1000 tokens ≈ 4000 caracteres, 200 tokens ≈ 800 caracteres
    chunk_size_chars = chunk_size_tokens * 4
    overlap_chars = overlap_tokens * 4

    chunks = []
    start = 0
    chunk_index = 0

    while start < len(normalized):
        # Calcular fin del chunk
        end = start + chunk_size_chars

        # Si no es el último chunk, intentar cortar en un punto de pausa (punto, salto de línea, etc.)
        if end < len(normalized):
            # Buscar el mejor punto de corte cerca del final
            search_start = max(start, end - overlap_chars)
            # Buscar punto, salto de línea, o espacio
            for delimiter in [". ", "\n\n", "\n", ". ", " "]:
                last_delimiter = normalized.rfind(delimiter, search_start, end)
                if last_delimiter > search_start:
                    end = last_delimiter + len(delimiter)
                    break

        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append((chunk, chunk_index))
            chunk_index += 1

        # Mover start con overlap
        if end >= len(normalized):
            break
        start = end - overlap_chars

    return chunks


def process_document(
    content: bytes,
    mime_type: str,
    filename: str,
    document_id: str,
    supabase_client,
) -> Tuple[int, Optional[str]]:
    """Procesa un documento completo: extrae texto, chunking, embeddings, almacenamiento.
    
    Args:
        content: Contenido binario del archivo.
        mime_type: Tipo MIME del archivo.
        filename: Nombre del archivo.
        document_id: ID del documento en knowledge_documents.
        supabase_client: Cliente de Supabase.
        
    Returns:
        Tupla (número_de_chunks, error_message).
    """
    try:
        # 1. Extraer texto
        logger.info("Extrayendo texto de documento: {}", filename)
        text = extract_text(content, mime_type, filename)

        if not text or not text.strip():
            error_msg = "No se pudo extraer texto del documento"
            logger.warning(error_msg)
            return (0, error_msg)

        # 2. Normalizar texto
        normalized_text = normalize_text(text)
        logger.info("Texto extraído y normalizado. Longitud: {} caracteres", len(normalized_text))

        # 3. Chunking
        logger.info("Dividiendo texto en chunks")
        chunks = chunk_text(normalized_text, chunk_size_tokens=1000, overlap_tokens=200)
        logger.info("Texto dividido en {} chunks", len(chunks))

        if not chunks:
            error_msg = "No se generaron chunks del documento"
            logger.warning(error_msg)
            return (0, error_msg)

        # 4. Generar embeddings
        logger.info("Generando embeddings para {} chunks", len(chunks))
        embedding_generator = get_embedding_generator()
        chunk_texts = [chunk[0] for chunk in chunks]

        # Generar embeddings en batch
        embeddings = embedding_generator.generate_batch(chunk_texts)
        logger.info("Embeddings generados")

        # 5. Insertar chunks en la base de datos
        logger.info("Insertando chunks en la base de datos")
        chunks_to_insert = []
        for chunk_tuple, embedding in zip(chunks, embeddings):
            chunk_text_content, chunk_index = chunk_tuple
            token_count = estimate_tokens(chunk_text_content)
            chunks_to_insert.append(
                {
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "content": chunk_text_content,
                    "embedding": embedding,
                    "token_count": token_count,
                }
            )

        # Insertar en lotes de 100 para evitar problemas de tamaño
        batch_size = 100
        for i in range(0, len(chunks_to_insert), batch_size):
            batch = chunks_to_insert[i : i + batch_size]
            supabase_client.table("document_chunks").insert(batch).execute()

        logger.info("Documento procesado exitosamente. {} chunks insertados", len(chunks))
        return (len(chunks), None)

    except Exception as e:
        error_msg = f"Error procesando documento: {str(e)}"
        logger.exception(error_msg)
        return (0, error_msg)

