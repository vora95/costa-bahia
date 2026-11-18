// Character portraits, drawn procedurally on small canvases: distinct skin, hair
// (style + colour), shirt and one accessory per character, so dialog reads as a
// person speaking instead of anonymous mission text.
import { CHARACTERS } from './config.js';

const SIZE = 96;

function drawFace(ctx, ch, t) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Backdrop: warm dusk gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, '#ff9a5c'); bg.addColorStop(1, '#7a3a6e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2; const cy = SIZE / 2 + 8;
  // Shoulders / shirt.
  ctx.fillStyle = ch.shirt;
  ctx.beginPath();
  ctx.moveTo(cx - 34, SIZE); ctx.quadraticCurveTo(cx - 30, cy + 22, cx, cy + 20);
  ctx.quadraticCurveTo(cx + 30, cy + 22, cx + 34, SIZE); ctx.closePath(); ctx.fill();
  // Neck.
  ctx.fillStyle = ch.skin; ctx.fillRect(cx - 7, cy + 8, 14, 14);
  // Head.
  ctx.beginPath(); ctx.ellipse(cx, cy, 21, 24, 0, 0, Math.PI * 2); ctx.fill();
  // Hair by style.
  ctx.fillStyle = ch.hair;
  if (ch.hairStyle === 'long') {
    ctx.beginPath(); ctx.ellipse(cx, cy - 8, 23, 20, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 23, cy - 8, 7, 34); ctx.fillRect(cx + 16, cy - 8, 7, 34);
  } else if (ch.hairStyle === 'bun') {
    ctx.beginPath(); ctx.ellipse(cx, cy - 10, 22, 15, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 26, 8, 0, Math.PI * 2); ctx.fill();
  } else if (ch.hairStyle === 'bunGrey') {
    ctx.beginPath(); ctx.ellipse(cx, cy - 10, 22, 14, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 25, 7, 0, Math.PI * 2); ctx.fill();
  } else if (ch.hairStyle === 'bob') {
    ctx.beginPath(); ctx.ellipse(cx, cy - 6, 23, 19, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 23, cy - 6, 6, 22); ctx.fillRect(cx + 17, cy - 6, 6, 22);
  } else if (ch.hairStyle === 'cap') {
    ctx.beginPath(); ctx.ellipse(cx, cy - 12, 22, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7f8a'; ctx.fillRect(cx - 24, cy - 14, 48, 7);
  } else { // buzz
    ctx.beginPath(); ctx.ellipse(cx, cy - 12, 21, 10, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
  // Eyes (blink: closed every ~3s for a blink frame).
  const blink = (t % 3) > 2.85;
  ctx.fillStyle = '#1c1410';
  if (blink) {
    ctx.fillRect(cx - 11, cy - 2, 7, 1.5); ctx.fillRect(cx + 4, cy - 2, 7, 1.5);
  } else {
    ctx.beginPath(); ctx.arc(cx - 8, cy - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 8, cy - 2, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // Brows, nose, mouth.
  ctx.strokeStyle = ch.hair; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 12, cy - 8); ctx.lineTo(cx - 4, cy - 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 4, cy - 9); ctx.lineTo(cx + 12, cy - 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx - 2, cy + 8); ctx.stroke();
  ctx.strokeStyle = '#7a2e2e'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(cx - 6, cy + 13); ctx.quadraticCurveTo(cx, cy + 16, cx + 6, cy + 13); ctx.stroke();
  // Accessory.
  if (ch.accent === 'gold hoops') {
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx - 21, cy + 4, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 21, cy + 4, 4, 0, Math.PI * 2); ctx.stroke();
  } else if (ch.accent === 'scar') {
    ctx.strokeStyle = '#c98d64'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + 12, cy - 12); ctx.lineTo(cx + 8, cy + 2); ctx.stroke();
  } else if (ch.accent === 'sunglasses') {
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(cx - 13, cy - 6, 12, 7); ctx.fillRect(cx + 1, cy - 6, 12, 7);
    ctx.fillRect(cx - 1, cy - 4, 2, 2);
  } else if (ch.accent === 'headset') {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy - 4, 23, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(cx + 18, cy - 2, 5, 8);
  }
  // Frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
}

const cache = new Map();

export function portraitCanvas(charId, t) {
  const ch = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
  const key = ch.id + ':' + Math.floor(t * 4);
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = SIZE; cv.height = SIZE;
  drawFace(cv.getContext('2d'), ch, t);
  cache.set(key, cv);
  if (cache.size > 64) cache.clear();
  return cv;
}

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
