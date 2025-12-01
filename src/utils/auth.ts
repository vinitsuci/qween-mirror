import CryptoJS from 'crypto-js';

export interface AuthData {
  signature: string;
  timestamp: number;
}

export const getSignature = (appId: string, token: string): AuthData => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = CryptoJS.SHA256(timestamp + token + appId + timestamp)
    .toString()
    .toUpperCase();
  
  return { signature, timestamp };
};
