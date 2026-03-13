import { Share, Platform } from 'react-native';

const BASE_URL = 'https://eventgasm.onrender.com';

export const shareEvent = async (event) => {
  try {
    const shareUrl = `${BASE_URL}/share/event/${event.id}`;
    const message = Platform.OS === 'ios'
      ? event.title
      : `${event.title}\n\nCheck it out on Eventgasm: ${shareUrl}`;
    
    const result = await Share.share({
      message,
      url: shareUrl, // iOS only
      title: event.title,
    });
    
    return result.action !== Share.dismissedAction;
  } catch (error) {
    console.log('Share failed:', error);
    return false;
  }
};

export const getShareUrl = (eventId) => {
  return `${BASE_URL}/share/event/${eventId}`;
};

export default { shareEvent, getShareUrl };
