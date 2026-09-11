export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
  };
  message?: string;
}