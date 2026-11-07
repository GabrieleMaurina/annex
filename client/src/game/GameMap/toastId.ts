let lastToastId = 0;

export function nextToastId() {
  lastToastId += 1;
  return lastToastId;
}
