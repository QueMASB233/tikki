/**
 * SoundManager - Sistema centralizado de reproducción de efectos de sonido
 * Usa Web Audio API para generar sonidos sintéticos "cute" sin archivos externos
 */

import { appConfig } from "../config";

type SoundType = "send" | "receive" | "transformation";

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;

  constructor() {
    if (typeof window === "undefined") return;
    
    this.enabled = appConfig.enableSounds;
    this.volume = appConfig.soundVolume;
    
    // Inicializar AudioContext de forma lazy
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
      this.enabled = false;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn("Failed to create AudioContext:", e);
        this.enabled = false;
        return null;
      }
    }
    
    // Resumir contexto si está suspendido
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  /**
   * Genera un sonido suave tipo "pop" para enviar mensaje
   */
  private playSendSound() {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Frecuencia suave y ascendente
    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    // Envelope suave
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.type = "sine";
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }

  /**
   * Genera un sonido tipo "sparkle" cuando llega respuesta
   */
  private playReceiveSound() {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    // Crear múltiples osciladores para efecto "sparkle"
    const times = [0, 0.05, 0.1];
    const frequencies = [600, 800, 1000];

    times.forEach((delay, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequencies[i], ctx.currentTime + delay);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequencies[i] * 1.5,
        ctx.currentTime + delay + 0.1
      );

      gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(
        this.volume * 0.2,
        ctx.currentTime + delay + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + delay + 0.12
      );

      oscillator.type = "sine";
      oscillator.start(ctx.currentTime + delay);
      oscillator.stop(ctx.currentTime + delay + 0.12);
    });
  }

  /**
   * Genera un sonido brillante para modo transformación
   */
  private playTransformationSound() {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    // Sonido más complejo con múltiples frecuencias
    const frequencies = [400, 600, 800, 1000];
    const delays = [0, 0.03, 0.06, 0.09];

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + delays[i]);
      oscillator.frequency.exponentialRampToValueAtTime(
        freq * 2,
        ctx.currentTime + delays[i] + 0.2
      );

      gainNode.gain.setValueAtTime(0, ctx.currentTime + delays[i]);
      gainNode.gain.linearRampToValueAtTime(
        this.volume * 0.4,
        ctx.currentTime + delays[i] + 0.02
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + delays[i] + 0.25
      );

      oscillator.type = "sine";
      oscillator.start(ctx.currentTime + delays[i]);
      oscillator.stop(ctx.currentTime + delays[i] + 0.25);
    });
  }

  /**
   * Reproduce un sonido según su tipo
   */
  play(type: SoundType) {
    if (!this.enabled) return;

    try {
      switch (type) {
        case "send":
          this.playSendSound();
          break;
        case "receive":
          this.playReceiveSound();
          break;
        case "transformation":
          this.playTransformationSound();
          break;
      }
    } catch (error) {
      console.warn("Error playing sound:", error);
    }
  }

  /**
   * Habilita o deshabilita los sonidos
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Establece el volumen (0.0 a 1.0)
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

// Singleton instance
export const soundManager = new SoundManager();

/**
 * Hook para usar sonidos en componentes React
 */
export function useSound() {
  return {
    playSend: () => soundManager.play("send"),
    playReceive: () => soundManager.play("receive"),
    playTransformation: () => soundManager.play("transformation"),
    setEnabled: (enabled: boolean) => soundManager.setEnabled(enabled),
    setVolume: (volume: number) => soundManager.setVolume(volume),
  };
}

