/*
  Infinite Portfolio Gallery — hosted distribution file
  © Kill Vanilla Studio — killvanillastudio.com

  Injects its own <style> tag (no separate Header CSS needed) and runs
  the full drag/scale/greyscale/loop/scroll-cue effect. Attribution is
  baked in below and travels with the effect — removing it means
  removing this whole script tag, which also removes the gallery.

  Usage — Footer Code Injection:
    <script src="https://cdn.jsdelivr.net/gh/YOUR-USERNAME/YOUR-REPO@main/infinite-gallery.js"></script>

  Usage — Code Block, wherever the gallery should appear:
    <div
      id="ip-gallery"
      data-source="/blog"
      data-limit="0"
      data-hint="text"
      data-text-right="Scroll right →"
      data-text-left="← Scroll left"
      data-text-center="Move up or down"
      data-scroll-cue="true">
    </div>

  All visual settings (image size, gap, scale, greyscale, opacity fade,
  section height, hint font/colour/border, scroll-cue size/colour/safezone,
  vertical offset) are set as CSS custom properties on #ip-gallery — see
  the style block below for the full list and defaults.
*/
(function(){

  // ---- inject styles once ----
  const STYLE_ID = 'ip-gallery-styles';
  if(!document.getElementById(STYLE_ID)){
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#ip-gallery{
  position: relative !important;
  overflow: hidden !important;
  width: 100% !important;
  height: var(--ip-height, 420px) !important;
  padding: 20px 0 !important;
  cursor: none;
  touch-action: none !important;
  overscroll-behavior: contain;
  margin-top: var(--ip-offset-top, 0px) !important;
}
@media (max-width: 767px){
  #ip-gallery{
    height: var(--ip-height-mobile, 70vh) !important;
  }
  #ip-gallery img{
    width: var(--ip-img-w-mobile, 160px) !important;
    height: var(--ip-img-h-mobile, 240px) !important;
  }
}
#ip-gallery .ip-track{
  position: absolute !important;
  top: 50% !important;
  left: 0 !important;
  transform: translateY(-50%);
  display: flex !important;
  align-items: center !important;
  gap: var(--ip-gap, 20px) !important;
  will-change: transform;
}
#ip-gallery .ip-status{
  font-size: 13px;
  opacity: 0.7;
}
#ip-gallery .ip-item{
  flex: 0 0 auto !important;
  will-change: transform, filter, opacity;
}
#ip-gallery img{
  width: var(--ip-img-w, 260px) !important;
  height: var(--ip-img-h, 380px) !important;
  object-fit: cover !important;
  display: block !important;
  -webkit-user-drag: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  pointer-events: none !important;
}
#ip-gallery .ip-hint{
  position: fixed;
  top: 0; left: 0;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}
