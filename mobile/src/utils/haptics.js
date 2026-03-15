/**
 * Cross-platform haptics - works on native, no-op on web
 */
import { Platform } from 'react-native';

let Haptics = null;

if (Platform.OS !== 'web') {
  Haptics = require('expo-haptics');
}

export const impactAsync = (style = 'Medium') => {
  if (Haptics) {
    const feedbackStyle = Haptics.ImpactFeedbackStyle?.[style] || Haptics.ImpactFeedbackStyle?.Medium;
    return Haptics.impactAsync(feedbackStyle);
  }
  return Promise.resolve();
};

export const notificationAsync = (type = 'Success') => {
  if (Haptics) {
    const feedbackType = Haptics.NotificationFeedbackType?.[type] || Haptics.NotificationFeedbackType?.Success;
    return Haptics.notificationAsync(feedbackType);
  }
  return Promise.resolve();
};

export const selectionAsync = () => {
  if (Haptics) {
    return Haptics.selectionAsync();
  }
  return Promise.resolve();
};

export default {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
};
