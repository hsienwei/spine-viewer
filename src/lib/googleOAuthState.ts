export const createGoogleOAuthState = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export const isValidGoogleOAuthState = (expected: string, actual?: string) =>
  expected.length > 0 && actual === expected
