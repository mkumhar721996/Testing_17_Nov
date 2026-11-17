// Cognito sign-in is a separate story; until it stores a token, requests go out unauthenticated.
export function getAccessToken(): string | null {
  return sessionStorage.getItem('access_token')
}
