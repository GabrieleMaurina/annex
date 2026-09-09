export function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 128)
    return 'password must be 8-128 characters';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password))
    return 'password must have uppercase and lowercase letters';
  if (!/[0-9]/.test(password)) return 'password must include a number';
  return null;
}
