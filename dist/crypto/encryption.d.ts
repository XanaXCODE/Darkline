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
export declare class CryptoEngine {
    static generateKeyPair(): KeyPair;
    static deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array;
    static deriveEncryptionKey(sharedSecret: Uint8Array, salt: Uint8Array): Buffer;
    static encrypt(message: string, key: Buffer): EncryptedMessage;
    static decrypt(encryptedMessage: EncryptedMessage, key: Buffer): string;
    static encryptForPeer(message: string, myPrivateKey: Uint8Array, peerPublicKey: Uint8Array): EncryptedMessage;
    static decryptFromPeer(encryptedMessage: EncryptedMessage, myPrivateKey: Uint8Array, peerPublicKey: Uint8Array): string;
    static sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
    static verifySignature(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
}
//# sourceMappingURL=encryption.d.ts.map