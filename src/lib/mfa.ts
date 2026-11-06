// Authenticator sign-in (MFA) is built but held back. Nobody can turn it on
// unless AUTH_MFA_ENABLED=1 is set where the app runs. Accounts that already
// have it keep working and can still switch it off.
export const mfaAvailable = () => process.env.AUTH_MFA_ENABLED === "1";
