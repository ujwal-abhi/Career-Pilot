// Limits exist so that nobody can send a 10 MB "name" or make the server hash a 1 MB
// "password". 72 bytes is bcrypt's own limit: it silently ignores everything after byte 72,
// so allowing longer passwords would only give people a false sense of security.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;
export const MAX_EMAIL_LENGTH = 254; // the practical maximum for an email address
export const MAX_NAME_LENGTH = 100;
const MAX_LOGIN_PASSWORD_LENGTH = 1000; // only to bound CPU work; older accounts may be longer

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Ghost@Gmail.com " and "ghost@gmail.com" are the same mailbox, so they must be the same
// account.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// The body can be anything a client chooses to send: missing, an array, numbers, nested
// objects. Every field is checked for its TYPE first, so a wrong shape gets a 400, never a
// crash.
function asBody(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

export function validateRegisterInput(data: unknown): string | null {
  const { email, password, name } = asBody(data);

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof name !== "string" ||
    !email.trim() ||
    !password ||
    !name.trim()
  ) {
    return "Email, password, and name are all required.";
  }

  if (email.trim().length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email.trim())) {
    return "Please provide a valid email address.";
  }

  if (name.trim().length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password is too long (the limit is ${MAX_PASSWORD_BYTES} bytes, which is about ${MAX_PASSWORD_BYTES} characters).`;
  }

  return null;
}

export function validateLoginInput(data: unknown): string | null {
  const { email, password } = asBody(data);

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return "Email and password are required.";
  }

  if (email.length > MAX_EMAIL_LENGTH + 50 || password.length > MAX_LOGIN_PASSWORD_LENGTH) {
    return "Email or password is too long.";
  }

  return null;
}