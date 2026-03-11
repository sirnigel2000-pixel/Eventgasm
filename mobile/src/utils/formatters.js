import { format, parseISO, isToday, isTomorrow, isThisWeek, isSameMonth, isSameYear } from 'date-fns';

export function formatDateRange(startString, endString) {
  if (!startString) return '';
  if (!endString || startString === endString) {
    return formatEventDate(startString);
  }
  
  const start = parseISO(startString);
  const end = parseISO(endString);
  
  // Same month: "Mar 12-20"
  if (isSameMonth(start, end)) {
    return `${format(start, 'MMM d')}-${format(end, 'd')}`;
  }
  
  // Same year: "Mar 12 - Apr 5"
  if (isSameYear(start, end)) {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
  }
  
  // Different years
  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
}

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
