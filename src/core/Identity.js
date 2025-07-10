const crypto = require('crypto');
const forge = require('node-forge');
const { v4: uuidv4 } = require('uuid');

class Identity {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.id = null;
    this.name = null;
    this.publicKey = null;
    this.privateKey = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      const existingIdentity = await this.storageManager.loadIdentity();
      
      if (existingIdentity) {
        await this.loadIdentity(existingIdentity);
      } else {
        await this.createNewIdentity();
      }
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize identity: ${error.message}`);
    }
  }

  async createNewIdentity() {
    console.log('🔐 Creating new identity...');
    
    // Generate unique ID
    this.id = uuidv4();
    
    // Generate username (can be changed later)
    this.name = `User_${this.id.substring(0, 8)}`;
    
    // Generate RSA key pair
    const keyPair = await this.generateKeyPair();
    this.publicKey = keyPair.publicKey;
    this.privateKey = keyPair.privateKey;
    
    // Save identity
    await this.saveIdentity();
    
    console.log(`✅ New identity created: ${this.name} (${this.id})`);
  }

  async loadIdentity(identityData) {
    this.id = identityData.id;
    this.name = identityData.name;
    this.publicKey = identityData.publicKey;
    this.privateKey = identityData.privateKey;
    
    console.log(`🔑 Identity loaded: ${this.name} (${this.id})`);
  }

  async generateKeyPair() {
    return new Promise((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({
        bits: 2048,
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

  async saveIdentity() {
    const identityData = {
      id: this.id,
      name: this.name,
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };
    
    await this.storageManager.saveIdentity(identityData);
  }

  async updateName(newName) {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }
    
    this.name = newName.trim();
    await this.saveIdentity();
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getPublicKey() {
    return this.publicKey;
  }

  getPrivateKey() {
    return this.privateKey;
  }

  getPublicKeyFingerprint() {
    if (!this.publicKey) return null;
    
    const hash = crypto.createHash('sha256');
    hash.update(this.publicKey);
    const fingerprint = hash.digest('hex');
    
    // Format as groups of 4 characters
    return fingerprint.match(/.{1,4}/g).join(':').toUpperCase();
  }

  verifyIdentity(publicKey, signature, data) {
    try {
      const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      
      return publicKeyObj.verify(md.digest().bytes(), signature);
    } catch (error) {
      console.error('Identity verification failed:', error);
      return false;
    }
  }

  signData(data) {
    try {
      const privateKeyObj = forge.pki.privateKeyFromPem(this.privateKey);
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      
      return privateKeyObj.sign(md);
    } catch (error) {
      throw new Error(`Failed to sign data: ${error.message}`);
    }
  }

  exportPublicIdentity() {
    return {
      id: this.id,
      name: this.name,
      publicKey: this.publicKey,
      fingerprint: this.getPublicKeyFingerprint()
    };
  }

  generateConnectionToken() {
    const tokenData = {
      id: this.id,
      name: this.name,
      publicKey: this.publicKey,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };
    
    const signature = this.signData(JSON.stringify(tokenData));
    
    return {
      ...tokenData,
      signature: forge.util.encode64(signature)
    };
  }

  verifyConnectionToken(token) {
    try {
      const { signature, ...tokenData } = token;
      const signatureBytes = forge.util.decode64(signature);
      
      return this.verifyIdentity(
        token.publicKey,
        signatureBytes,
        JSON.stringify(tokenData)
      );
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  isInitialized() {
    return this.initialized;
  }

  async regenerateKeys() {
    console.log('🔄 Regenerating key pair...');
    
    const keyPair = await this.generateKeyPair();
    this.publicKey = keyPair.publicKey;
    this.privateKey = keyPair.privateKey;
    
    await this.saveIdentity();
    
    console.log('✅ Key pair regenerated successfully');
  }

  async backup() {
    return {
      id: this.id,
      name: this.name,
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      fingerprint: this.getPublicKeyFingerprint(),
      backupDate: new Date().toISOString()
    };
  }

  async restore(backupData) {
    if (!backupData.id || !backupData.publicKey || !backupData.privateKey) {
      throw new Error('Invalid backup data');
    }
    
    this.id = backupData.id;
    this.name = backupData.name;
    this.publicKey = backupData.publicKey;
    this.privateKey = backupData.privateKey;
    
    await this.saveIdentity();
    
    console.log('✅ Identity restored from backup');
  }
}

module.exports = Identity;