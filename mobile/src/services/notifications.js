import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@eventgasm_push_token';
const NOTIFICATION_PREFS_KEY = '@eventgasm_notification_prefs';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Default notification preferences
const DEFAULT_PREFS = {
  enabled: true,
  eventReminders: true,      // Remind before saved events
  newEvents: true,           // New events in your area
  freeEvents: true,          // Free event alerts
  reminderTime: 60,          // Minutes before event (60 = 1 hour)
};

export async function registerForPushNotifications() {
  let token;

  // Must be a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get Expo push token
  token = (await Notifications.getExpoPushTokenAsync({
    projectId: '031730c8-fe15-4250-989a-1781de213e33', // EAS project ID
  })).data;

  // Store token locally
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

  // Configure Android channel
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Event Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#667eea',
    });
  }

  return token;
}

export async function getPushToken() {
  return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function getNotificationPrefs() {
  try {
    const prefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    return prefs ? { ...DEFAULT_PREFS, ...JSON.parse(prefs) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setNotificationPrefs(prefs) {
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

export async function scheduleEventReminder(event, minutesBefore = 60) {
  const eventDate = new Date(event.timing?.start);
  const reminderDate = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);

  // Don't schedule if reminder time has passed
  if (reminderDate <= new Date()) {
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎉 Event Starting Soon!',
      body: `${event.title} starts in ${minutesBefore} minutes`,
      data: { eventId: event.id, type: 'reminder' },
      sound: true,
    },
    trigger: {
      date: reminderDate,
    },
  });

  return id;
}

export async function cancelEventReminder(notificationId) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Add listeners for notification events
export function addNotificationListeners(onNotificationReceived, onNotificationResponse) {
  const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
