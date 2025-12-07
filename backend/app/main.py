import os
import warnings
import inspect

# Suprimir advertencias de PyTorch sobre "could not get source code"
# Esto es necesario en macOS con Python 3.12
warnings.filterwarnings("ignore", message=".*could not get source code.*")
warnings.filterwarnings("ignore", message=".*Unable to retrieve source.*")

# Deshabilitar compilación y JIT de PyTorch para evitar errores de "could not get source code"
os.environ["TORCH_COMPILE_DISABLE"] = "1"
os.environ["TORCHDYNAMO_DISABLE"] = "1"
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
# Deshabilitar JIT completamente
os.environ["PYTORCH_JIT"] = "0"
os.environ["TORCH_LOGS"] = "+dynamo"
# Deshabilitar completamente el uso de JIT en PyTorch
os.environ["TORCH_ALLOW_TF32_CUBLAS_OVERRIDE"] = "0"
# Deshabilitar paralelismo de tokenizers para evitar bloqueos (deadlocks)
os.environ["TOKENIZERS_PARALLELISM"] = "false"
# Deshabilitar advertencias de symlinks en huggingface_hub
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Monkey patch para inspect.getsource para evitar errores con PyTorch
# PyTorch intenta inspeccionar código fuente de módulos compilados que no tienen fuente disponible
# Esto debe hacerse ANTES de importar cualquier cosa que use PyTorch
_original_getsource = inspect.getsource
_original_getsourcelines = inspect.getsourcelines
_original_findsource = inspect.findsource

def _patched_getsource(object):
    """Patch para inspect.getsource que retorna un string vacío si falla."""
    try:
        return _original_getsource(object)
    except (OSError, TypeError, ValueError) as e:
        # Capturar todos los errores relacionados con source code inspection
        # ValueError: "Expected a single top-level function"
        # OSError: "could not get source code"
        return ""

def _patched_getsourcelines(object):
    """Patch para inspect.getsourcelines que retorna lista vacía si falla."""
    try:
        return _original_getsourcelines(object)
    except (OSError, TypeError, ValueError):
        return ([], 0)

def _patched_findsource(object):
    """Patch para inspect.findsource que retorna lista vacía si falla."""
    try:
        return _original_findsource(object)
    except (OSError, TypeError, ValueError):
        return ([], 0)

inspect.getsource = _patched_getsource
inspect.getsourcelines = _patched_getsourcelines
inspect.findsource = _patched_findsource

# Monkey patch torch._sources.parse_def usando un import hook
# Esto intercepta la importación de torch y aplica el patch inmediatamente
import sys
_original_import = __import__

def _patch_torch_sources():
    """Aplica monkey patch a torch._sources.parse_def si torch está disponible."""
    try:
        import torch
        # Deshabilitar JIT completamente después de importar torch
        torch.jit._state.disable()
        
        # También deshabilitar dynamo
        if hasattr(torch, '_dynamo'):
            torch._dynamo.config.suppress_errors = True
            torch._dynamo.config.disable = True
        
        import torch._sources
        if hasattr(torch._sources, 'parse_def') and not hasattr(torch._sources, '_patched'):
            _original_parse_def = torch._sources.parse_def
            
            def _patched_parse_def(*args, **kwargs):
                """Patch que maneja diferentes formas de llamar a parse_def."""
                try:
                    return _original_parse_def(*args, **kwargs)
                except (RuntimeError, AttributeError, TypeError) as e:
                    # Si hay cualquier error, retornar un objeto que tenga los atributos necesarios
                    # pero que no cause problemas
                    if "Expected a single top-level function" in str(e) or "'Pass' object has no attribute 'body'" in str(e):
                        # Retornar el resultado original pero capturando el error
                        # O simplemente retornar un objeto que no cause problemas
                        try:
                            # Intentar retornar lo que se espera
                            import ast
                            # Crear un módulo AST simple
                            module_ast = ast.Module(body=[ast.FunctionDef(
                                name='_dummy',
                                args=ast.arguments(
                                    posonlyargs=[],
                                    args=[],
                                    kwonlyargs=[],
                                    kw_defaults=[],
                                    defaults=[]
                                ),
                                body=[],
                                decorator_list=[],
                                returns=None
                            )], type_ignores=[])
                            func_def = module_ast.body[0]
                            class MockDef:
                                def __init__(self):
                                    self.ast = func_def
                            return MockDef()
                        except:
                            # Si todo falla, retornar None y dejar que PyTorch maneje el error
                            return None
                    raise
            
            torch._sources.parse_def = _patched_parse_def
            torch._sources._patched = True
    except (ImportError, AttributeError):
        pass

def _patched_import(name, *args, **kwargs):
    module = _original_import(name, *args, **kwargs)
    # Aplicar patch cuando se importe torch o cualquier módulo que contenga torch
    if name == 'torch' or (hasattr(module, '__name__') and 'torch' in str(module.__name__)):
        try:
            _patch_torch_sources()
        except:
            pass
    return module

# Aplicar el monkey patch de import
import builtins
builtins.__import__ = _patched_import

# Usar certificados del sistema de macOS en lugar de certifi
# certifi no funciona correctamente en macOS con Python 3.12
_macos_cert_path = "/etc/ssl/cert.pem"
if os.path.exists(_macos_cert_path):
    os.environ["SSL_CERT_FILE"] = _macos_cert_path
    os.environ["REQUESTS_CA_BUNDLE"] = _macos_cert_path
else:
    # Fallback a certifi si no hay certificados del sistema
    import certifi
    os.environ["SSL_CERT_FILE"] = certifi.where()
    os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .routes import auth, billing, chat, admin


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Ladybug API",
        version="0.1.0",
        description="Backend FastAPI para Ladybug - Compañera diaria con IA",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url, "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    # app.include_router(billing.router)  # Stripe deshabilitado
    app.include_router(chat.router)
    app.include_router(admin.router)

    @app.get("/health", tags=["util"])
    def health_check(settings: Settings = Depends(get_settings)):
        from loguru import logger
        from supabase import create_client
        
        health_status = {
            "status": "ok",
            "backend": "running",
            "supabase_url": settings.supabase_url,
            "supabase_configured": bool(settings.supabase_service_role_key and settings.supabase_service_role_key != "REEMPLAZA_CON_TU_SERVICE_ROLE_KEY"),
        }
        
        # Test Supabase connection
        try:
            if health_status["supabase_configured"]:
                client = create_client(settings.supabase_url, settings.supabase_service_role_key)
                # Try a simple query
                result = client.table("users").select("id").limit(1).execute()
                health_status["supabase_connection"] = "ok"
            else:
                health_status["supabase_connection"] = "not_configured"
        except Exception as e:
            logger.error("Health check Supabase error: {}", e)
            health_status["supabase_connection"] = f"error: {str(e)}"
        
        return health_status

    return app


app = create_app()

