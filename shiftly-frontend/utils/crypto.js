import CryptoJS from 'crypto-js';

/**
 * Generate a 256-bit random key (hex string).
 */
export function generateChatKey() {
  return CryptoJS.lib.WordArray.random(32).toString(); 
}

/**
 * AES-CBC encrypt → returns Base64 ciphertext + Base64 IV.
 */
export function encryptMessage(plaintext, hexKey) {
  const key       = CryptoJS.enc.Hex.parse(hexKey);
  const iv        = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });
  return {
    ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    iv:         iv.toString(CryptoJS.enc.Base64)
  };
}

/**
 * AES-CBC decrypt → returns UTF-8 string.
 */
export function decryptMessage(ciphertextB64, ivB64, hexKey) {
  const key         = CryptoJS.enc.Hex.parse(hexKey);
  const iv          = CryptoJS.enc.Base64.parse(ivB64);
  const cipherParams= CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64)
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
}