#ip-gallery .ip-hint.is-visible{ opacity: 1; }
#ip-gallery .ip-hint span{
  font-family: var(--ip-hint-font, inherit);
  font-size: var(--ip-hint-size, 11px);
  letter-spacing: 0.05em;
  text-transform: var(--ip-hint-case, uppercase);
  background: var(--ip-hint-bg, rgba(0,0,0,0.75));
  color: var(--ip-hint-color, #fff);
  padding: 4px 8px;
  border-radius: 20px;
  border: var(--ip-hint-border-width, 1px) solid var(--ip-hint-border-color, transparent);
  white-space: nowrap;
}
#ip-gallery .ip-hint svg{
  width: var(--ip-hint-arrow-size, 22px);
  height: var(--ip-hint-arrow-size, 22px);
  fill: var(--ip-hint-color, #fff);
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
}
#ip-gallery .ip-scroll-arrow{
  position: absolute;
  bottom: var(--ip-scroll-cue-offset, 16px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: auto;
  cursor: pointer;
  width: var(--ip-scroll-cue-size, 28px);
  height: var(--ip-scroll-cue-size, 28px);
  animation: ip-bounce 1.8s ease-in-out infinite;
}
#ip-gallery .ip-scroll-arrow svg{
  width: 100%;
  height: 100%;
  fill: var(--ip-scroll-cue-color, #ffffff);
}
@keyframes ip-bounce{
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(6px); }
}
    `;
    document.head.appendChild(style);
  }

  // ---- gallery logic ----
  const wrap = document.getElementById('ip-gallery');
  if(wrap){
    const cs = getComputedStyle(wrap);
    const num = (name, fallback) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return isNaN(v) ? fallback : v;
    };

    const IMG_W = num('--ip-img-w', 260);
    const GAP = num('--ip-gap', 20);
    const ITEM_STEP = IMG_W + GAP;
    const MIN_SCALE = num('--ip-min-scale', 0.75);
    const MAX_SCALE = num('--ip-max-scale', 1.35);
    const GRAYSCALE_MAX = num('--ip-grayscale-intensity', 100);
    const FALLOFF = num('--ip-falloff', 420);
    const OPACITY_FADE = num('--ip-opacity-fade', 0.5);
    const SAFE_ZONE = num('--ip-scroll-cue-safezone', 70);

    const source = wrap.dataset.source || '/blog';
    const hintStyle = wrap.dataset.hint || 'text';
    const limit = parseInt(wrap.dataset.limit, 10) || 0;
    const showScrollCue = wrap.dataset.scrollCue !== 'false';

    const TEXT_RIGHT = wrap.dataset.textRight || 'Scroll right →';
    const TEXT_LEFT = wrap.dataset.textLeft || '← Scroll left';
    const TEXT_CENTER = wrap.dataset.textCenter || 'Move up or down';

    wrap.innerHTML = '<div class="ip-status">Loading images...</div>';

    let images = [], itemEls = [], track, offset = 0;
    const REPEATS = 6;
    let currentY = null, rafId = null;
    const MAX_SPEED = 10, DEADZONE = 30;
    let hint, hintInner, hasInteracted = false;

    const ARROW_RIGHT = '<svg viewBox="0 0 24 24"><path d="M4 11v2h12l-5.5 5.5 1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5 16 11H4z"/></svg>';
    const ARROW_LEFT = '<svg viewBox="0 0 24 24"><path d="M20 11H8l5.5-5.5L12.08 4.08 4.16 12l7.92 7.92L13.5 18.5 8 13h12v-2z"/></svg>';
    const ARROW_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 16.5l-7-7 1.41-1.41L12 13.67l5.59-5.58L19 9.5l-7 7z"/></svg>';

    fetch(source + '?format=json')
      .then(r => r.json())
      .then(data => {
        let urls = (data.items || []).map(i => i.assetUrl).filter(Boolean);
        if(limit > 0) urls = urls.slice(0, limit);
        images = urls;
        if(!images.length){
          wrap.innerHTML = '<div class="ip-status">No images found.</div>';
          return;
        }

        wrap.innerHTML = '';
        track = document.createElement('div');
        track.className = 'ip-track';
        wrap.appendChild(track);

        const list = [];
        for(let i = 0; i < REPEATS; i++) list.push(...images);
        list.forEach(src => {
          const item = document.createElement('div');
          item.className = 'ip-item';
          const img = document.createElement('img');
          img.src = src;
          img.draggable = false;
          item.appendChild(img);
          track.appendChild(item);
          itemEls.push(item);
        });

        hint = document.createElement('div');
        hint.className = 'ip-hint';
        hintInner = document.createElement(hintStyle === 'arrows' ? 'div' : 'span');
        hint.appendChild(hintInner);
        wrap.appendChild(hint);

        if(showScrollCue){
          const arrow = document.createElement('div');
          arrow.className = 'ip-scroll-arrow';
          arrow.innerHTML = ARROW_DOWN;
          arrow.addEventListener('click', () => {
            const rect = wrap.getBoundingClientRect();
            window.scrollTo({ top: window.scrollY + rect.bottom, behavior: 'smooth' });
          });
          wrap.appendChild(arrow);
        }

        offset = -(itemEls.length / 2) * ITEM_STEP;
        applyTransform();
        updateScales();
        bindDrag();
        rafId = requestAnimationFrame(tick);
        introNudge();
      })
      .catch(e => {
        console.log('[ip-gallery] fetch failed:', e);
        wrap.innerHTML = '<div class="ip-status">Fetch failed — check console.</div>';
      });

    function applyTransform(){
      track.style.transform = `translateY(-50%) translateX(${offset}px)`;
    }
    function loopCheck(){
      const cycleWidth = ITEM_STEP * images.length;
      while (offset > -cycleWidth * 2) offset -= cycleWidth;
      while (offset < -cycleWidth * (REPEATS - 2)) offset += cycleWidth;
    }
    function updateScales(){
      const wrapRect = wrap.getBoundingClientRect();
      const center = wrapRect.left + wrapRect.width / 2;
      itemEls.forEach(item => {
        const r = item.getBoundingClientRect();
        const dist = Math.abs((r.left + r.width / 2) - center);
        const t = Math.min(1, dist / FALLOFF);
        item.style.transform = `scale(${MAX_SCALE - t * (MAX_SCALE - MIN_SCALE)})`;
        item.style.filter = `grayscale(${t * GRAYSCALE_MAX}%)`;
        item.style.opacity = 1 - t * OPACITY_FADE;
        item.style.zIndex = Math.round((1 - t) * 100);
      });
    }
    function introNudge(){
      const start = performance.now(), duration = 1400;
      function step(now){
        if(hasInteracted) return;
        const t = (now - start) / duration;
        if(t >= 1) return;
        const wobble = Math.sin(t * Math.PI * 2) * 18;
        track.style.transform = `translateY(-50%) translateX(${offset + wobble}px)`;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    function setHint(direction){
      if(!hintInner) return;
      if(hintStyle === 'arrows'){
        hintInner.innerHTML = direction === 'right' ? ARROW_RIGHT : direction === 'left' ? ARROW_LEFT : '';
      } else {
        hintInner.textContent = direction === 'right' ? TEXT_RIGHT : direction === 'left' ? TEXT_LEFT : TEXT_CENTER;
      }
    }
    function tick(){
      if(currentY !== null){
        const wrapRect = wrap.getBoundingClientRect();
        const inSafeZone = showScrollCue && currentY > (wrapRect.bottom - SAFE_ZONE);

        if(inSafeZone){
          if(hint) hint.classList.remove('is-visible');
        } else {
          const centerY = wrapRect.top + wrapRect.height / 2;
          const rawDelta = currentY - centerY;

          if(Math.abs(rawDelta) > DEADZONE){
            const beyond = rawDelta - Math.sign(rawDelta) * DEADZONE;
            const halfHeight = wrapRect.height / 2 - DEADZONE;
            const speed = Math.max(-1, Math.min(1, beyond / halfHeight)) * MAX_SPEED;

            offset += speed;
            loopCheck();
            applyTransform();
            if(hint) hint.classList.add('is-visible');
            setHint(speed > 0 ? 'right' : 'left');
          } else {
            if(hint) hint.classList.add('is-visible');
            setHint('center');
          }
        }
      }

      updateScales();
      rafId = requestAnimationFrame(tick);
    }
    function bindDrag(){
      wrap.addEventListener('pointerenter', (e) => {
        currentY = e.clientY;
      });
      wrap.addEventListener('pointerdown', (e) => {
        currentY = e.clientY;
      });
      wrap.addEventListener('pointermove', (e) => {
        e.preventDefault();
        currentY = e.clientY;
        hasInteracted = true;
        if(hint){ hint.style.left = e.clientX + 'px'; hint.style.top = e.clientY + 'px'; }
      }, { passive: false });
      wrap.addEventListener('pointerleave', () => {
        currentY = null;
        if(hint) hint.classList.remove('is-visible');
      });
      wrap.addEventListener('pointerup', () => {
        currentY = null;
        if(hint) hint.classList.remove('is-visible');
      });
    }
  }

  // ---- attribution, injected unconditionally on every load ----
  // Not gated behind a marker or any data-attribute: this runs whenever
  // this file loads at all, regardless of whether #ip-gallery is present
  // on the page. Removing this credit means removing this whole script
  // tag, which also removes the gallery effect.
  const CREDIT_ID = 'kvs-credit';
  if (!document.getElementById(CREDIT_ID)) {
    const credit = document.createElement('div');
    credit.id = CREDIT_ID;
    credit.style.cssText = 'text-align: center; font-size: 12px; opacity: 0.7; padding: 20px 0;';
    credit.innerHTML =
      'WEBSITE DESIGNED BY ' +
      '<a href="https://www.killvanillastudio.com" target="_blank" ' +
      'style="text-decoration: none; color: inherit;">KILLVANILLASTUDIO.COM</a>';

    function injectCredit(){
      if (document.getElementById(CREDIT_ID)) return;
      const footer = document.querySelector('footer') || document.body;
      footer.appendChild(credit);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectCredit);
    } else {
      injectCredit();
    }
  }

})();
