/**
 * Vintage Club - Frontend Application Script
 * Dynamic API Integration + Dark/Light Theme Switcher + Multi-Language (i18n) Support
 */

let CLIENT_LOCALES = {};

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();
  initNavbarScroll();
  initMobileMenu();
  initAuthModal();
  initScrollReveal();
  await loadClientLocales();
  loadAllBackendData();
  setupApplicationForm();
});

/* ========================================================
   0. Fetch Client-Side Locales
   ======================================================== */
async function loadClientLocales() {
  try {
    const res = await fetch('/api/v1/locales');
    const data = await res.json();
    if (data.success && data.locales) {
      CLIENT_LOCALES = data.locales;
    }
  } catch (err) {
    console.warn('Could not load client locales, fallback to default');
  }
}

function tClient(path, fallback = '') {
  const keys = path.split('.');
  let current = CLIENT_LOCALES;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return fallback;
    }
  }
  return typeof current === 'string' ? current : fallback;
}

/* ========================================================
   1. Theme Switcher (Dark / Light Mode)
   ======================================================== */
function initThemeToggle() {
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  if (!toggleBtns.length) return;

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const nextTheme = isDark ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem('theme', nextTheme);
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/* ========================================================
   2. Navbar Floating Scroll Effect
   ======================================================== */
function initNavbarScroll() {
  const navbar = document.getElementById('main-navbar');
  if (!navbar) return;

  let ticking = false;

  const handleScroll = () => {
    const shouldFloat = window.scrollY > 20;
    if (shouldFloat && !navbar.classList.contains('navbar-scrolled')) {
      navbar.classList.add('navbar-scrolled');
    } else if (!shouldFloat && navbar.classList.contains('navbar-scrolled')) {
      navbar.classList.remove('navbar-scrolled');
    }
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(handleScroll);
      ticking = true;
    }
  }, { passive: true });

  handleScroll();
}

/* ========================================================
   3. Mobile Menu Toggle
   ======================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!toggleBtn || !mobileMenu) return;

  toggleBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
    });
  });
}

/* ========================================================
   4. Auth Modal Management (Smooth Animated Transitions)
   ======================================================== */
function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  const openBtns = document.querySelectorAll('#open-login-modal-btn, .open-login-modal-btn');
  const closeBtn = document.getElementById('close-auth-modal-btn');
  if (!modal) return;

  let isTransitioning = false;

  const openModal = (e) => {
    if (e) e.preventDefault();
    if (isTransitioning) return;
    isTransitioning = true;

    modal.classList.remove('hidden', 'is-closing');
    // Force layout reflow for CSS keyframe/transition initiation
    void modal.offsetWidth;
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      isTransitioning = false;
    }, 320);
  };

  const closeModal = () => {
    if (isTransitioning || modal.classList.contains('hidden')) return;
    isTransitioning = true;

    modal.classList.add('is-closing');
    modal.classList.remove('is-active');

    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('is-closing');
      document.body.style.overflow = '';
      isTransitioning = false;
    }, 220);
  };

  openBtns.forEach(btn => btn.addEventListener('click', openModal));

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

/* ========================================================
   5. Scroll Reveal Animation Engine
   ======================================================== */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (!revealElements.length) return;

  if (!('IntersectionObserver' in window)) {
    revealElements.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}

/* ========================================================
   6. Load Dynamic Data from Backend API
   ======================================================== */
async function loadAllBackendData() {
  await Promise.allSettled([
    loadStats(),
    loadEvents(),
    loadTeam(),
    loadGallery()
  ]);
  // Re-run reveal observer for dynamically injected cards
  setTimeout(initScrollReveal, 100);
}

async function loadStats() {
  try {
    const res = await fetch('/api/v1/stats');
    const result = await res.json();
    if (result.success && result.data) {
      const d = result.data;
      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setEl('stat-members', d.totalMembers || '0');
      setEl('stat-convoys', d.totalConvoys || '0');
      setEl('stat-km', d.totalKilometers || '0 KM');
      setEl('stat-founded', d.establishedYear || '2024');
    }
  } catch (err) {
    console.error('Stats API error:', err);
  }
}

