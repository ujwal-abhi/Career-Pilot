// A guard for the API tests, which wipe every table between files. Pointing them at your real
// database by mistake would delete your data, so anything that is not clearly a test database
// is refused.

// Name of the database in a PostgreSQL URL ("postgresql://u:p@host:5432/NAME?x=y" -> "NAME").
export function databaseNameOf(connectionString: string): string {
  return decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ""));
}

// Only names that end in _test (letters, digits and underscores only) are accepted.
export function assertTestDatabase(connectionString: string): string {
  const name = databaseNameOf(connectionString);
  if (!/^[A-Za-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to run tests against database "${name}". The database name must end in _test. ` +
        `Set TEST_DATABASE_URL in server/.env to a separate database such as careerpilot_test.`
    );
  }
  return connectionString;
}