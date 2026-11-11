import prisma from "../config/db";
import { hashPassword, comparePassword, DUMMY_PASSWORD_HASH } from "../utils/password.util";
import { signToken } from "../utils/jwt.util";
import { normalizeEmail } from "../validators/auth.validator";

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface LoginData {
  email: string;
  password: string;
}

// New accounts store the email lower-cased. Lookups ignore case so accounts created before
// this change (which kept whatever capitalisation was typed) still work.
function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
}

export async function registerUser(data: RegisterData) {
  const email = normalizeEmail(data.email);

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error("EMAIL_IN_USE");
  }

  const hashedPassword = await hashPassword(data.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: data.name.trim(),
      },
    });
  } catch (error) {
    // Two sign-ups with the same email at the same instant can both pass the check above.
    // The database's unique index still lets only one through; report it like any duplicate.
    if ((error as { code?: string }).code === "P2002") {
      throw new Error("EMAIL_IN_USE");
    }
    throw error;
  }

  const token = signToken({ userId: user.id });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function loginUser(data: LoginData) {
  const user = await findUserByEmail(normalizeEmail(data.email));

  // Always do the password comparison, even for an unknown email, so both failures take the
  // same time. The caller gets the same error either way.
  const passwordMatches = await comparePassword(data.password, user?.password ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = signToken({ userId: user.id });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
}