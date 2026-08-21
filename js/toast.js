/**
 * Toast system – shared across all pages
 */
(function(){
    const stack = document.getElementById('toast-stack');
    if (!stack) {
      const div = document.createElement('div');
      div.id = 'toast-stack';
      div.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:.5rem;pointer-events:none;max-width:90vw;';
      document.body.appendChild(div);
    }
  
    window.showToast = function(msg, opts = {}) {
      const stack = document.getElementById('toast-stack');
      const el = document.createElement('div');
      const isError = opts.error || false;
      el.className = 'toast';
      el.textContent = msg;
      el.style.cssText = `
        font-family:'IBM Plex Mono',monospace;
        font-size:.55rem;
        letter-spacing:.1em;
        color:#efe8d9;
        background:rgba(11,10,9,.94);
        border:1px solid #3c352d;
        border-left:2px solid ${isError ? '#6e0f17' : '#ff3346'};
        padding:.6rem 1rem;
        opacity:0;
        transform:translateY(10px);
        transition:opacity .3s ease, transform .3s ease;
        white-space:nowrap;
        pointer-events:none;
        backdrop-filter:blur(8px);
        border-radius:2px;
        max-width:100%;
      `;
      stack.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      const duration = opts.duration || 2800;
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => el.remove(), 350);
      }, duration);
    };
  })();