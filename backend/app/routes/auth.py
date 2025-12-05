
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
                    study_type=user.get("study_type"),
                    career_interest=user.get("career_interest"),
                    nationality=user.get("nationality"),
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
                    "status": "pending",  # Usuario pendiente hasta que pague
                    "study_type": payload.study_type,
                    "career_interest": payload.career_interest,
                    "nationality": payload.nationality,
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
                study_type=user.get("study_type"),
                career_interest=user.get("career_interest"),
                nationality=user.get("nationality"),
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
        study_type=current_user.get("study_type"),
        career_interest=current_user.get("career_interest"),
        nationality=current_user.get("nationality"),
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
    if payload.study_type:
        update_data["study_type"] = payload.study_type
    if payload.career_interest:
        update_data["career_interest"] = payload.career_interest
    if payload.nationality:
        update_data["nationality"] = payload.nationality
    
    if not update_data:
        # Si no hay datos para actualizar, devolver el usuario actual
        return UserResponse(
            id=current_user["id"],
            email=current_user["email"],
            status=current_user["status"],
            full_name=current_user.get("full_name"),
            study_type=current_user.get("study_type"),
            career_interest=current_user.get("career_interest"),
            nationality=current_user.get("nationality"),
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
        study_type=updated_user.get("study_type"),
        career_interest=updated_user.get("career_interest"),
        nationality=updated_user.get("nationality"),
    )


@router.post("/complete-signup", response_model=UserResponse)
async def complete_signup(
    payload: dict,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    """
    Completa el registro después del pago y onboarding.
    1. Valida que el billing_intent existe, está pagado y no consumido
    2. Crea usuario en Supabase Auth (si no existe)
    3. Crea fila en tabla users con todos los datos
    4. Crea contacto en HighLevel
    5. Marca billing_intent como consumed = true
    """
    session_id = payload.get("session_id")
    auth_user_id = payload.get("auth_user_id")
    email = payload.get("email")
    password = payload.get("password")  # Para crear en Supabase Auth si es necesario
    full_name = payload.get("full_name")
    study_type = payload.get("study_type")
    career_interest = payload.get("career_interest")
    nationality = payload.get("nationality")
    
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id es requerido.",
        )
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="email es requerido.",
        )
    
    # 1. Validar billing_intent
    intent_response = supabase.table("billing_intents").select("*").eq("stripe_session_id", session_id).single().execute()
    
    if not intent_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión de pago no encontrada.",
        )
    
    intent = intent_response.data
    
    if not intent.get("paid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El pago no ha sido completado.",
        )
    
    if intent.get("consumed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta sesión de pago ya ha sido utilizada.",
        )
    
    # Validar que el email coincida con el del pago
    if intent.get("stripe_customer_email") and intent.get("stripe_customer_email") != email:
        logger.warning(
            "Email mismatch: billing_intent email={}, provided email={}",
            intent.get("stripe_customer_email"),
            email
        )
        # No bloquear, pero registrar la advertencia
    
    # 2. Crear usuario en Supabase Auth si no existe
    if not auth_user_id:
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="password es requerido para crear la cuenta.",
            )
        
        try:
            # Crear usuario en Supabase Auth
            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
            })
            
            if not auth_response.user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo crear el usuario en Supabase Auth.",
                )
            
            auth_user_id = auth_response.user.id
            logger.info("Created user in Supabase Auth: {}", auth_user_id)
        except Exception as e:
            logger.error("Error creating user in Supabase Auth: {}", e)
            if "already registered" in str(e).lower() or "already exists" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este email ya está registrado. Inicia sesión en su lugar.",
                ) from e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear la cuenta de usuario.",
            ) from e
    
    # 3. Verificar que el usuario no exista ya en la tabla users
    existing = supabase.table("users").select("*").eq("email", email).execute()
    
    if existing.data and len(existing.data) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este email ya está registrado.",
        )
    
    # Crear nuevo usuario en tabla users
    insert_data = {
        "auth_user_id": auth_user_id,
        "email": email,
        "full_name": full_name,
        "study_type": study_type,
        "career_interest": career_interest,
        "nationality": nationality,
        "status": "active",  # Activo porque ya pagó
    }
    
    insert_response = supabase.table("users").insert(insert_data).execute()
    
    if not insert_response.data or len(insert_response.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo crear el perfil del usuario.",
        )
    
    updated_user = insert_response.data[0]
    
    # 4. Crear contacto en HighLevel
    if updated_user.get("email") and updated_user.get("full_name"):
        try:
            await create_highlevel_contact(updated_user, settings)
            logger.info(
                "HighLevel contact created successfully after signup completion for user: {} (email: {})",
                updated_user["id"],
                updated_user.get("email")
            )
        except Exception as e:
            # Log error but don't break the signup flow
            logger.error(
                "Failed to create HighLevel contact after signup completion for user {}: {}",
                updated_user.get("id"),
                str(e),
            )
    else:
        logger.warning(
            "Skipping HighLevel contact creation - missing required fields (email or full_name) for user: {}",
            updated_user.get("id")
        )
    
    # 5. Marcar billing_intent como consumed
    update_intent_response = supabase.table("billing_intents").update({
        "consumed": True,
    }).eq("id", intent["id"]).execute()
    
    if not update_intent_response.data or len(update_intent_response.data) == 0:
        logger.warning("Failed to mark billing_intent as consumed: {}", intent["id"])
    else:
        logger.info("Marked billing_intent as consumed: {}", intent["id"])
    
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        status=updated_user["status"],
        full_name=updated_user.get("full_name"),
        study_type=updated_user.get("study_type"),
        career_interest=updated_user.get("career_interest"),
        nationality=updated_user.get("nationality"),
    )