async function loadEvents() {
  const container = document.getElementById('events-container');
  if (!container) return;

  try {
    const res = await fetch('/api/v1/events');
    const result = await res.json();
    const events = (result.success && Array.isArray(result.data)) ? result.data : [];

    if (events.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 px-6 clean-card bg-white dark:bg-[#18100B] border-dashed border-[#E1E2E4] dark:border-[#4A2B1D]">
          <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#E1E2E4]/60 dark:bg-[#20130C] flex items-center justify-center text-[#8C5137] dark:text-[#AA6343] text-2xl shadow-inner">
            <i class="fa-solid fa-calendar-days"></i>
          </div>
          <h3 class="text-base font-bold text-[#4A2B1D] dark:text-white">${tClient('home.no_events', 'No Scheduled Convoys')}</h3>
          <p class="text-xs sm:text-sm text-[#8C5137] dark:text-[#E1E2E4] mt-1 max-w-md mx-auto">
            ${tClient('events.hero_subtitle', 'Upcoming official convoys and event dates will be announced here soon.')}
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = events.map(evt => `
      <div class="clean-card p-6 flex flex-col justify-between bg-white dark:bg-[#18100B]">
        <div>
          <div class="flex items-center justify-between text-xs text-[#8C5137] dark:text-[#E1E2E4] mb-3">
            <span class="font-semibold text-[#8C5137] dark:text-[#AA6343] bg-[#8C5137]/10 dark:bg-[#AA6343]/20 px-2.5 py-1 rounded-full border border-[#8C5137]/20 dark:border-[#AA6343]/30">
              <i class="fa-solid fa-server text-[10px] mr-1"></i>${evt.server || 'Simulation'}
            </span>
            <span class="flex items-center gap-1.5">
              <i class="fa-regular fa-calendar text-[11px]"></i>
              ${evt.date ? new Date(evt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
            </span>
          </div>
          <h3 class="text-lg font-bold text-[#4A2B1D] dark:text-white mb-2">${evt.title}</h3>
          <p class="text-xs text-[#8C5137] dark:text-[#E1E2E4] mb-4 leading-relaxed">${evt.description || ''}</p>
          <div class="text-xs text-[#4A2B1D] dark:text-[#E1E2E4] space-y-1.5 pt-3 border-t border-[#E1E2E4] dark:border-[#4A2B1D]">
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-route text-[#8C5137] text-[11px] w-4"></i>
              <span class="text-[#8C5137]/70 dark:text-[#E1E2E4]/70">${tClient('events.route', 'Route')}:</span> 
              <span class="font-medium">${evt.departure || '—'} <i class="fa-solid fa-arrow-right-long text-[10px] mx-1 text-[#8C5137]"></i> ${evt.destination || '—'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-gauge-high text-[#8C5137] text-[11px] w-4"></i>
              <span class="text-[#8C5137]/70 dark:text-[#E1E2E4]/70">${tClient('events.distance', 'Distance')}:</span> 
              <span class="font-medium">${evt.distance || '—'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-map-location-dot text-[#8C5137] text-[11px] w-4"></i>
              <span class="text-[#8C5137]/70 dark:text-[#E1E2E4]/70">${tClient('events.dlc_req', 'DLC Required')}:</span> 
              <span class="font-medium">${evt.dlcRequired || tClient('events.base_game', 'Base Game')}</span>
            </div>
          </div>
        </div>
        <div class="mt-6 pt-4 border-t border-[#E1E2E4] dark:border-[#4A2B1D] flex gap-2">
          <a href="/apply" class="flex-1 py-2 btn-primary text-xs text-center rounded-lg">
            <i class="fa-solid fa-user-plus mr-1.5 text-[11px]"></i>${tClient('events.join_btn', 'Join Convoy')}
          </a>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Events API error:', err);
  }
}

async function loadTeam() {
  const container = document.getElementById('team-container');
  if (!container) return;

  try {
    const res = await fetch('/api/v1/team');
    const result = await res.json();
    const members = (result.success && Array.isArray(result.data)) ? result.data : [];

    if (members.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 px-6 clean-card bg-white dark:bg-[#18100B] border-dashed border-[#E1E2E4] dark:border-[#4A2B1D]">
          <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#E1E2E4]/60 dark:bg-[#20130C] flex items-center justify-center text-[#8C5137] dark:text-[#AA6343] text-2xl shadow-inner">
            <i class="fa-solid fa-users"></i>
          </div>
          <h3 class="text-base font-bold text-[#4A2B1D] dark:text-white">${tClient('team.hero_title', 'Fleet Roster')}</h3>
          <p class="text-xs sm:text-sm text-[#8C5137] dark:text-[#E1E2E4] mt-1 max-w-md mx-auto">
            ${tClient('team.empty_roster', 'Fleet roster is currently being synchronized.')}
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = members.map(m => `
      <div class="clean-card p-6 text-center flex flex-col items-center bg-white dark:bg-[#18100B]">
        <div class="w-20 h-20 rounded-full bg-[#E1E2E4] dark:bg-[#20130C] border-2 border-[#8C5137]/30 dark:border-[#AA6343]/50 overflow-hidden mb-4 shadow-sm">
          <img src="${m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}" alt="${m.name}" class="w-full h-full object-cover" />
        </div>
        <span class="badge-soft mb-2">${m.badge || m.role || 'Member'}</span>
        <h3 class="text-base font-bold text-[#4A2B1D] dark:text-white">${m.name}</h3>
        <p class="text-xs text-[#8C5137] dark:text-[#E1E2E4] mt-1">${m.role || ''}</p>
      </div>
    `).join('');

  } catch (err) {
    console.error('Team API error:', err);
  }
}

async function loadGallery() {
  const container = document.getElementById('gallery-container');
  if (!container) return;

  try {
    const res = await fetch('/api/v1/gallery');
    const result = await res.json();
    const items = (result.success && Array.isArray(result.data)) ? result.data : [];

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 px-6 clean-card bg-white dark:bg-[#18100B] border-dashed border-[#E1E2E4] dark:border-[#4A2B1D]">
          <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#E1E2E4]/60 dark:bg-[#20130C] flex items-center justify-center text-[#8C5137] dark:text-[#AA6343] text-2xl shadow-inner">
            <i class="fa-solid fa-images"></i>
          </div>
          <h3 class="text-base font-bold text-[#4A2B1D] dark:text-white">${tClient('gallery.hero_title', 'Cinematic Gallery')}</h3>
          <p class="text-xs sm:text-sm text-[#8C5137] dark:text-[#E1E2E4] mt-1 max-w-md mx-auto">
            ${tClient('gallery.empty_gallery', 'Media gallery is currently being curated.')}
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="clean-card overflow-hidden group cursor-pointer aspect-video relative border-[#E1E2E4] dark:border-[#4A2B1D]">
        <img src="${item.imageUrl}" alt="${item.title || 'Photo'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end text-white">
          <span class="text-xs font-semibold">${item.title}</span>
          <span class="text-[11px] text-[#E1E2E4]">${item.author || ''}</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Gallery API error:', err);
  }
}

/* ========================================================
   6. Driver Recruitment Application Form Submission
   ======================================================== */
function setupApplicationForm() {
  const applyForm = document.getElementById('driver-apply-form');
  if (!applyForm) return;

  applyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = document.getElementById('apply-form-feedback');
    const submitBtn = applyForm.querySelector('button[type="submit"]');

    const formData = new FormData(applyForm);
    const payload = {
      fullName: formData.get('fullName'),
      age: formData.get('age'),
      discordTag: formData.get('discordTag'),
      truckersMpProfile: formData.get('truckersMpProfile'),
      steamProfile: formData.get('steamProfile'),
      experienceHours: formData.get('experienceHours'),
      dlcList: formData.getAll('dlcList'),
      notes: formData.get('notes')
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>${tClient('apply.submitting', 'Submitting...')}`;

    try {
      const res = await fetch('/api/v1/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (res.ok && result.success) {
        feedback.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 mr-2"></i> ${tClient('apply.success_msg', result.message || 'Application submitted successfully!')}`;
        feedback.className = 'p-4 rounded-xl bg-emerald-50 dark:bg-[#18100B] border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-medium mt-4 block';
        applyForm.reset();
      } else {
        feedback.innerHTML = `<i class="fa-solid fa-circle-exclamation text-rose-600 dark:text-rose-400 mr-2"></i> ${tClient('apply.error_msg', result.message || 'Failed to submit application.')}`;
        feedback.className = 'p-4 rounded-xl bg-rose-50 dark:bg-[#18100B] border border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs font-medium mt-4 block';
      }
    } catch (err) {
      feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-600 dark:text-rose-400 mr-2"></i> ${tClient('common.server_error', 'An error occurred while submitting your application.')}`;
      feedback.className = 'p-4 rounded-xl bg-rose-50 dark:bg-[#18100B] border border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs font-medium mt-4 block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-2"></i>${tClient('apply.btn_submit', 'Submit Application')}`;
    }
  });
}
