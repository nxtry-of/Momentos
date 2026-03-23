// Banner de instalación PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">🌙</span>
      <div class="banner-text">
        <strong>Instala Momento</strong>
        <span>Añade a tu pantalla de inicio</span>
      </div>
      <button class="btn-install">Instalar</button>
      <button class="btn-close" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  // Estilos
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #12121a;
    border: 1px solid #1e1e2e;
    border-radius: 16px;
    padding: 15px 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 15px;
    animation: slideUp 0.3s ease;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .banner-content {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .banner-icon {
      font-size: 2rem;
    }
    .banner-text {
      display: flex;
      flex-direction: column;
      color: #e0e0e0;
    }
    .banner-text strong {
      font-size: 1rem;
    }
    .banner-text span {
      font-size: 0.85rem;
      color: #888899;
    }
    .btn-install {
      background: linear-gradient(135deg, #7c3aed, #8b5cf6);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-close {
      background: transparent;
      border: none;
      color: #888899;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 5px;
    }
  `;
  document.head.appendChild(style);
  
  // Click en instalar
  banner.querySelector('.btn-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        banner.remove();
      }
      deferredPrompt = null;
    }
  });
  
  // Auto-ocultar después de 10 segundos
  setTimeout(() => banner.remove(), 10000);
}

// Detectar si ya está instalada
window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('install-banner');
  if (banner) banner.remove();
  deferredPrompt = null;
});
