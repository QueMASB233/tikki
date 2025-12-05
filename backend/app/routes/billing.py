from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from supabase import Client
import stripe
from uuid import uuid4

from ..config import Settings, get_settings
from ..dependencies import get_supabase
from ..schemas import CheckoutRequest, CheckoutResponse
from ..lib.highlevel import create_highlevel_contact

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    payload: CheckoutRequest,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    """
    Crea una sesión de checkout de Stripe.
    Genera un intent_id interno y lo guarda en billing_intents.
    No requiere email ni usuario existente.
    """
    stripe.api_key = settings.stripe_secret_key

    try:
        # Generar UUID interno (intent_id)
        intent_id = str(uuid4())
        
        # Crear checkout session con mode: "payment" (pago único)
        session_params = {
            "mode": "payment",
            "payment_method_types": ["card"],
            "client_reference_id": intent_id,  # Guardar intent_id en Stripe
            "success_url": f"{payload.returnUrl}?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{settings.frontend_url}/cancelled",
            "line_items": [
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": 5500,  # $55.00 USD
                        "product_data": {
                            "name": "Estudia Seguro Asesoría Académica",
                            "description": "Acceso al chat con memoria y asesoría académica 24/7",
                        },
                    },
                    "quantity": 1,
                }
            ],
        }
        
        session = stripe.checkout.Session.create(**session_params)
        
        # Guardar en billing_intents
        insert_response = supabase.table("billing_intents").insert({
            "id": intent_id,
            "stripe_session_id": session.id,
            "stripe_customer_email": None,
            "paid": False,
            "consumed": False,
        }).execute()
        
        if not insert_response.data or len(insert_response.data) == 0:
            logger.error("Failed to create billing_intent for intent_id: {}", intent_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo crear el registro de pago.",
            )
        
        logger.info("Created billing_intent: {} for session: {}", intent_id, session.id)
        
    except HTTPException:
        raise
    except Exception as error:  # pylint: disable=broad-except
        logger.error("Error creating Stripe checkout session: {}", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo crear la sesión de pago.",
        ) from error

    return CheckoutResponse(checkoutUrl=session.url)  # type: ignore[arg-type]


@router.get("/session-info")
def get_session_info(
    session_id: str,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    """
    Obtiene información de una sesión de checkout.
    Valida que el pago fue completado antes de permitir el onboarding.
    Si el billing_intent no está marcado como paid, verifica directamente con Stripe
    (útil para modo test o si el webhook no llegó).
    """
    stripe.api_key = settings.stripe_secret_key
    
    try:
        # Buscar en billing_intents por stripe_session_id
        intent_response = supabase.table("billing_intents").select("*").eq("stripe_session_id", session_id).single().execute()
        
        if not intent_response.data:
            logger.warning("Billing intent not found for session_id: {}", session_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de pago no encontrada.",
            )
        
        intent = intent_response.data
        
        # Si no está marcado como paid, verificar directamente con Stripe
        if not intent.get("paid"):
            logger.info("Billing intent not marked as paid, checking with Stripe directly for session: {}", session_id)
            
            try:
                # Obtener la sesión directamente de Stripe
                session = stripe.checkout.Session.retrieve(session_id)
                
                # Verificar el estado del pago
                if session.payment_status == "paid":
                    # El pago está completo en Stripe, actualizar billing_intent
                    customer_email = session.customer_details.get("email") if hasattr(session, "customer_details") and session.customer_details else None
                    
                    update_response = supabase.table("billing_intents").update({
                        "paid": True,
                        "stripe_customer_email": customer_email,
                    }).eq("id", intent["id"]).execute()
                    
                    if update_response.data and len(update_response.data) > 0:
                        logger.info("Updated billing_intent {} to paid=True after direct Stripe check", intent["id"])
                        intent = update_response.data[0]
                    else:
                        logger.warning("Failed to update billing_intent after Stripe check")
                else:
                    # El pago no está completo
                    logger.warning(
                        "Payment not completed in Stripe for session: {} (payment_status: {})",
                        session_id,
                        session.payment_status
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El pago no ha sido completado exitosamente.",
                    )
            except stripe.error.StripeError as e:
                logger.error("Error checking Stripe session: {}", e)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al verificar el estado del pago con Stripe.",
                ) from e
        
        # Validar que no haya sido consumido ya
        if intent.get("consumed"):
            logger.warning("Attempt to reuse consumed billing intent: {}", session_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta sesión de pago ya ha sido utilizada.",
            )
        
        return {
            "allowed": True,
            "email": intent.get("stripe_customer_email"),
        }
        
    except HTTPException:
        raise
    except Exception as error:  # pylint: disable=broad-except
        logger.error("Error retrieving session info: {}", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo obtener la información de la sesión.",
        ) from error


