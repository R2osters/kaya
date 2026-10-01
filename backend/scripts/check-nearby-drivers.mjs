/**
 * Proves the live-location pipeline end to end, without a device:
 * a driver's socket emit -> the gateway's throttled write to users.location
 * -> the client's PostGIS proximity query.
 *
 * Scratch script, kept out of the repo: the app itself is the real test.
 */
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3000';
const API = `${BASE}/api/v1`;
const MOCK = 'kaya-mock-verifier:';

const OSU = { lat: 5.6037, lng: -0.187 };

async function signIn(phone) {
  const res = await fetch(`${API}/auth/login/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, firebaseIdToken: `${MOCK}${phone}` }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login ${phone} -> ${res.status} ${JSON.stringify(body)}`);
  return body.accessToken;
}

async function nearby(token, point) {
  const url = `${API}/drivers/nearby?lat=${point.lat}&lng=${point.lng}&radiusKm=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const driverToken = await signIn('+233202222222');
const clientToken = await signIn('+233209998887');

// Online is a precondition for appearing at all.
await fetch(`${API}/driver/status`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
  body: JSON.stringify({ online: true }),
});

console.log('before:', JSON.stringify(await nearby(clientToken, OSU)));

const socket = io(BASE, { transports: ['websocket'], auth: { token: driverToken } });
await new Promise((resolve, reject) => {
  socket.on('connect', resolve);
  socket.on('connect_error', reject);
});
socket.emit('location:update', OSU);
console.log('emitted a position at Osu');

await sleep(2500);
console.log('after: ', JSON.stringify(await nearby(clientToken, OSU)));

// And the freshness/geography filters actually filter.
console.log('far:   ', JSON.stringify(await nearby(clientToken, { lat: 6.13, lng: 1.22 })));

socket.disconnect();
