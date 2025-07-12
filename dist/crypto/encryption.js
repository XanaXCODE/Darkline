"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoEngine = void 0;
const ed25519_1 = require("@noble/curves/ed25519");
const ed25519_2 = require("@noble/curves/ed25519");
const crypto_1 = require("crypto");
const sha256_1 = require("@noble/hashes/sha256");
const crypto_2 = require("crypto");
class CryptoEngine {
    static generateKeyPair() {
        const privateKey = ed25519_1.x25519.utils.randomPrivateKey();
        const publicKey = ed25519_1.x25519.getPublicKey(privateKey);
        const signingPrivateKey = ed25519_2.ed25519.utils.randomPrivateKey();
        const signingPublicKey = ed25519_2.ed25519.getPublicKey(signingPrivateKey);
        return { privateKey, publicKey, signingPrivateKey, signingPublicKey };
    }
    static deriveSharedSecret(privateKey, publicKey) {
        return ed25519_1.x25519.getSharedSecret(privateKey, publicKey);
    }
    static deriveEncryptionKey(sharedSecret, salt) {
        const combined = new Uint8Array(sharedSecret.length + salt.length);
        combined.set(sharedSecret);
        combined.set(salt, sharedSecret.length);
        return Buffer.from((0, sha256_1.sha256)(combined)).slice(0, 32);
    }
    static encrypt(message, key) {
        const nonce = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_2.createCipheriv)('aes-256-gcm', key, nonce);
        let ciphertext = cipher.update(message, 'utf8', 'hex');
        ciphertext += cipher.final('hex');
        const tag = cipher.getAuthTag();
        return {
            ciphertext,
            nonce: nonce.toString('hex'),
            tag: tag.toString('hex')
        };
    }
    static decrypt(encryptedMessage, key) {
        const { ciphertext, nonce, tag } = encryptedMessage;
        const decipher = (0, crypto_2.createDecipheriv)('aes-256-gcm', key, Buffer.from(nonce, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
        plaintext += decipher.final('utf8');
        return plaintext;
    }
    static encryptForPeer(message, myPrivateKey, peerPublicKey) {
        const sharedSecret = this.deriveSharedSecret(myPrivateKey, peerPublicKey);
        const salt = (0, crypto_1.randomBytes)(16);
        const encryptionKey = this.deriveEncryptionKey(sharedSecret, salt);
        const encrypted = this.encrypt(message, encryptionKey);
        return {
            ...encrypted,
            nonce: salt.toString('hex') + encrypted.nonce
        };
    }
    static decryptFromPeer(encryptedMessage, myPrivateKey, peerPublicKey) {
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
    static sign(message, privateKey) {
        return ed25519_2.ed25519.sign(message, privateKey);
    }
    static verifySignature(message, signature, publicKey) {
        try {
            return ed25519_2.ed25519.verify(signature, message, publicKey);
        }
        catch (error) {
            return false;
        }
    }
}
exports.CryptoEngine = CryptoEngine;
//# sourceMappingURL=encryption.js.map