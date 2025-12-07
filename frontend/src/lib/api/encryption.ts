const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Inicializar fernet de forma síncrona al cargar el módulo
let fernetModule: any = null;
let token: any = null;

// Función para inicializar fernet una sola vez
function initializeFernet() {
  if (token) {
    return token;
  }

  try {
    // Importación síncrona usando require (funciona mejor en Node.js/Next.js server)
    fernetModule = require('fernet');
    
    if (!fernetModule || !fernetModule.Secret || !fernetModule.Token) {
      throw new Error('Fernet module structure is incorrect. Available keys: ' + JSON.stringify(Object.keys(fernetModule || {})));
    }
    
    // Crear Secret con la clave de encriptación
    if (!ENCRYPTION_KEY) {
      console.warn('ENCRYPTION_KEY not found. Encryption will not work properly.');
      throw new Error('ENCRYPTION_KEY is required');
    }
    
    try {
      const secret = new fernetModule.Secret(ENCRYPTION_KEY);
      // Crear Token con ttl=0 (sin expiración)
      token = new fernetModule.Token({ secret: secret, ttl: 0 });
    } catch (error) {
      console.error('Error initializing Fernet Token with provided key:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error initializing fernet:', error);
    throw error;
  }
  
  return token;
}

// Inicializar al cargar el módulo
try {
  initializeFernet();
} catch (error) {
  console.error('Failed to initialize fernet on module load:', error);
}

function getToken() {
  if (!token) {
    return initializeFernet();
  }
  return token;
}

export function encryptMessage(message: string): string {
  if (!message) return '';
  
  try {
    const t = getToken();
    return t.encode(message);
  } catch (error) {
    console.error('Error encrypting message:', error);
    return message; // Fallback
  }
}

export function decryptMessage(encryptedMessage: string): string {
  if (!encryptedMessage) return '';
  
  try {
    const t = getToken();
    return t.decode(encryptedMessage);
  } catch (error) {
    // Asumir que no estaba encriptado (migración suave)
    console.warn('Error decrypting message, returning as-is:', error);
    return encryptedMessage;
  }
}

