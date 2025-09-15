// Mock API responses for development
// Remove this file when backend is updated

export const mockCheckEmail = (phone: string) => {
  // Simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock data - users with emails
      const usersWithEmail = [
        '+40758917203', // Dragos Admin
        '+40750241511', // Gigel Test user
      ];
      
      resolve({
        data: {
          hasEmail: usersWithEmail.includes(phone)
        }
      });
    }, 500);
  });
};

export const mockRequestPinEmail = (phone: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[MOCK] Email PIN would be sent for ${phone}`);
      resolve({
        data: {
          message: 'PIN sent to email'
        }
      });
    }, 500);
  });
};