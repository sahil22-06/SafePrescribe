/**
 * Centralized time utility for consistent time handling across the application
 * 
 * GOLDEN RULE:
 * - Backend: Always stores and sends time in UTC
 * - Frontend: Always converts UTC to user's local timezone before display
 */

/**
 * Convert UTC timestamp from backend to user's local timezone
 * @param {string|Date} utcTime - UTC timestamp from backend
 * @returns {Date} - Local time object
 */
export const toLocalTime = (utcTime) => {
  if (!utcTime) return null;
  return new Date(utcTime);
};

/**
 * Format time for display in appointment cards and lists
 * @param {string|Date} utcTime - UTC timestamp from backend
 * @param {string} format - Display format (default: 'h:mm A')
 * @returns {string} - Formatted local time string
 */
export const formatAppointmentTime = (utcTime, format = 'h:mm A') => {
  const localTime = toLocalTime(utcTime);
  if (!localTime) return 'Invalid time';
  
  if (format === 'h:mm A') {
    return localTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  return localTime.toLocaleTimeString();
};

/**
 * Format date and time for display
 * @param {string|Date} utcTime - UTC timestamp from backend
 * @param {string} format - Display format (default: 'MMM DD, YYYY h:mm A')
 * @returns {string} - Formatted local date and time string
 */
export const formatAppointmentDateTime = (utcTime, format = 'MMM DD, YYYY h:mm A') => {
  const localTime = toLocalTime(utcTime);
  if (!localTime) return 'Invalid time';
  
  if (format === 'MMM DD, YYYY h:mm A') {
    return localTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  return localTime.toLocaleString();
};

/**
 * Format date for display
 * @param {string|Date} utcTime - UTC timestamp from backend
 * @param {string} format - Display format (default: 'MMM DD, YYYY')
 * @returns {string} - Formatted local date string
 */
export const formatAppointmentDate = (utcTime, format = 'MMM DD, YYYY') => {
  const localTime = toLocalTime(utcTime);
  if (!localTime) return 'Invalid date';
  
  if (format === 'MMM DD, YYYY') {
    return localTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }
  
  return localTime.toLocaleDateString();
};

/**
 * Check if a time is in the past
 * @param {string|Date} utcTime - UTC timestamp from backend
 * @returns {boolean} - True if the time is in the past
 */
export const isPastTime = (utcTime) => {
  const localTime = toLocalTime(utcTime);
  if (!localTime) return false;
  
  return localTime < new Date();
};

/**
 * Check if a time is today
 * @param {string|Date} utcTime - UTC timestamp from backend
 * @returns {boolean} - True if the time is today
 */
export const isToday = (utcTime) => {
  const localTime = toLocalTime(utcTime);
  if (!localTime) return false;
  
  const today = new Date();
  return localTime.toDateString() === today.toDateString();
};

/**
 * Get current timezone information
 * @returns {object} - Timezone information
 */
export const getTimezoneInfo = () => {
  const now = new Date();
  return {
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currentTime: now.toLocaleString(),
    currentTimeUTC: now.toISOString(),
    timezoneOffset: now.getTimezoneOffset()
  };
};

/**
 * Format queue wait time
 * @param {string|Date} startTime - When the patient checked in
 * @returns {string} - Formatted wait time
 */
export const formatQueueTime = (startTime) => {
  const start = toLocalTime(startTime);
  if (!start) return 'Unknown';
  
  const now = new Date();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  
  if (diffHours < 24) {
    return remainingMins > 0 ? `${diffHours}h ${remainingMins}m` : `${diffHours}h`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

/**
 * Parse UTC time string and return formatted local time
 * @param {string} utcTime - UTC time string from backend
 * @returns {object} - Parsed time information
 */
export const parseUTCTime = (utcTime) => {
  if (!utcTime) return null;
  
  const utcTimeObj = new Date(utcTime);
  
  return {
    utc: utcTimeObj.toISOString(),
    local: utcTimeObj.toLocaleString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: utcTimeObj.getTimezoneOffset(),
    isValid: !isNaN(utcTimeObj.getTime())
  };
};