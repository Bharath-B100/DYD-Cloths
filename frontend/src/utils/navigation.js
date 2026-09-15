export function safeReturnPath(value, fallback = '/profile') {
    return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/^\/(login|register|forgot-password|reset-password)(\/|\?|$)/.test(value)
        ? value : fallback;
}
