
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from supabase import Client

from ..config import Settings, get_settings
from ..dependencies import (
    get_current_user,
    get_supabase,
)
from ..schemas import AuthResponse, LoginRequest, SignupRequest, UserResponse, UpdateProfileRequest
from ..lib.highlevel import create_highlevel_contact

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
def signup(
    payload: SignupRequest,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    """
    Crea el perfil del usuario en public.users.
    El usuario ya debe estar creado en Supabase Auth (el frontend lo hace).
    Paso B: Crea la fila en public.users con los datos adicionales
    """
    logger.info("Creating user profile for auth_user_id: {}", payload.auth_user_id)
    
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
        existing = supabase.table("users").select("*").eq("auth_user_id", payload.auth_user_id).execute()
        if existing.data and len(existing.data) > 0:
            logger.warning("User profile already exists for auth_user_id: {}", payload.auth_user_id)
            user = existing.data[0]
            return AuthResponse(
                token="",  # El frontend ya tiene el token
                user=UserResponse(
                    id=user["id"], 
                    email=user["email"], 
                    status=user["status"],
                    full_name=user.get("full_name"),
                    personality_type=user.get("personality_type"),
                    favorite_activity=user.get("favorite_activity"),
                    daily_goals=user.get("daily_goals"),
                ),
                requiresPayment=None,
            )
        
        # Paso B: Crear fila en public.users con los datos adicionales
        insert_response = (
            supabase.table("users")
            .insert(
                {
                    "auth_user_id": payload.auth_user_id,
                    "email": payload.email,
                    "full_name": payload.full_name,
                    "status": "active",  # Usuario activo automáticamente
                    "personality_type": payload.personality_type,
                    "favorite_activity": payload.favorite_activity,
                    "daily_goals": payload.daily_goals,
                }
            )
            .execute()
        )
        
        if not hasattr(insert_response, 'data') or not insert_response.data or len(insert_response.data) == 0:
            logger.error("Error creating user in public.users: No data returned")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear el perfil del usuario.",
            )
        
        user = insert_response.data[0]
        logger.info("User profile created successfully: {}", user["id"])

        # Note: HighLevel contact is created only after successful payment (in webhook)
        # Not creating here to avoid creating contacts for users who don't pay

        return AuthResponse(
            token="",  # El frontend ya tiene el token de Supabase Auth
            user=UserResponse(
                id=user["id"], 
                email=user["email"], 
                status=user["status"],
                full_name=user.get("full_name"),
                personality_type=user.get("personality_type"),
                favorite_activity=user.get("favorite_activity"),
                daily_goals=user.get("daily_goals"),
            ),
            requiresPayment=None,  # Desactivado pago temporalmente
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error during signup: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear perfil: {str(e)}",
        ) from e


# El login ahora se maneja completamente en el frontend con Supabase Auth
# Esta ruta ya no es necesaria, pero la mantenemos por compatibilidad
@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    """
    DEPRECATED: El login ahora se maneja en el frontend con Supabase Auth.
    Esta ruta se mantiene solo por compatibilidad.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="El login ahora se maneja directamente con Supabase Auth en el frontend.",
    )


@router.get("/me", response_model=UserResponse)
def get_profile(current_user=Depends(get_current_user)):
    # Derivar nombre del email si no existe
    full_name = current_user.get("full_name")
    if not full_name and current_user.get("email"):
        full_name = current_user["email"].split("@")[0].capitalize()

    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        status=current_user["status"],
        full_name=full_name,
        personality_type=current_user.get("personality_type"),
        favorite_activity=current_user.get("favorite_activity"),
        daily_goals=current_user.get("daily_goals"),
    )


@router.patch("/me", response_model=UserResponse)
def update_profile(
    payload: UpdateProfileRequest,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Actualiza el perfil del usuario con los datos del onboarding.
    """
    user_id = current_user["id"]
    
    update_data = {}
    if payload.full_name:
        update_data["full_name"] = payload.full_name
    if payload.personality_type:
        update_data["personality_type"] = payload.personality_type
    if payload.favorite_activity:
        update_data["favorite_activity"] = payload.favorite_activity
    if payload.daily_goals:
        update_data["daily_goals"] = payload.daily_goals
    
    if not update_data:
        # Si no hay datos para actualizar, devolver el usuario actual
        return UserResponse(
            id=current_user["id"],
            email=current_user["email"],
            status=current_user["status"],
            full_name=current_user.get("full_name"),
            personality_type=current_user.get("personality_type"),
            favorite_activity=current_user.get("favorite_activity"),
            daily_goals=current_user.get("daily_goals"),
        )
    
    update_response = supabase.table("users").update(update_data).eq("id", user_id).execute()
    
    if not update_response.data or len(update_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo actualizar el perfil.",
        )
    
    updated_user = update_response.data[0]
    
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        status=updated_user["status"],
        full_name=updated_user.get("full_name"),
        personality_type=updated_user.get("personality_type"),
        favorite_activity=updated_user.get("favorite_activity"),
        daily_goals=updated_user.get("daily_goals"),
    )



