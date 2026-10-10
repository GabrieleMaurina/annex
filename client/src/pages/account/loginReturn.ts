let returnPath = '/';

export function setLoginReturnPath(path: string) {
  returnPath = path;
}

export function takeLoginReturnPath() {
  const path = returnPath;
  returnPath = '/';
  return path;
}
