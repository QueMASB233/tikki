import { Fernet } from 'fernet';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

let fernet: Fernet | null = null;

function getFernet(): Fernet {
  if (!fernet) {
    if (!ENCRYPTION_KEY) {
      console.warn('ENCRYPTION_KEY not found. Using a temporary key (data will be unreadable after restart).');
      // Generar una clave temporal (no persistente)
      const tempKey = Fernet.generateKey();
      fernet = new Fernet(tempKey);
    } else {
      try {
        fernet = new Fernet(ENCRYPTION_KEY);
      } catch (error) {
        console.error('Error initializing Fernet:', error);
        // Fallback a clave temporal
        const tempKey = Fernet.generateKey();
        fernet = new Fernet(tempKey);
      }
    }
  }
  return fernet;
}

export function encryptMessage(message: string): string {
  if (!message) return '';
  
  try {
    const f = getFernet();
    return f.encode(message);
  } catch (error) {
    console.error('Error encrypting message:', error);
    return message; // Fallback
  }
}

export function decryptMessage(encryptedMessage: string): string {
  if (!encryptedMessage) return '';
  
  try {
    const f = getFernet();
    return f.decode(encryptedMessage);
  } catch (error) {
    // Asumir que no estaba encriptado (migración suave)
    return encryptedMessage;
  }
}

