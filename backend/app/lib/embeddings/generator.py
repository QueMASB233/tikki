"""Generador de embeddings usando sentence-transformers."""

import os
import threading
import time
from typing import List, Optional, Union, Any
from loguru import logger

# Deshabilitar compilación y JIT de PyTorch
os.environ["TORCH_COMPILE_DISABLE"] = "1"
os.environ["TORCHDYNAMO_DISABLE"] = "1"
os.environ["PYTORCH_JIT"] = "0"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Singleton thread-safe
_embedding_generator: Optional['EmbeddingGenerator'] = None
_embedding_lock = threading.Lock()

class EmbeddingGenerator:
    """Generador de embeddings usando sentence-transformers con fallback y carga asíncrona."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model: Any = None 
        self._dimension: int = 384 # Dimensión por defecto para MiniLM-L6-v2
        self._lock = threading.Lock()
        self._is_fallback = True  # Iniciar en modo fallback
        self._loading = False
        self._load_thread: Optional[threading.Thread] = None
        logger.info("EmbeddingGenerator initialized (starting in FALLBACK mode, loading model in background)")
        
        # Iniciar carga en background inmediatamente
        self._start_background_load()

    def _start_background_load(self):
        """Inicia la carga del modelo en un thread separado."""
        if self._loading or self._model is not None:
            return
        
        self._loading = True
        self._load_thread = threading.Thread(target=self._load_model_background, daemon=True)
        self._load_thread.start()
        logger.info("Started background thread to load embedding model")

    def _load_model_background(self):
        """Carga el modelo en un thread separado sin bloquear."""
        try:
            logger.info("Background: Loading embedding model: {} (this may take a few minutes on first run)", self.model_name)
            start_time = time.time()
            
            # Intentar aplicar parches básicos antes de importar
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                from sentence_transformers import SentenceTransformer
                
            # Cargar modelo con timeout implícito (si se bloquea, el thread morirá)
            self._model = SentenceTransformer(self.model_name, device="cpu")
            self._dimension = self._model.get_sentence_embedding_dimension()
            
            elapsed = time.time() - start_time
            logger.info("Background: Embedding model loaded successfully in {:.2f} seconds. Dimension: {}", elapsed, self._dimension)
            
            # Cambiar de fallback a modo real
            with self._lock:
                self._is_fallback = False
                self._loading = False
                
        except Exception as e:
            logger.error("Background: Failed to load embedding model: {}", e)
            logger.warning("Background: Continuing in FALLBACK mode. Chat will work but semantic memory will be limited.")
            with self._lock:
                self._model = "FALLBACK"
                self._is_fallback = True
                self._loading = False
                self._dimension = 384

    def _ensure_model_loaded(self):
        """Verifica si el modelo está cargado (no bloquea, solo verifica estado)."""
        # No hacer nada, el modelo se carga en background
        # Solo esperar un poco si está cargando y necesitamos el modelo
        if self._loading and self._load_thread and self._load_thread.is_alive():
            # Esperar máximo 0.1 segundos para no bloquear
            self._load_thread.join(timeout=0.1)

    @property
    def dimension(self) -> int:
        self._ensure_model_loaded()
        return self._dimension

    def generate(self, text: str) -> List[float]:
        """Genera embedding o devuelve ceros en fallback."""
        self._ensure_model_loaded()
        
        if not text or not text.strip():
            return [0.0] * self.dimension

        if self._is_fallback:
            return [0.0] * self.dimension
            
        try:
            embedding = self._model.encode(text, normalize_embeddings=True)
            return embedding.tolist()
        except Exception as e:
            logger.error("Error generating embedding: {}", e)
            return [0.0] * self.dimension

    def generate_batch(self, texts: List[str]) -> List[List[float]]:
        """Genera batch de embeddings o devuelve ceros en fallback."""
        self._ensure_model_loaded()
        
        if not texts:
            return []
            
        count = len(texts)
        if self._is_fallback:
            return [[0.0] * self.dimension] * count

        try:
            # Filtrar textos vacíos para evitar errores del modelo
            valid_indices = [i for i, t in enumerate(texts) if t and t.strip()]
            valid_texts = [texts[i] for i in valid_indices]
            
            if not valid_texts:
                 return [[0.0] * self.dimension] * count

            embeddings = self._model.encode(valid_texts, normalize_embeddings=True)
            
            # Reconstruir lista completa
            result = [[0.0] * self.dimension] * count
            for i, valid_idx in enumerate(valid_indices):
                result[valid_idx] = embeddings[i].tolist()
                
            return result
        except Exception as e:
            logger.error("Error generating batch embeddings: {}", e)
            return [[0.0] * self.dimension] * count

def get_embedding_generator() -> EmbeddingGenerator:
    global _embedding_generator
    if _embedding_generator is None:
        with _embedding_lock:
            if _embedding_generator is None:
                _embedding_generator = EmbeddingGenerator()
    return _embedding_generator
