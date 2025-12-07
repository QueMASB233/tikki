/**
 * Modo Transformación - Sistema para activar un modo especial del bot
 */

import { appConfig } from "../config";

export interface TransformationState {
  isActive: boolean;
  activatedAt: number | null;
}

let transformationState: TransformationState = {
  isActive: false,
  activatedAt: null,
};

/**
 * Detecta si un mensaje contiene la palabra clave de transformación
 */
export function detectTransformationKeyword(message: string): boolean {
  const keyword = appConfig.transformationKeyword.toLowerCase();
  const lowerMessage = message.toLowerCase();
  
  // Buscar la palabra clave como palabra completa
  const regex = new RegExp(`\\b${keyword}\\b`, "i");
  return regex.test(lowerMessage);
}

/**
 * Activa el modo transformación
 */
export function triggerTransformation(): void {
  transformationState = {
    isActive: true,
    activatedAt: Date.now(),
  };
}

/**
 * Desactiva el modo transformación
 */
export function deactivateTransformation(): void {
  transformationState = {
    isActive: false,
    activatedAt: null,
  };
}

/**
 * Obtiene el estado actual del modo transformación
 */
export function getTransformationState(): TransformationState {
  return { ...transformationState };
}

/**
 * Verifica si el modo transformación está activo
 */
export function isTransformationModeActive(): boolean {
  return transformationState.isActive;
}

/**
 * Decora el prompt del sistema para modo transformación
 */
export function decoratePromptForTransformation(basePrompt: string): string {
  if (!transformationState.isActive) {
    return basePrompt;
  }

  const transformationAddition = `

=== 🦋 MODO TRANSFORMACIÓN ACTIVADO ===

Estás en modo transformación épico. Tu personalidad se intensifica:
- Sé más heroica y determinada
- Usa un tono más épico y motivador
- Muestra más confianza y poder
- Mantén la esencia de Ladybug pero con más intensidad
- Este modo dura solo para esta respuesta

¡Es hora de brillar! ✨🦋✨
`;

  return basePrompt + transformationAddition;
}

/**
 * Resetea el modo transformación después de una respuesta
 */
export function resetTransformationAfterResponse(): void {
  // El modo se desactiva automáticamente después de la duración configurada
  if (transformationState.activatedAt) {
    const elapsed = Date.now() - transformationState.activatedAt;
    if (elapsed >= appConfig.transformationDuration) {
      deactivateTransformation();
    }
  }
}

