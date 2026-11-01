type KeyedQueue = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export function createKeyedQueue(): KeyedQueue {
  const tailByKey = new Map<string, Promise<unknown>>();
  return (key, task) => {
    const previous = tailByKey.get(key) ?? Promise.resolve();
    const result = previous.then(task);
    const tail = result.catch(() => undefined);
    tailByKey.set(key, tail);
    tail.then(() => {
      if (tailByKey.get(key) === tail) tailByKey.delete(key);
    });
    return result;
  };
}
