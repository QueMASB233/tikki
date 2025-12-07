const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Suprimir el warning de Buffer() deprecated de la librería fernet
// Este warning viene de crypto-js que usa fernet internamente
if (typeof process !== 'undefined' && process.env) {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function(warning: any, ...args: any[]) {
    if (typeof warning === 'string' && warning.includes('Buffer() is deprecated')) {
      return; // Suprimir el warning
    }
    return originalEmitWarning.call(process, warning, ...args);
  };
}

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
    // Crear un nuevo token para cada mensaje para evitar problemas con mensajes largos
    const secret = new fernetModule.Secret(ENCRYPTION_KEY);
    const token = new fernetModule.Token({ secret: secret, ttl: 0 });
    
    // Verificar el tamaño del mensaje antes de encriptar
    if (message.length > 50000) {
      console.warn(`Message is very long (${message.length} chars), attempting encryption...`);
    }
    
    return token.encode(message);
  } catch (error: any) {
    console.error('Error encrypting message:', error);
    console.error('Message length:', message.length);
    console.error('Error details:', error.message, error.stack);
    
    // Si el mensaje es demasiado largo, devolver sin encriptar
    if (message.length > 100000) {
      console.warn('Message too long for encryption, storing without encryption');
      return message; // Fallback para mensajes muy largos
    }
    
    // Si hay un error de array length, puede ser un problema con crypto-js
    if (error.message && error.message.includes('array length')) {
      console.error('Array length error detected - this may be a crypto-js limitation');
      // Intentar truncar el mensaje si es muy largo
      if (message.length > 10000) {
        console.warn('Attempting to encrypt truncated message');
        try {
          const secret = new fernetModule.Secret(ENCRYPTION_KEY);
          const token = new fernetModule.Token({ secret: secret, ttl: 0 });
          // Intentar con los primeros 10000 caracteres
          return token.encode(message.substring(0, 10000)) + '...[TRUNCATED]';
        } catch (truncError) {
          console.error('Even truncated message failed:', truncError);
        }
      }
    }
    
    return message; // Fallback
  }
}

export function decryptMessage(encryptedMessage: string): string {
  if (!encryptedMessage) return '';
  
  try {
    // Crear un nuevo token para cada mensaje
    const secret = new fernetModule.Secret(ENCRYPTION_KEY);
    const token = new fernetModule.Token({ secret: secret, ttl: 0 });
    return token.decode(encryptedMessage);
  } catch (error) {
    // Asumir que no estaba encriptado (migración suave)
    console.warn('Error decrypting message, returning as-is:', error);
    return encryptedMessage;
  }
}

