export function recoveryError(error, resetting) {
    const code = error?.data?.code;
    const message = typeof error?.data?.error === 'string' ? error.data.error : '';
    if (code === 'PASSWORD_MISMATCH' || /passwords do not match/i.test(message)) return { field: 'confirm-password', text: 'The passwords don’t match. Enter the same password in both fields.' };
    if (code === 'PASSWORD_TOO_SHORT' || /shorter than|at least 6/i.test(message)) return { field: 'new-password', text: 'Choose a password with at least 6 characters.' };
    if (code === 'RESET_LINK_INVALID' || /token is invalid|expired/i.test(message)) return { newLink: true, text: 'This reset link has expired or is no longer valid. Request a new link to reset your password.' };
    if (error?.status === 429) return { text: 'You’ve tried too many times. Please wait a few minutes before trying again.' };
    if (error?.name === 'NetworkError' || error?.name === 'AbortError') return { text: 'We couldn’t connect. Check your internet connection and try again.' };
    if (error?.status >= 500) return { text: resetting ? 'We couldn’t update your password right now. Please try again shortly. If you already submitted it, try logging in with your new password first.' : 'We couldn’t send the reset email right now. Please try again shortly or contact support.' };
    return { text: resetting ? 'We couldn’t reset your password. Check both fields and try again, or request a new reset link.' : 'We couldn’t request a reset link. Check your email address and try again.' };
}
