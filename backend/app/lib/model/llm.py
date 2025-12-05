"""Cliente para llamadas al modelo LLM con streaming."""

from typing import AsyncIterator, Dict, List, Optional, Any
import httpx
from loguru import logger

from ...config import Settings, get_settings


class LLMClient:
    """Cliente para interactuar con modelos LLM (DeepSeek)."""

    def __init__(self, settings: Settings):
        """Inicializa el cliente LLM.
        
        Args:
            settings: Configuración de la aplicación.
        """
        self.settings = settings
        self.api_key = settings.deepseek_api_key
        self.base_url = "https://api.deepseek.com/v1"
        
        if not self.api_key:
            logger.error("DEEPSEEK_API_KEY not configured")
        else:
            # Log parcial de la key para verificar que se está cargando (solo primeros y últimos caracteres)
            masked_key = f"{self.api_key[:7]}...{self.api_key[-4:]}" if len(self.api_key) > 11 else "***"
            logger.info("DeepSeek API Key loaded: {}", masked_key)

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.4,
        max_tokens: int = 2000,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """Realiza una llamada al modelo sin streaming.
        
        Args:
            messages: Lista de mensajes en formato OpenAI.
            temperature: Temperatura para la generación.
            max_tokens: Máximo número de tokens.
            stream: Si es True, devuelve un stream (no implementado aquí).
            
        Returns:
            Respuesta del modelo.
        """
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY not configured")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # Solo incluir stream si es True (DeepSeek puede requerir que no se envíe si es False)
        if stream:
            payload["stream"] = True

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            # Mejor manejo de errores para debug
            if response.status_code != 200:
                error_detail = response.text
                logger.error("DeepSeek API error: status={}, response={}", response.status_code, error_detail)
                response.raise_for_status()
            
            return response.json()

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.4,
        max_tokens: int = 2000,
    ) -> AsyncIterator[str]:
        """Realiza una llamada al modelo con streaming.
        
        Args:
            messages: Lista de mensajes en formato OpenAI.
            temperature: Temperatura para la generación.
            max_tokens: Máximo número de tokens.
            
        Yields:
            Chunks de texto de la respuesta.
        """
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY not configured")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            import json
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            logger.warning("Failed to parse streaming response: {}", data_str)
                            continue


def get_llm_client() -> LLMClient:
    """Obtiene el cliente LLM."""
    settings = get_settings()
    return LLMClient(settings)




