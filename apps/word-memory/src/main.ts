/**
 * 单词猫 — 入口
 */

import './ui/styles.css';
import { mount } from './ui/events';

mount();

// 注册 Service Worker，实现离线可用
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || './';
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((reg) => {
        console.info('[单词猫] 离线缓存已就绪', reg.scope);
      })
      .catch((err) => {
        console.warn('[单词猫] Service Worker 注册失败', err);
      });
  });
}

// 阻止 iOS 双指缩放与双击缩放，让手感更接近原生 App
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  },
  { passive: false },
);

// 禁止下拉回弹导致整页滚动（页面本身在 .screen 内滚动）
document.body.addEventListener('touchmove', (e) => {
  const el = e.target as HTMLElement;
  // 允许在可滚动容器内滚动
  if (el.closest('.book-tabs, .heat, .options, .unit-list')) return;
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
