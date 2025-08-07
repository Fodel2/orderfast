export function getGuestEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('guest_email')
}

