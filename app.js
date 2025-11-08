/* app.js - Vanilla JS for interactivity: lightbox, video modal, lazy-load, scroll animations,
   passphrase easter-egg, keyboard accessibility, and download button note.
*/

/* =========================
   Configuration / placeholders
   ========================= */
// Default passphrase: change to your secret phrase/date (e.g., "2025-12-25")
// This value should match the passphrase you want. You can also fetch from server/env.
const SECRET_PASSPHRASE = "2025-12-25";

/* =============== Utilities =============== */
function qs(sel, ctx=document) { return ctx.querySelector(sel); }
function qsa(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }

function trapFocus(modal) {
  // Basic focus trap for accessibility
  const focusable = modal.querySelectorAll('a,button,input,textarea,[tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  function onKey(e){
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === 'Escape') closeModal(modal);
  }
  modal.__onKey = onKey;
  modal.addEventListener('keydown', onKey);
  return () => modal.removeEventListener('keydown', onKey);
}

/* =============== Modal helpers =============== */
function openModal(modal) {
  modal.setAttribute('aria-hidden', 'false');
  const panel = modal.querySelector('.modal__panel');
  panel.focus();
  modal.__restore = trapFocus(modal);
}
function closeModal(modal) {
  modal.setAttribute('aria-hidden', 'true');
  if (modal.__restore) modal.__restore();
}

/* Close on overlay or [data-close] clicks */
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) {
    const mod = e.target.closest('.modal');
    if (mod) closeModal(mod);
  }
});

/* ======= Media Modal (Lightbox & Video) ======= */
const mediaModal = qs('#mediaModal');
const mediaContent = qs('#mediaContent');
const modalPrev = qs('#modalPrev');
const modalNext = qs('#modalNext');

let galleryItems = []; // array of {type:'image'|'video', src:..., thumb:...}
let currentIndex = 0;

function renderMedia(index) {
  currentIndex = index;
  const item = galleryItems[index];
  mediaContent.innerHTML = '';
  if (!item) return;
  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.full || item.src;
    img.alt = item.alt || '';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.loading = 'eager';
    mediaContent.appendChild(img);
  } else if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.maxWidth = '100%';
    mediaContent.appendChild(video);
    // try to play (some mobile browsers block autoplay unless muted)
    video.muted = true;
    video.play().catch(()=>{ video.muted = false; });
  }
}

modalPrev.addEventListener('click', () => {
  renderMedia((currentIndex - 1 + galleryItems.length) % galleryItems.length);
});
modalNext.addEventListener('click', () => {
  renderMedia((currentIndex + 1) % galleryItems.length);
});

/* Build galleryItems from gallery grid and timeline media thumbs */
function buildGalleryIndex() {
  galleryItems = [];
  // Gallery images
  qsa('#galleryGrid img').forEach(img => {
    galleryItems.push({
      type: 'image',
      src: img.src,
      full: img.dataset.full || img.src,
      alt: img.alt || ''
    });
  });
  // Timeline buttons (image/video)
  qsa('.media-thumb').forEach(btn => {
    const type = btn.dataset.type || 'image';
    galleryItems.push({ type, src: btn.dataset.src, alt: btn.dataset.alt || '' });
  });
}
buildGalleryIndex();

/* Open when clicking gallery image */
qsa('#galleryGrid img').forEach((img, idx) => {
  img.addEventListener('click', () => {
    // find index among galleryItems (images first)
    const itemIndex = idx; // as built above images come first
    renderMedia(itemIndex);
    openModal(mediaModal);
  });
  img.addEventListener('keydown', (e) => { if (e.key === 'Enter') img.click(); });
});

/* Timeline media thumbs */
qsa('.media-thumb').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // timeline items are appended after gallery images in our galleryItems
    const idx = galleryItems.findIndex(x => x.src === btn.dataset.src);
    if (idx >= 0) {
      renderMedia(idx);
      openModal(mediaModal);
    } else {
      // fallback: directly show single media
      mediaContent.innerHTML = '';
      if (btn.dataset.type === 'video') {
        const v = document.createElement('video');
        v.src = btn.dataset.src; v.controls = true; v.autoplay = true; v.playsInline = true;
        mediaContent.appendChild(v);
      } else {
        const i = document.createElement('img'); i.src = btn.dataset.src; i.alt = '';
        mediaContent.appendChild(i);
      }
      openModal(mediaModal);
    }
  });
});

