export type CloudConfig = { status: 'unconfigured' | 'invalid'; message: string } | { status: 'ready'; url: string; key: string };
export function validateCloudConfig(url?: string, key?: string): CloudConfig {
  if (!url && !key) return {status:'unconfigured',message:'Cloud account configuration is unavailable. Access is closed until the administrator completes setup.'};
  const invalid: CloudConfig = {status:'invalid',message:'Cloud account configuration needs administrator attention. Your local data is unchanged.'};
  if (!url || !key || /YOUR_|PLACEHOLDER/i.test(url+key) || key.startsWith('sb_secret_')) return invalid;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return invalid;
    let safe = /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key);
    if (!safe && key.split('.').length === 3) {
      const encoded = key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')));
      safe = claims.role === 'anon';
    }
    return safe ? {status:'ready',url:parsed.origin,key} : invalid;
  } catch { return invalid; }
}
