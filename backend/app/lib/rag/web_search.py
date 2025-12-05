"""Módulo de búsqueda web para complementar RAG cuando no hay chunks relevantes."""

from typing import List, Dict, Optional
from loguru import logger
import os

try:
    from duckduckgo_search import DDGS
    DUCKDUCKGO_AVAILABLE = True
except ImportError:
    DUCKDUCKGO_AVAILABLE = False
    logger.warning("duckduckgo_search no está instalado. Búsqueda web no disponible.")


def search_web(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """Realiza una búsqueda web y retorna resultados relevantes.
    
    Args:
        query: Consulta de búsqueda.
        max_results: Número máximo de resultados a retornar.
        
    Returns:
        Lista de diccionarios con 'title', 'url', y 'snippet' para cada resultado.
    """
    if not DUCKDUCKGO_AVAILABLE:
        logger.warning("Búsqueda web no disponible: duckduckgo_search no está instalado")
        return []
    
    try:
        with DDGS() as ddgs:
            results = []
            # Usar text() para búsqueda general
            for result in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": result.get("title", ""),
                    "url": result.get("href", ""),
                    "snippet": result.get("body", ""),
                })
            
            logger.info("Web search returned {} results for query: {}", len(results), query[:50])
            return results
    except Exception as e:
        logger.exception("Error performing web search: {}", e)
        return []


def format_web_results_for_prompt(results: List[Dict[str, str]]) -> str:
    """Formatea los resultados de búsqueda web para incluir en el prompt.
    
    Args:
        results: Lista de resultados de búsqueda web.
        
    Returns:
        Texto formateado con los resultados.
    """
    if not results:
        return ""
    
    sections = ["=== INFORMACIÓN COMPLEMENTARIA DE INTERNET ==="]
    sections.append(
        "Los siguientes resultados provienen de búsquedas en internet para complementar la información:"
    )
    sections.append("")
    
    for i, result in enumerate(results, 1):
        title = result.get("title", "").strip()
        url = result.get("url", "").strip()
        snippet = result.get("snippet", "").strip()
        
        if title or snippet:
            sections.append(f"[Resultado {i}]")
            if title:
                sections.append(f"Título: {title}")
            if url:
                sections.append(f"URL: {url}")
            if snippet:
                sections.append(f"Contenido: {snippet}")
            sections.append("")
    
    sections.append("=== FIN DE INFORMACIÓN DE INTERNET ===")
    sections.append("")
    
    return "\n".join(sections)



