export const ok = (value) => ({ ok: true, value });

export const err = (fault) => ({ ok: false, fault });
