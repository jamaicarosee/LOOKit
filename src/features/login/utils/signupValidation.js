export const INVALID_EMAIL_MESSAGE = 'Please input a valid email';

const EMAIL_REGEX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export function isValidEmailFormat(email) {
  const value = (email || '').trim().toLowerCase();
  if (!value || value.length > 254 || value.includes('..')) return false;
  if (!EMAIL_REGEX.test(value)) return false;

  const [localPart, domain] = value.split('@');
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.')
  ) {
    return false;
  }

  const tld = domain.split('.').pop() || '';
  return tld.length >= 2 && /^[a-z]+$/.test(tld);
}

export function getPasswordChecks(password = '') {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function isStrongPassword(password = '') {
  const checks = getPasswordChecks(password);
  return (
    password.length <= 72 &&
    checks.minLength &&
    checks.hasUppercase &&
    checks.hasNumber &&
    checks.hasSpecialChar
  );
}

export function getPasswordError(password = '') {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 72) {
    return 'Password must be at most 72 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return '';
}