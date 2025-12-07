declare module 'fernet' {
  export class Fernet {
    constructor(secret: string);
    encode(message: string): string;
    decode(token: string): string;
    static generateKey(): string;
  }
}

