interface RegisterInput {
  email?: string;
  password?: string;
  name?: string;
}

interface LoginInput {
  email?: string;
  password?: string;
}

export function validateRegisterInput(data: RegisterInput): string | null {
  const { email, password, name } = data;

  if (!email || !password || !name) {
    return "Email, password, and name are all required.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please provide a valid email address.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return null;
}

export function validateLoginInput(data: LoginInput): string | null {
  const { email, password } = data;

  if (!email || !password) {
    return "Email and password are required.";
  }

  return null;
}