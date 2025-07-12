import { x25519 } from '@noble/curves/ed25519';
import { ed25519 } from '@noble/curves/ed25519';
import { randomBytes } from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { createCipheriv, createDecipheriv } from 'crypto';

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  signingPrivateKey: Uint8Array;
  signingPublicKey: Uint8Array;
}

export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  tag: string;
}

export class CryptoEngine {
  static generateKeyPair(): KeyPair {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const signingPrivateKey = ed25519.utils.randomPrivateKey();
    const signingPublicKey = ed25519.getPublicKey(signingPrivateKey);
    return { privateKey, publicKey, signingPrivateKey, signingPublicKey };
  }

  static deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    return x25519.getSharedSecret(privateKey, publicKey);
  }

  static deriveEncryptionKey(sharedSecret: Uint8Array, salt: Uint8Array): Buffer {
    const combined = new Uint8Array(sharedSecret.length + salt.length);
    combined.set(sharedSecret);
    combined.set(salt, sharedSecret.length);
    return Buffer.from(sha256(combined)).slice(0, 32);
  }

  static encrypt(message: string, key: Buffer): EncryptedMessage {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    
    let ciphertext = cipher.update(message, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      ciphertext,
      nonce: nonce.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  static decrypt(encryptedMessage: EncryptedMessage, key: Buffer): string {
    const { ciphertext, nonce, tag } = encryptedMessage;
    
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  }

  static encryptForPeer(message: string, myPrivateKey: Uint8Array, peerPublicKey: Uint8Array): EncryptedMessage {
    const sharedSecret = this.deriveSharedSecret(myPrivateKey, peerPublicKey);
    const salt = randomBytes(16);
    const encryptionKey = this.deriveEncryptionKey(sharedSecret, salt);
    
    const encrypted = this.encrypt(message, encryptionKey);
    return {
      ...encrypted,
      nonce: salt.toString('hex') + encrypted.nonce
    };
  }

  static decryptFromPeer(encryptedMessage: EncryptedMessage, myPrivateKey: Uint8Array, peerPublicKey: Uint8Array): string {
    const fullNonce = encryptedMessage.nonce;
    const salt = Buffer.from(fullNonce.slice(0, 32), 'hex');
    const nonce = fullNonce.slice(32);
    
    const sharedSecret = this.deriveSharedSecret(myPrivateKey, peerPublicKey);
    const encryptionKey = this.deriveEncryptionKey(sharedSecret, salt);
    
    return this.decrypt({
      ...encryptedMessage,
      nonce
    }, encryptionKey);
  }

  static sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
    return ed25519.sign(message, privateKey);
  }

  static verifySignature(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    try {
      return ed25519.verify(signature, message, publicKey);
    } catch (error) {
      return false;
    }
  }
}