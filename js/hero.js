/* ===== FRUV™ Hero — Scroll-Driven Frame Animation & Variant Switching ===== */

const VARIANTS = [
  {
    name: "Mango",
    subtitle: "24 Pcs Carton",
    description: "Premium Mango nectar, factory-fresh. Sold exclusively in cartons of 24 for maximum value and quality preservation.",
    accent: "#FFFFFF",
    framePath: "mango%20avatar",
    frameCount: 192
  },
  {
    name: "Lassi",
    subtitle: "24 Pcs Carton",
    description: "Traditional premium blend. Available for custom batch orders. Each carton contains 24 expertly sealed pieces.",
    accent: "#FFFFFF",
    framePath: "lassi%20avatarx",
    frameCount: 192
  },
  {
    name: "Milk",
    subtitle: "24 Pcs Carton",
    description: "Full cream nutrition in bulk. 24 pieces per carton. Perfect for healthy households and large-scale distribution.",
    accent: "#FFFFFF",
    framePath: "milk%20avatar",
    frameCount: 192
  }
];

// Frame URL builder — Using Supabase Image Transformation for 95% faster loading
function getFrameUrl(variant, frameIndex) {
  const num = String(frameIndex).padStart(3, '0');
  const bucket = variant.framePath;
  const fileName = `frame_${num}_delay-0.041s.png`;
  
  // Mobile Optimization: Detect screen width
  const isMobile = window.innerWidth < 768;
  const width = isMobile ? 800 : 1600; // Smaller images for phones
  const quality = isMobile ? 75 : 85;   // Slightly lower quality on mobile for speed
  
  // Using 'render' API to convert PNG to WebP and resize on-the-fly
  return `https://eadzretxoofyqjfmklit.supabase.co/storage/v1/render/image/public/${bucket}/${fileName}?format=webp&quality=${quality}&width=${width}`;
}

