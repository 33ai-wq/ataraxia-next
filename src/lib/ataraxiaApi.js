// Thin fetch client for the Ataraxia backend (/api/*, proxied by nginx to :3110).
const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...body };
};

const post = (path, payload) =>
  fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload || {}),
  }).then(json);

export const getConfig = () => fetch('/api/config').then(json);
export const getCatalog = () => fetch('/api/catalog').then(json);
export const getSession = () => fetch('/api/session', { credentials: 'same-origin' }).then(json);
export const getAccess = () => fetch('/api/access', { credentials: 'same-origin' }).then(json);
export const getNonce = (address) =>
  fetch(`/api/nonce${address ? `?address=${encodeURIComponent(address)}` : ''}`).then(json);
export const verifySignature = (body) => post('/api/auth/verify', body);
export const logout = () => fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).then(json);
export const openInvoice = (videoId) => post('/api/pay/invoice', { videoId });
export const verifyPayment = (invoiceId, txHash) => post('/api/pay/verify', { invoiceId, txHash });
export const mediaUrl = (videoId) => `/api/media/${encodeURIComponent(videoId)}`;
export const getRewards = () => fetch('/api/rewards', { credentials: 'same-origin' }).then(json);
export const getRewardsPublic = () => fetch('/api/rewards/public').then(json);
