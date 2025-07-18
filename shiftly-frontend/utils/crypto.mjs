// File: shiftly-frontend/utils/crypto.mjs
import CryptoJS from "crypto-js";

/**
 * Generate a 128-bit random key, hex-encoded.
 */
export function generateChatKey() {
  return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
}

/**
 * Encrypt `plainText` with a hex key.
 * Returns { iv: Base64, ciphertext: Base64 }.
 */
export function encryptMessage(plainText, hexKey) {
  const key = CryptoJS.enc.Hex.parse(hexKey);
  const iv  = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plainText, key, { iv });
  return {
    iv:         CryptoJS.enc.Base64.stringify(iv),
    ciphertext: encrypted.toString()
  };
}

/**
 * Decrypt using the same hex key + Base64 IV.
 * Returns the UTF-8 plaintext.
 */
export function decryptMessage(ivB64, ciphertext, hexKey) {
  const key = CryptoJS.enc.Hex.parse(hexKey);
  const iv  = CryptoJS.enc.Base64.parse(ivB64);
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, { iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
}
