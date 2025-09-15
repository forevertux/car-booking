// API Configuration
// Using direct AWS endpoints with CORS enabled
export const API_ENDPOINTS = {
  USER_SERVICE: 'https://puv4ho5h5l.execute-api.eu-west-1.amazonaws.com',
  NOTIFICATION_SERVICE: 'https://02irqijwuf.execute-api.eu-west-1.amazonaws.com',
  BOOKING_SERVICE: 'https://40c09p5fk4.execute-api.eu-west-1.amazonaws.com',
  MAINTENANCE_SERVICE: 'https://nhf2aqeyk1.execute-api.eu-west-1.amazonaws.com',
  ISSUES_SERVICE: 'https://7tipye9dfa.execute-api.eu-west-1.amazonaws.com'
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};