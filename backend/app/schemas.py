from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    auth_user_id: str = Field(description="ID del usuario en Supabase Auth")
    email: EmailStr
    full_name: str = Field(default="", description="User's full name (can be empty for initial signup)")
    study_type: Optional[str] = Field(None, description="Tipo de estudio que busca (máster, posgrado, grado, etc.)")
    career_interest: Optional[str] = Field(None, description="Carrera o área de interés")
    nationality: Optional[str] = Field(None, description="Nacionalidad del usuario")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    status: Literal["pending", "active"]
    study_type: Optional[str] = None
    career_interest: Optional[str] = None
    nationality: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    requiresPayment: Optional[bool] = None


class UpdateProfileRequest(BaseModel):
    """Request para actualizar el perfil del usuario."""
    full_name: Optional[str] = Field(None, description="Nombre completo del usuario")
    study_type: Optional[str] = Field(None, description="Tipo de estudio que busca")
    career_interest: Optional[str] = Field(None, description="Carrera o área de interés")
    nationality: Optional[str] = Field(None, description="Nacionalidad del usuario")


class CheckoutRequest(BaseModel):
    returnUrl: str
    email: Optional[EmailStr] = None  # Opcional - Stripe pedirá el email


class CheckoutResponse(BaseModel):
    checkoutUrl: str


class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    role: Literal["system", "user", "assistant"]
    content: str
    created_at: datetime


class StructuredAssistantResponse(BaseModel):
    """Respuesta estructurada del asistente con memoria."""
    assistant_response: str
    memory_update: Optional[str] = None
    episodic_update: Optional[str] = None
    summary_update: Optional[str] = None


class ConversationResponse(BaseModel):
    """Modelo de respuesta para una conversación."""
    id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime


class CreateConversationRequest(BaseModel):
    """Request para crear una nueva conversación."""
    title: Optional[str] = None


class UpdateConversationRequest(BaseModel):
    """Request para actualizar una conversación."""
    title: str


# Admin schemas
class AdminSignupRequest(BaseModel):
    auth_user_id: str = Field(description="ID del usuario en Supabase Auth")
    email: EmailStr
    full_name: str = Field(min_length=1)


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminUserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    status: Literal["pending", "active"]


class AdminAuthResponse(BaseModel):
    token: str
    user: AdminUserResponse


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    status: str
    message: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    file_size: Optional[int]
    mime_type: Optional[str]
    status: str
    processing_status: Optional[str]
    processing_error: Optional[str]
    processed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class DocumentUpdateRequest(BaseModel):
    status: Optional[Literal["active", "inactive", "deleted"]] = None


class MetricsResponse(BaseModel):
    career_interest: dict
    study_type: dict
    nationality: dict


