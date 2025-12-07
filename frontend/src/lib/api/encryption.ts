const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Inicializar fernet de forma síncrona al cargar el módulo
let FernetClass: any = null;
let fernet: any = null;

// Función para inicializar fernet una sola vez
function initializeFernet() {
  if (fernet) {
    return fernet;
  }

  try {
    // Importación síncrona usando require (funciona mejor en Node.js/Next.js server)
    const fernetModule = require('fernet');
    
    // El paquete fernet exporta Fernet directamente o como default
    FernetClass = fernetModule.Fernet || fernetModule.default?.Fernet || fernetModule.default;
    
    if (!FernetClass) {
      throw new Error('Fernet class not found in module');
    }

    // Verificar que generateKey existe
    if (!FernetClass.generateKey || typeof FernetClass.generateKey !== 'function') {
      throw new Error('Fernet.generateKey is not a function. Fernet structure: ' + JSON.stringify(Object.keys(FernetClass)));
    }
    
    // Inicializar fernet
    if (!ENCRYPTION_KEY) {
      console.warn('ENCRYPTION_KEY not found. Using a temporary key (data will be unreadable after restart).');
      const tempKey = FernetClass.generateKey();
      fernet = new FernetClass(tempKey);
    } else {
      try {
        fernet = new FernetClass(ENCRYPTION_KEY);
      } catch (error) {
        console.error('Error initializing Fernet with provided key:', error);
        const tempKey = FernetClass.generateKey();
        fernet = new FernetClass(tempKey);
      }
    }
  } catch (error) {
    console.error('Error initializing fernet:', error);
    throw error;
  }
  
  return fernet;
}

// Inicializar al cargar el módulo
try {
  initializeFernet();
} catch (error) {
  console.error('Failed to initialize fernet on module load:', error);
}

function getFernet() {
  if (!fernet) {
    return initializeFernet();
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

