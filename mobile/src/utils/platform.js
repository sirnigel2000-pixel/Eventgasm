/**
 * Platform utilities - detect web vs native
 */
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isNative = !isWeb;

// Safely import native-only modules
export const safeImport = (nativeModule, webFallback = null) => {
  if (isWeb) return webFallback;
  return nativeModule;
};