/* Keyboard shortcuts for modal */
document.addEventListener('keydown', (e) => {
  if (mediaModal.getAttribute('aria-hidden') === 'false') {
    if (e.key === 'ArrowLeft') modalPrev.click();
    if (e.key === 'ArrowRight') modalNext.click();
  }
});

/* ====== Passphrase Easter Egg ====== */
const secretBtn = qs('#secret-heart');
const passModal = qs('#passModal');
const passInput = qs('#passInput');
const passSubmit = qs('#passSubmit');
const passError = qs('#passError');
const secretReveal = qs('#secretReveal');

secretBtn.addEventListener('click', () => {
  passInput.value = '';
  passError.textContent = '';
  secretReveal.setAttribute('aria-hidden','true');
  openModal(passModal);
  passInput.focus();
});

passSubmit.addEventListener('click', checkPass);
passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkPass(); });

function checkPass(){
  const val = passInput.value.trim();
  if (!val) {
    passError.textContent = 'Please enter the passphrase.';
    return;
  }
  if (val === SECRET_PASSPHRASE) {
    passError.textContent = '';
    secretReveal.setAttribute('aria-hidden','false');
    // visually show the reveal and set focus to it
    secretReveal.setAttribute('data-visible','true');
    secretReveal.focus();
  } else {
    passError.textContent = 'Incorrect passphrase. Try again.';
  }
}

/* ===== Lazy-loading improvements (IntersectionObserver fallback) ===== */
function lazyLoadInit(){
  const lazyImgs = qsa('img[loading="lazy"]');
  if ('loading' in HTMLImageElement.prototype) {
    // native lazy loading is available - nothing else to do
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(ent => {
      if (ent.isIntersecting) {
        const img = ent.target;
        // If using data-src pattern replace here; we use src directly for placeholders.
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
        obs.unobserve(img);
      }
    });
  }, {rootMargin: '200px'});
  lazyImgs.forEach(img => io.observe(img));
}
lazyLoadInit();

/* ===== Scroll animations (fadeUp) ===== */
function scrollAnimateInit(){
  const items = qsa('[data-animate]');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('is-visible');
        obs.unobserve(en.target);
      }
    });
  }, {rootMargin: '0px 0px -10% 0px', threshold: 0.05});
  qsa('section').forEach(sec => {
    sec.setAttribute('data-animate','true');
    observer.observe(sec);
  });
}
scrollAnimateInit();

/* ===== Download fallback message (explain how to replace zip) ===== */
const downloadBtn = qs('#download-photos');
if (downloadBtn) {
  downloadBtn.addEventListener('click', (e) => {
    // if the zip doesn't exist on GH Pages, the link will 404 — user can replace.
    // We keep the default anchor behavior; could also fetch a real zip via fetch.
    // To improve UX: on slow networks we show a small temporary notice (non-blocking).
    const notice = document.createElement('div');
    notice.textContent = 'If the download does not start, replace assets/photos.zip with your archive and commit to the site.';
    notice.style.position = 'fixed';
    notice.style.bottom = '14px';
    notice.style.left = '14px';
    notice.style.padding = '8px 12px';
    notice.style.background = 'white';
    notice.style.borderRadius = '10px';
    notice.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
    document.body.appendChild(notice);
    setTimeout(()=>notice.remove(), 4000);
  });
}

/* ===== Accessibility: ensure modals close on Escape and capture focus when open ===== */
document.querySelectorAll('.modal').forEach(mod => {
  mod.addEventListener('click', (e) => {
    if (e.target === mod.querySelector('.modal__overlay')) {
      closeModal(mod);
    }
  });
});

/* ===== Small enhancements: update gallery index when DOM changes (helper) ===== */
const galleryObserver = new MutationObserver(() => { buildGalleryIndex(); });
const galleryGrid = qs('#galleryGrid');
if (galleryGrid) galleryObserver.observe(galleryGrid, {childList:true, subtree:true});

/* ===== End of app.js ===== */
