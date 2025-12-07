const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

let FernetClass: any = null;
let fernet: any = null;

async function getFernet() {
  if (!FernetClass) {
    try {
      // Importación dinámica para evitar problemas en build
      const fernetModule = await import('fernet');
      FernetClass = fernetModule.Fernet || fernetModule.default?.Fernet || fernetModule.default;
      
      if (!FernetClass) {
        throw new Error('Fernet class not found in module');
      }
    } catch (error) {
      console.error('Error importing fernet module:', error);
      throw error;
    }
  }
  
  if (!fernet) {
    if (!ENCRYPTION_KEY) {
      console.warn('ENCRYPTION_KEY not found. Using a temporary key (data will be unreadable after restart).');
      // Generar una clave temporal (no persistente)
      const tempKey = FernetClass.generateKey();
      fernet = new FernetClass(tempKey);
    } else {
      try {
        fernet = new FernetClass(ENCRYPTION_KEY);
      } catch (error) {
        console.error('Error initializing Fernet:', error);
        // Fallback a clave temporal
        const tempKey = FernetClass.generateKey();
        fernet = new FernetClass(tempKey);
      }
    }
  }
  return fernet;
}

export async function encryptMessage(message: string): Promise<string> {
  if (!message) return '';
  
  try {
    const f = await getFernet();
    return f.encode(message);
  } catch (error) {
    console.error('Error encrypting message:', error);
    return message; // Fallback
  }
}

export async function decryptMessage(encryptedMessage: string): Promise<string> {
  if (!encryptedMessage) return '';
  
  try {
    const f = await getFernet();
    return f.decode(encryptedMessage);
  } catch (error) {
    // Asumir que no estaba encriptado (migración suave)
    return encryptedMessage;
  }
}

