const ERROR_KEYWORDS = [
  ['invalidCredentials', ['login credentials', 'invalid login', 'invalid credentials']],
  ['emailNotConfirmed', ['not confirmed', 'email confirmation']],
  ['userExists', ['already registered', 'already been registered']],
  ['weakPassword', ['at least 6 characters']],
  ['samePassword', ['new password', 'old password']],
  ['tooManyRequests', ['too many requests', 'rate limit']],
];

export function getAuthErrorKey(error) {
  if (!error?.message) return null;

  const message = String(error.message).toLowerCase();

  for (const [key, keywords] of ERROR_KEYWORDS) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      return key;
    }
  }

  return 'generic';
}