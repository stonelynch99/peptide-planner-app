import type {AccountState, AuthPort, SessionIdentity} from './contracts';
export const CODE_MESSAGE = 'If this address has an active invitation, a six-digit code will arrive. Wait 60 seconds before requesting another.';
export class AuthController {
  private generation = 0;
  private stopped = false;
  private unsubscribe?: () => void;
  constructor(private port: AuthPort, private publish: (state: AccountState) => void) {}
  private async assess(session: SessionIdentity) {
    const generation = ++this.generation;
    if (this.stopped) return;
    this.publish({status:'loading'});
    try {
      const allowed = session ? await this.port.eligible() : false;
      if (!this.stopped && generation === this.generation) this.publish(session ? {status:allowed?'eligible':'denied',userId:session.userId} : {status:'signedOut'});
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
    try { await this.port.requestCode(email.trim().toLowerCase()); } catch { /* Same message for unknown, blocked and delivery failures. */ }
    return CODE_MESSAGE;
  }
  async verify(email: string, code: string) {
    if (!/^\d{6}$/.test(code)) return 'Enter the six-digit code.';
    const generation = this.generation;
    try { const session = await this.port.verifyCode(email.trim().toLowerCase(),code); if (!session) return 'The code is incorrect or expired. Request a new code.'; if (!this.stopped && generation === this.generation) await this.assess(session); return ''; }
    catch { return 'The code is incorrect or expired. Request a new code.'; }
  }
  async signOut() {
    ++this.generation;
    this.publish({status:'loading'});
    try { await this.port.signOut(); if (!this.stopped) this.publish({status:'signedOut'}); return ''; }
    catch { if (!this.stopped) this.publish({status:'error'}); return 'Sign-out could not finish. Please retry.'; }
  }
  async refresh() { try { await this.assess(await this.port.restore()); } catch { if (!this.stopped) this.publish({status:'error'}); } }
  stop() { this.stopped = true; ++this.generation; this.unsubscribe?.(); }
}
