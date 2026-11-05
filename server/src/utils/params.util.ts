// Express 5 types a route parameter as "string | string[]". Our routes only ever declare
// single-value parameters (":id"), so take the first value and always return a string.
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}