class HeroController {
  constructor() {
    this.currentIndex = 0;
    this.frames = {};        // { variantName: Image[] }
    this.currentFrame = 0;
    this.lastDrawnFrame = -1;
    this.isTransitioning = false;
    this.canvas = document.getElementById('hero-canvas');
    this.ctx = this.canvas.getContext('2d');

    // DOM refs
    this.heroText = document.getElementById('hero-text');
    this.heroName = document.getElementById('hero-name');
    this.heroSubtitle = document.getElementById('hero-subtitle');
    this.heroDesc = document.getElementById('hero-desc');
    this.heroIndex = document.getElementById('hero-index');
    this.heroIndexM = document.getElementById('hero-index-m');
    this.spinner = document.getElementById('variant-spinner');
    this.heroSection = document.getElementById('hero');
    this.loaderBar = document.getElementById('loader-bar');
    this.loaderPercent = document.getElementById('loader-percent');
    this.loader = document.getElementById('loader');

    // Smooth Scrolling (LERP)
    this.targetProgress = 0;
    this.currentProgress = 0;
    this.lerpFactor = window.innerWidth < 768 ? 0.25 : 0.15; // Snappier on mobile touch devices

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Bind nav buttons
    document.getElementById('btn-prev').addEventListener('click', () => this.switchVariant(-1));
    document.getElementById('btn-next').addEventListener('click', () => this.switchVariant(1));
    document.getElementById('btn-prev-m').addEventListener('click', () => this.switchVariant(-1));
    document.getElementById('btn-next-m').addEventListener('click', () => this.switchVariant(1));

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.switchVariant(-1);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.switchVariant(1);
    });

    // Start Smooth Loop
    this.renderLoop();

    // Hash support
    this.checkHash();
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    // CSS size stays same
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    
    this.lastDrawnFrame = -1;
    this.drawFrame();
  }

  checkHash() {
    const hash = window.location.hash.replace('#', '').toLowerCase().replace('fruv-', '').replace('fruv ', '');
    const idx = VARIANTS.findIndex(v => v.name.toLowerCase().includes(hash));
    if (idx !== -1 && idx !== this.currentIndex) {
      // Reset progress so new variant starts at frame 0
      this.targetProgress = 0;
      this.currentProgress = 0;
      
      this.currentIndex = idx;
    }
  }
  async init() {
    // Safety timeout: 120s for the heavy asset load
    const safety = setTimeout(() => {
      if (this.loader.style.display !== 'none') {
        this.loader.style.display = 'none';
        this.loader.style.opacity = '0';
      }
    }, 120000);

    const currentVariant = VARIANTS[this.currentIndex];
    const totalFrames = currentVariant.frameCount;
    let totalLoaded = 0;
    let totalErrors = 0;

    const updateGlobalProgress = () => {
      const pct = Math.round(((totalLoaded + totalErrors) / totalFrames) * 100);
      if (this.loaderBar) this.loaderBar.style.width = pct + '%';
      if (this.loaderPercent) this.loaderPercent.textContent = `Preparing ${currentVariant.name} ${pct}%`;
    };

    // 1. Load the ACTIVE variant first (High Priority)
    try {
      await this.preloadFrames(this.currentIndex, () => {
        totalLoaded++;
        updateGlobalProgress();
      });
    } catch (e) {
      console.warn("Primary variant preload issues:", e);
    }
    
    this.applyVariant(false);
    this.startScrollListener();

    // Show the site as soon as the current product is ready
    clearTimeout(safety);
    this.loader.style.opacity = '0';
    setTimeout(() => {
      this.loader.style.display = 'none';
    }, 500);

    // 2. Load other variants SEQUENTIALLY in background (Low Priority)
    // This prevents choking the browser with 500+ parallel requests
    for (let i = 0; i < VARIANTS.length; i++) {
      if (i !== this.currentIndex) {
        // Load one by one to keep network smooth
        await this.preloadFrames(i, null).catch(e => console.warn("BG Preload error:", e));
      }
    }
  }

  preloadFrames(variantIndex, progressCallback) {
    const variant = VARIANTS[variantIndex];
    if (this.frames[variant.name]) return Promise.resolve();

    return new Promise((resolve) => {
      const total = variant.frameCount;
      const images = new Array(total);
      this.frames[variant.name] = images;
      
      let loaded = 0;
      let errors = 0;

      for (let i = 0; i < total; i++) {
        const img = new Image();
        img.onload = () => {
          images[i] = img;
          loaded++;
          if (progressCallback) progressCallback(loaded, errors);
          if (variantIndex === this.currentIndex) this.drawFrame(true); // Force redraw when active frames load
          if (loaded + errors >= total) resolve();
        };
        img.onerror = () => {
          errors++;
          if (progressCallback) progressCallback(loaded, errors);
          if (loaded + errors >= total) resolve();
        };
        img.src = getFrameUrl(variant, i);
      }
    });
  }

  renderLoop() {
    // Smoothly interpolate current progress towards target
    const diff = this.targetProgress - this.currentProgress;
    
    if (Math.abs(diff) > 0.0001) {
      this.currentProgress += diff * this.lerpFactor;
      this.updateFrame();
    } else if (this.isTransitioning) {
      // Still need to update during variant transitions
      this.updateFrame();
    }

    requestAnimationFrame(() => this.renderLoop());
  }

  startScrollListener() {
    window.addEventListener('scroll', () => {
      const heroRect = this.heroSection.getBoundingClientRect();
      const scrollableHeight = this.heroSection.offsetHeight - window.innerHeight;
      
      if (scrollableHeight > 0) {
        this.targetProgress = Math.max(0, Math.min(1, -heroRect.top / scrollableHeight));
      }
    }, { passive: true });
    
    // Initial sync
    const heroRect = this.heroSection.getBoundingClientRect();
    const scrollableHeight = this.heroSection.offsetHeight - window.innerHeight;
    if (scrollableHeight > 0) {
      this.targetProgress = Math.max(0, Math.min(1, -heroRect.top / scrollableHeight));
      this.currentProgress = this.targetProgress;
    }
    this.updateFrame();
  }

  updateFrame() {
    const variant = VARIANTS[this.currentIndex];
    const frameImages = this.frames[variant.name];
    
    if (!frameImages) return;
    
    // Map current lerped progress to frame index
    const frameIndex = Math.min(
      Math.floor(this.currentProgress * (frameImages.length - 1)),
      frameImages.length - 1
    );
    
    this.currentFrame = Math.max(0, frameIndex);
    this.drawFrame();
  }

  drawFrame(force = false) {
    if (!force && this.currentFrame === this.lastDrawnFrame) return;
    this.lastDrawnFrame = this.currentFrame;

    const variant = VARIANTS[this.currentIndex];
    const frameImages = this.frames[variant.name];
    
    if (!frameImages || frameImages.length === 0) {
      this.drawFallbackFrame(variant);
      return;
    }

    // Find closest loaded frame (Search backward, then forward)
    let img = null;
    
    // Backward search
    for (let i = this.currentFrame; i >= 0; i--) {
      if (frameImages[i] && frameImages[i].complete && frameImages[i].naturalWidth > 0) {
        img = frameImages[i];
        break;
      }
    }
    
    // Forward search if nothing found
    if (!img) {
      for (let i = this.currentFrame + 1; i < variant.frameCount; i++) {
        if (frameImages[i] && frameImages[i].complete && frameImages[i].naturalWidth > 0) {
          img = frameImages[i];
          break;
        }
      }
    }

    if (img) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      const isMobile = window.innerWidth < 768;
      
      // Contain-fit the image
      const scale = Math.min(
        this.canvas.width / img.naturalWidth,
        (isMobile ? this.canvas.height * 0.6 : this.canvas.height) / img.naturalHeight
      );
      
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const x = (this.canvas.width - w) / 2;
      
      // Position: Centered on desktop, Pushed up on mobile
      const y = isMobile ? (this.canvas.height * 0.35 - h / 2) : (this.canvas.height - h) / 2;
      
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(img, x, y, w, h);

      // Cover the 'Veo' watermark
      const maskW = w * 0.06;
      const maskH = h * 0.05;
      const maskX = x + w - maskW - (w * 0.01); 
      const maskY = y + h - maskH - (h * 0.01);
      
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(maskX, maskY, maskW, maskH);
    } else {
      this.drawFallbackFrame(variant);
    }
  }

  drawFallbackFrame() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Solid black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
  }

  async switchVariant(direction) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const newIndex = (this.currentIndex + direction + VARIANTS.length) % VARIANTS.length;
    
    // Fade out text
    this.heroText.classList.add('fade-out');
    
    // Update index number immediately
    const idxStr = String(newIndex + 1).padStart(2, '0');
    this.heroIndex.textContent = idxStr;
    if (this.heroIndexM) this.heroIndexM.textContent = idxStr;

    // Show spinner if frames not cached
    const variant = VARIANTS[newIndex];
    if (!this.frames[variant.name]) {
      this.spinner.classList.add('active');
      await this.preloadFrames(newIndex, false);
      this.spinner.classList.remove('active');
    }

    // Small delay for fade out
    await this.sleep(350);

    // Switch variant
    this.currentIndex = newIndex;
    this.lastDrawnFrame = -1;
    this.applyVariant(true);
    this.updateFrame();

    // Fade in
    this.heroText.classList.remove('fade-out');
    
    // Update hash
    window.history.replaceState(null, '', '#' + variant.name.toLowerCase().replace(' ', '-'));

    await this.sleep(400);
    this.isTransitioning = false;
  }

  applyVariant(animated) {
    const variant = VARIANTS[this.currentIndex];
    
    // Update text
    this.heroName.textContent = variant.name;
    this.heroSubtitle.textContent = variant.subtitle;
    this.heroDesc.textContent = variant.description;
    
    // Update index
    const idxStr = String(this.currentIndex + 1).padStart(2, '0');
    this.heroIndex.textContent = idxStr;
    if (this.heroIndexM) this.heroIndexM.textContent = idxStr;

    // Update accent color
    document.documentElement.style.setProperty('--accent', variant.accent);
    
    // Update accent glow
    const r = parseInt(variant.accent.slice(1, 3), 16);
    const g = parseInt(variant.accent.slice(3, 5), 16);
    const b = parseInt(variant.accent.slice(5, 7), 16);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for app.js
window.HeroController = HeroController;
