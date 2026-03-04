import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns';

export function formatEventDate(dateString) {
  if (!dateString) return '';
  
  const date = parseISO(dateString);
  
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  
  if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, 'h:mm a')}`;
  }
  
  if (isThisWeek(date)) {
    return format(date, "EEEE 'at' h:mm a");
  }
  
  return format(date, "MMM d 'at' h:mm a");
}

export function formatDistance(meters) {
  if (!meters && meters !== 0) return null;
  
  const miles = meters / 1609.34;
  
  if (miles < 0.1) return 'Nearby';
  if (miles < 1) return `${(miles * 10).toFixed(0) / 10} mi`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatPrice(price) {
  if (!price) return null;
  if (price.isFree) return 'Free';
  if (price.min && price.max) {
    return `$${price.min} - $${price.max}`;
  }
  if (price.min) return `From $${price.min}`;
  return null;
}
