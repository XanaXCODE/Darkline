const crypto = require('crypto');
const forge = require('node-forge');

class CryptoManager {
  constructor(config) {
    this.config = config;
    this.algorithm = config.encryptionAlgorithm || 'aes-256-gcm';
    this.keyCache = new Map();
  }

  async encrypt(message, recipientPublicKey) {
    try {
      const messageData = typeof message === 'string' ? message : JSON.stringify(message);
      
      // Generate a random AES key for this message
      const aesKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      // Encrypt the message with AES
      const cipher = crypto.createCipher(this.algorithm, aesKey);
      let encrypted = cipher.update(messageData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag for GCM mode
      const authTag = cipher.getAuthTag ? cipher.getAuthTag() : null;
      
      // Encrypt the AES key with recipient's RSA public key
      const publicKeyObj = forge.pki.publicKeyFromPem(recipientPublicKey);
      const encryptedAesKey = publicKeyObj.encrypt(aesKey, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: forge.mgf1.create(forge.md.sha256.create())
      });
      
      return {
        encryptedData: encrypted,
        encryptedKey: forge.util.encode64(encryptedAesKey),
        iv: iv.toString('hex'),
        authTag: authTag ? authTag.toString('hex') : null,
        algorithm: this.algorithm,
        timestamp: Date.now()
      };
      
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decrypt(encryptedMessage, privateKey) {
    try {
      // Decrypt the AES key with private RSA key
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
      const encryptedAesKey = forge.util.decode64(encryptedMessage.encryptedKey);
      const aesKey = privateKeyObj.decrypt(encryptedAesKey, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: forge.mgf1.create(forge.md.sha256.create())
      });
      
      // Decrypt the message with AES
      const decipher = crypto.createDecipher(encryptedMessage.algorithm, Buffer.from(aesKey, 'binary'));
      
      if (encryptedMessage.authTag) {
        decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'hex'));
      }
      
      let decrypted = decipher.update(encryptedMessage.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
      
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async hashData(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  async verifyMessageIntegrity(message, signature, publicKey) {
    try {
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      const messageHash = await this.hashData(JSON.stringify(message));
      const md = forge.md.sha256.create();
      md.update(messageHash, 'utf8');
      
      return publicKeyObj.verify(md.digest().bytes(), signature);
    } catch (error) {
      console.error('Message integrity verification failed:', error);
      return false;
    }
  }

  async signMessage(message, privateKey) {
    try {
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
      const messageHash = await this.hashData(JSON.stringify(message));
      const md = forge.md.sha256.create();
      md.update(messageHash, 'utf8');
      
      return privateKeyObj.sign(md);
    } catch (error) {
      throw new Error(`Message signing failed: ${error.message}`);
    }
  }

  generateSessionKey(length = 32) {
    return crypto.randomBytes(length);
  }

  async deriveKeyFromPassword(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  generateSalt(length = 16) {
    return crypto.randomBytes(length);
  }

  async encryptWithPassword(data, password) {
    try {
      const salt = this.generateSalt();
      const key = await this.deriveKeyFromPassword(password, salt);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher('aes-256-gcm', key);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
      
    } catch (error) {
      throw new Error(`Password encryption failed: ${error.message}`);
    }
  }

  async decryptWithPassword(encryptedData, password) {
    try {
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const key = await this.deriveKeyFromPassword(password, salt);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      throw new Error(`Password decryption failed: ${error.message}`);
    }
  }

  async generateKeyPair() {
    return new Promise((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({
        bits: this.config.keySize || 2048,
        workers: 2
      }, (err, keypair) => {
        if (err) {
          reject(err);
          return;
        }
        
        const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
        const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
        
        resolve({
          publicKey: publicKeyPem,
          privateKey: privateKeyPem
        });
      });
    });
  }

  validatePublicKey(publicKeyPem) {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      return publicKey.n.bitLength() >= 2048;
    } catch (error) {
      return false;
    }
  }

  validatePrivateKey(privateKeyPem) {
    try {
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      return privateKey.n.bitLength() >= 2048;
    } catch (error) {
      return false;
    }
  }

  getPublicKeyFingerprint(publicKeyPem) {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(publicKeyPem);
      const fingerprint = hash.digest('hex');
      
      return fingerprint.match(/.{1,4}/g).join(':').toUpperCase();
    } catch (error) {
      return null;
    }
  }

  async secureWipe(buffer) {
    if (Buffer.isBuffer(buffer)) {
      crypto.randomFillSync(buffer);
    }
  }

  async constantTimeCompare(a, b) {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  generateNonce(length = 16) {
    return crypto.randomBytes(length).toString('hex');
  }

  async createMessageEnvelope(message, senderPrivateKey, recipientPublicKey) {
    try {
      // Encrypt the message
      const encryptedMessage = await this.encrypt(message, recipientPublicKey);
      
      // Create envelope with metadata
      const envelope = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        nonce: this.generateNonce(),
        encryptedMessage
      };
      
      // Sign the envelope
      const signature = await this.signMessage(envelope, senderPrivateKey);
      
      return {
        ...envelope,
        signature: forge.util.encode64(signature)
      };
      
    } catch (error) {
      throw new Error(`Failed to create message envelope: ${error.message}`);
    }
  }

  async verifyMessageEnvelope(envelope, senderPublicKey) {
    try {
      const { signature, ...envelopeData } = envelope;
      const signatureBytes = forge.util.decode64(signature);
      
      return await this.verifyMessageIntegrity(envelopeData, signatureBytes, senderPublicKey);
    } catch (error) {
      console.error('Envelope verification failed:', error);
      return false;
    }
  }
}

module.exports = CryptoManager;