@router.post("/webhook", include_in_schema=False)
async def handle_stripe_webhook(
    request: Request,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase),
):
    stripe.api_key = settings.stripe_secret_key
    signature = request.headers.get("stripe-signature")
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.error.SignatureVerificationError) as error:
        logger.error("Invalid Stripe webhook: {}", error)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload") from error

    event_type = event["type"]
    data_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        session_id = data_object.get("id")
        client_reference_id = data_object.get("client_reference_id")  # Este es nuestro intent_id
        customer_email = data_object.get("customer_details", {}).get("email") or data_object.get("customer_email")
        payment_status = data_object.get("payment_status")
        
        logger.info(
            "Checkout session completed: session_id={} intent_id={} email={} payment_status={}",
            session_id,
            client_reference_id,
            customer_email,
            payment_status
        )
        
        # Validar que el pago fue exitoso
        if payment_status != "paid":
            logger.warning(
                "Checkout session completed but payment_status is not 'paid': {}",
                payment_status
            )
            return {"status": "warning", "message": "Payment not completed"}
        
        # Actualizar billing_intents
        if client_reference_id:
            update_response = supabase.table("billing_intents").update({
                "paid": True,
                "stripe_customer_email": customer_email,
            }).eq("id", client_reference_id).execute()
            
            if update_response.data and len(update_response.data) > 0:
                logger.info("Updated billing_intent {} to paid=True", client_reference_id)
            else:
                logger.warning("Failed to update billing_intent {} - not found", client_reference_id)
        else:
            logger.warning("No client_reference_id found in checkout.session.completed event")
    
    elif event_type == "payment_intent.succeeded":
        # También manejar payment_intent.succeeded como respaldo
        payment_intent = data_object
        payment_intent_id = payment_intent.get("id")
        
        # Buscar el checkout session asociado a este payment_intent
        try:
            # Obtener el checkout session desde el payment_intent
            sessions = stripe.checkout.Session.list(
                payment_intent=payment_intent_id,
                limit=1
            )
            
            if sessions.data and len(sessions.data) > 0:
                session = sessions.data[0]
                session_id = session.id
                client_reference_id = session.client_reference_id
                customer_email = session.customer_details.get("email") if hasattr(session, "customer_details") and session.customer_details else None
                
                if client_reference_id:
                    update_response = supabase.table("billing_intents").update({
                        "paid": True,
                        "stripe_customer_email": customer_email,
                    }).eq("id", client_reference_id).execute()
                    
                    if update_response.data and len(update_response.data) > 0:
                        logger.info("Updated billing_intent {} to paid=True from payment_intent.succeeded", client_reference_id)
                    else:
                        logger.warning("Failed to update billing_intent {} from payment_intent.succeeded - not found", client_reference_id)
                else:
                    logger.warning("No client_reference_id found in checkout session for payment_intent: {}", payment_intent_id)
            else:
                logger.warning("No checkout session found for payment_intent: {}", payment_intent_id)
        except Exception as e:
            logger.error("Error processing payment_intent.succeeded: {}", e)

    return {"status": "success"}

