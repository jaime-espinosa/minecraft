const unsupported = (path, detail) => {
  throw new TypeError(`Unsupported canonical JSON value at ${path}: ${detail}`);
};

const ownDataDescriptor = (value, key, path, { enumerable = true } = {}) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (enumerable && !descriptor.enumerable) unsupported(path, 'non-enumerable properties are not supported');
  if (!Object.hasOwn(descriptor, 'value')) unsupported(path, 'accessor properties are not supported');
  return descriptor;
};

const serialize = (value, path, ancestors) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) unsupported(path, 'number must be finite');
    return JSON.stringify(value);
  }

  if (typeof value !== 'object') unsupported(path, typeof value);
  if (ancestors.has(value)) throw new TypeError(`Cyclic canonical JSON value at ${path}`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const allowed = new Set(['length']);
      for (let index = 0; index < value.length; index += 1) allowed.add(String(index));
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !allowed.has(key)) {
          unsupported(path, 'arrays may contain only index and length own keys');
        }
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) unsupported(`${path}[${index}]`, 'sparse arrays are not supported');
        const descriptor = ownDataDescriptor(value, String(index), `${path}[${index}]`);
        items.push(serialize(descriptor.value, `${path}[${index}]`, ancestors));
      }
      return `[${items.join(',')}]`;
    }

    if (Object.getPrototypeOf(value) !== Object.prototype) {
      unsupported(path, 'only plain objects and arrays are supported');
    }

    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (typeof key !== 'string') unsupported(path, 'symbol properties are not supported');
    }
    const entries = keys
      .sort()
      .map((key) => {
        const descriptor = ownDataDescriptor(value, key, `${path}.${key}`);
        return `${JSON.stringify(key)}:${serialize(descriptor.value, `${path}.${key}`, ancestors)}`;
      });
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
};

export const canonicalJson = (value) => serialize(value, '$', new WeakSet());
