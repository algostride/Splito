// Turns a rejected RTK Query mutation/query into something showable.
// DRF returns either {"detail": "..."} or {field: [msg, ...]}, so unwrap
// both shapes and fall back to whatever came back.
export const describeError = (error) => {
    const data = error?.data ?? error;

    if (!data) return error?.error || 'Something went wrong. Please try again.';
    if (typeof data === 'string') return data;
    if (data.detail) return String(data.detail);

    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (first && typeof first === 'object') return describeError({ data: first });
    if (first) return String(first);

    return 'Something went wrong. Please try again.';
};
