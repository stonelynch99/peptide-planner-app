import type {AccountState, AuthPort, SessionIdentity} from './contracts';
export const CODE_MESSAGE = 'If this address has an active invitation, a six-digit code will arrive. Wait 60 seconds before requesting another.';
export class AuthController {
  private generation = 0;
  private stopped = false;
  private assessedUserId: string | null = null;
  private unsubscribe?: () => void;
  constructor(private port: AuthPort, private publish: (state: AccountState) => void) {}
  private async assess(session: SessionIdentity) {
    const generation = ++this.generation;
    if (this.stopped) return;
    // Same-account reauthentication must not unmount password forms or erase their result.
    if (!session || session.userId !== this.assessedUserId) this.publish({status:'loading'});
    try {
      const allowed = session ? await this.port.eligible() : false;
      if (!this.stopped && generation === this.generation) { this.assessedUserId=allowed&&session?session.userId:null; this.publish(session ? {status:allowed?'eligible':'denied',...session} : {status:'signedOut'}); }
    } catch { if (!this.stopped && generation === this.generation) this.publish({status:'error'}); }
  }
  async start() {
    this.stopped = false;
    this.unsubscribe = this.port.subscribe(session=>{ void this.assess(session); });
    const generation = this.generation;
    try { const session = await this.port.restore(); if (!this.stopped && generation === this.generation) await this.assess(session); }
    catch { if (!this.stopped && generation === this.generation) this.publish({status:'error'}); }
  }
  async request(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) return 'Enter a valid email address.';
    try { await this.port.requestCode(email.trim().toLowerCase()); } catch (error) { if((error as {code?:string})?.code==='DELIVERY_UNAVAILABLE')return 'Code delivery could not be confirmed. Wait 60 seconds and retry.'; /* Unknown and ineligible addresses receive the same response. */ }
    return CODE_MESSAGE;
  }
  async verify(email: string, code: string) {
    if (!/^\d{6}$/.test(code)) return 'Enter the six-digit code.';
    const generation = this.generation;
    try { const session = await this.port.verifyCode(email.trim().toLowerCase(),code); if (!session) return 'The code is incorrect or expired. Request a new code.'; if (!this.stopped && generation === this.generation) await this.assess(session); return ''; }
    catch { return 'The code is incorrect or expired. Request a new code.'; }
  }
  async passwordSignIn(email: string, password: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) return 'Enter your email and password.';
    try { const session=await this.port.passwordSignIn!(email.trim().toLowerCase(),password); if(!session)throw Error(); await this.assess(session); return ''; }
    catch { return 'Sign-in could not be completed. Check your details or use account recovery.'; }
  }
  async recover(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length>254) return 'Enter a valid email address.';
    try { await this.port.requestRecovery!(email.trim().toLowerCase()); } catch { /* Same response for all addresses, including throttled requests. */ }
    return 'If this address has an account, a secure recovery email will arrive. Open it in this same browser. Wait 60 seconds before requesting another.';
  }
  async savePassword(password: string, confirmation: string) {
    if(password.length<6 || password.length>128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))return 'Use 6–128 characters, including at least one letter and one number.';
    if(password!==confirmation)return 'The passwords do not match.';
    try { await this.port.updatePassword!(password); await this.refresh(); return 'Password saved. You can now sign in with your email and password.'; }
    catch { return 'Password was not changed. Verify your account with a fresh email code or recovery link, then retry. Use a strong, unique password.'; }
  }
  async saveName(name:string) {
    if(!name.trim() || name.trim().length>80)return 'Enter a display name of 1–80 characters.';
    try { await this.port.updateDisplayName!(name.trim()); await this.refresh(); return 'Display name saved.'; }
    catch { return 'Display name could not be saved. Please retry.'; }
  }
  async signOut() {
    this.assessedUserId=null;
    ++this.generation;
    this.publish({status:'loading'});
    try { await this.port.signOut(); if (!this.stopped) this.publish({status:'signedOut'}); return ''; }
    catch { if (!this.stopped) this.publish({status:'error'}); return 'Sign-out could not finish. Please retry.'; }
  }
  async refresh() { try { await this.assess(await this.port.restore()); } catch { if (!this.stopped) this.publish({status:'error'}); } }
  stop() { this.stopped = true; ++this.generation; this.unsubscribe?.(); }
}
