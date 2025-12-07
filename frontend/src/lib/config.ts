/**
 * Configuración centralizada de la aplicación
 */

export const appConfig = {
  // Sonidos
  enableSounds: false,
  soundVolume: 0.0, // 0.0 a 1.0
  
  // Animaciones
  enableMagicAnimations: true,
  particleIntensity: 1.0, // 0.0 a 2.0
  
  // Modo Transformación
  transformationKeyword: "transformación",
  transformationDuration: 5000, // Duración en ms (solo para la respuesta actual)
  
  // Hashing (Obsoleto: Encriptación manejada por backend)
  enableMessageHashing: false,
} as const;

export type AppConfig = typeof appConfig;

