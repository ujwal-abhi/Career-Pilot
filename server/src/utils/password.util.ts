import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// A real hash of a password nobody knows. Login compares against this when the email does
// not exist, so "unknown email" and "wrong password" both spend the same ~60ms hashing.
// Without it, a missing account answered instantly and an attacker could use the response
// time to find out which emails are registered.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("this-is-not-anyones-password", SALT_ROUNDS);