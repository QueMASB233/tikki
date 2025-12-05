"""HighLevel API service for creating contacts."""

from typing import Any, Dict, Optional, Tuple
from loguru import logger
import httpx

from ...config import Settings


class HighLevelService:
    """Service to interact with HighLevel API for contact management."""

    def __init__(self, settings: Settings):
        """
        Initialize HighLevel service with settings.

        Args:
            settings: Application settings containing HighLevel configuration
        """
        self.api_key = settings.highlevel_api_key
        self.base_url = settings.highlevel_base_url.rstrip("/")
        self.location_id = settings.highlevel_location_id

    def _split_full_name(self, full_name: Optional[str]) -> Tuple[str, str]:
        """
        Split full_name into first_name and last_name.

        Args:
            full_name: Full name string

        Returns:
            Tuple of (first_name, last_name)
        """
        if not full_name:
            return ("", "")

        parts = full_name.strip().split(maxsplit=1)
        if len(parts) == 1:
            return (parts[0], "")
        return (parts[0], parts[1])

    def _build_contact_payload(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build the contact payload from user data.

        Only includes fields that exist in the user table and are accepted by HighLevel.

        Args:
            user_data: User data dictionary from database

        Returns:
            Payload dictionary for HighLevel API
        """
        first_name, last_name = self._split_full_name(user_data.get("full_name"))

        payload: Dict[str, Any] = {
            "firstName": first_name,
            "lastName": last_name,
            "email": user_data.get("email", ""),
        }

        # Add optional fields if they exist
        if user_data.get("study_type"):
            payload["source"] = user_data.get("study_type")

        # Add custom fields if they exist in user data
        # HighLevel custom fields are sent as an array of objects
        # Each object has: id, key (field name), and field_value
        custom_fields: list[Dict[str, Any]] = []
        
        # Mapeo de campos de la base de datos a los IDs y keys de campos personalizados en HighLevel
        CUSTOM_FIELD_CONFIG = {
            "nationality": {
                "id": "SYxu1QfyodiCxdxltUhO",
                "key": "nationality"
            },
            "career_interest": {
                "id": "BgVOSNiTefeb9xofl4zK",
                "key": "career_interest"
            },
            "study_type": {
                "id": "PuvvHcnTn4a1X6zYCMye",
                "key": "study_type"
            }
        }
        
        if user_data.get("nationality"):
            config = CUSTOM_FIELD_CONFIG["nationality"]
            custom_fields.append({
                "id": config["id"],
                "key": config["key"],
                "field_value": user_data.get("nationality")
            })
        
        if user_data.get("study_type"):
            config = CUSTOM_FIELD_CONFIG["study_type"]
            custom_fields.append({
                "id": config["id"],
                "key": config["key"],
                "field_value": user_data.get("study_type")
            })
        
        if user_data.get("career_interest"):
            config = CUSTOM_FIELD_CONFIG["career_interest"]
            custom_fields.append({
                "id": config["id"],
                "key": config["key"],
                "field_value": user_data.get("career_interest")
            })

        # Only add customFields if we have at least one custom field
        if custom_fields:
            payload["customFields"] = custom_fields

        return payload

    async def create_contact(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a contact in HighLevel.

        Args:
            user_data: User data dictionary from database

        Returns:
            Response data from HighLevel API, or None if error occurred
        """
        if not self.api_key or not self.base_url:
            logger.warning("HighLevel API not configured. Skipping contact creation.")
            return None

        if not self.location_id:
            logger.warning("HighLevel locationId not configured. Skipping contact creation.")
            return None

        payload = self._build_contact_payload(user_data)

        # HighLevel API endpoint: POST /contacts/
        # According to official docs, locationId should be in the request body
        url = f"{self.base_url}/contacts/"
        
        # Add locationId to payload (required by HighLevel API)
        payload["locationId"] = self.location_id
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Version": "2021-07-28",  # API version header
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                result = response.json()
                logger.info(
                    "HighLevel contact created successfully for user: {} (email: {})",
                    user_data.get("id"),
                    user_data.get("email"),
                )
                return result

        except httpx.HTTPStatusError as e:
            logger.error(
                "HighLevel API error creating contact for user {}: Status {} - {}",
                user_data.get("id"),
                e.response.status_code,
                e.response.text,
            )
            return None
        except httpx.RequestError as e:
            logger.error(
                "HighLevel API request error creating contact for user {}: {}",
                user_data.get("id"),
                str(e),
            )
            return None
        except Exception as e:
            logger.exception(
                "Unexpected error creating HighLevel contact for user {}: {}",
                user_data.get("id"),
                str(e),
            )
            return None


async def create_highlevel_contact(
    user_data: Dict[str, Any],
    settings: Settings,
) -> Optional[Dict[str, Any]]:
    """
    Convenience function to create a HighLevel contact.

    Args:
        user_data: User data dictionary from database
        settings: Application settings

    Returns:
        Response data from HighLevel API, or None if error occurred
    """
    service = HighLevelService(settings)
    return await service.create_contact(user_data)

