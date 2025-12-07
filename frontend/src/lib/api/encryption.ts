const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

let FernetClass: any = null;
let fernet: any = null;
let fernetPromise: Promise<any> | null = null;

async function getFernet() {
  // Si ya tenemos la instancia, retornarla
  if (fernet) {
    return fernet;
  }

  // Si ya hay una promesa en curso, esperarla
  if (fernetPromise) {
    await fernetPromise;
    return fernet;
  }

  // Crear nueva promesa de inicialización
  fernetPromise = (async () => {
    try {
      // Importación dinámica para evitar problemas en build
      const fernetModule = await import('fernet');
      
      // Intentar diferentes formas de importar
      FernetClass = fernetModule.Fernet;
      if (!FernetClass && fernetModule.default) {
        FernetClass = fernetModule.default.Fernet || fernetModule.default;
      }
      
      if (!FernetClass || typeof FernetClass !== 'function') {
        throw new Error('Fernet class not found in module. Module structure: ' + JSON.stringify(Object.keys(fernetModule)));
      }

      // Verificar que generateKey existe
      if (!FernetClass.generateKey || typeof FernetClass.generateKey !== 'function') {
        throw new Error('Fernet.generateKey is not a function');
      }
    } catch (error) {
      console.error('Error importing fernet module:', error);
      throw error;
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
  })();

  await fernetPromise;
  fernetPromise = null;
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

