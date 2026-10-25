import { fetchStats, updateStat, CoupleStats } from './api';

// Partners and Categories
type Partner = 'Ирина' | 'Артем';
type Category = 'Секс' | 'Общение' | 'Быт';
type UserMode = 'none' | 'Артем' | 'Ирина';

const PARTNERS: Partner[] = ['Ирина', 'Артем'];
const CATEGORIES: Category[] = ['Секс', 'Общение', 'Быт'];

const PARTNER_ID: Record<Partner, string> = {
  'Ирина': 'irina',
  'Артем': 'artem',
};

const CATEGORY_ID: Record<Category, string> = {
  'Секс': 'sex',
  'Общение': 'comm',
  'Быт': 'dom',
};

// Word conversion from Unreal StatesTable
function getStateWord(val: number): { text: string; cssClass: string } {
  if (val >= 9) return { text: 'Отлично', cssClass: 'status-great' };
  if (val >= 7) return { text: 'Нормально', cssClass: 'status-ok' };
  if (val >= 4) return { text: 'Так себе', cssClass: 'status-so' };
  return { text: 'Плохо', cssClass: 'status-bad' };
}

// Directions cycling
const DIRECTIONS = ['(=)', '(+)', '(-)'] as const;
function getDirIcon(val: string): string {
  const clean = (val || '').trim();
  if (clean.includes('+')) return './dir_plus.png';
  if (clean.includes('-')) return './dir_minus.png';
  return './dir_equal.png';
}

// App State
let cachedStats: CoupleStats | null = null;
let activeCommentTarget: { partner: Partner; category: Category } | null = null;

// User Mode (Role locking: Artyom / Irina / none)
let currentUserMode: UserMode = (localStorage.getItem('horosho_v_lesu_user_mode') as UserMode) || 'none';

// UI Elements
const appWindow = document.getElementById('app-window') as HTMLDivElement;
const minimizedBar = document.getElementById('minimized-bar') as HTMLDivElement;
const closedAppScreen = document.getElementById('closed-app-screen') as HTMLDivElement;
const btnWinMinimize = document.getElementById('btn-win-minimize') as HTMLButtonElement;
const btnWinClose = document.getElementById('btn-win-close') as HTMLButtonElement;

const syncBulb = document.getElementById('sync-bulb') as HTMLDivElement;
const syncStatusMsg = document.getElementById('sync-status-msg') as HTMLSpanElement;
const btnMainRefresh = document.getElementById('btn-main-refresh') as HTMLButtonElement;
const refreshIcon = document.getElementById('refresh-icon') as HTMLSpanElement;
const btnUpdateApp = document.getElementById('btn-update-app') as HTMLButtonElement;

// User Mode Elements
const userModeBadge = document.getElementById('user-mode-badge') as HTMLDivElement;
const badgeUserImg = document.getElementById('badge-user-img') as HTMLImageElement;
const badgeUserName = document.getElementById('badge-user-name') as HTMLSpanElement;
const btnUserLogout = document.getElementById('btn-user-logout') as HTMLButtonElement;
const toastNotification = document.getElementById('toast-notification') as HTMLDivElement;
const appFavicon = document.getElementById('app-favicon') as HTMLLinkElement;
const appTouchIcon = document.getElementById('app-touch-icon') as HTMLLinkElement;

// Comment Modal Elements
const commentWidget = document.getElementById('comment-widget') as HTMLDivElement;
const commentModalTitle = document.getElementById('comment-modal-title') as HTMLDivElement;
const commentInput = document.getElementById('comment-input') as HTMLTextAreaElement;
const btnCommentClear = document.getElementById('btn-comment-clear') as HTMLButtonElement;
const btnCommentEnter = document.getElementById('btn-comment-enter') as HTMLButtonElement;
const btnCommentClose = document.getElementById('btn-comment-close') as HTMLButtonElement;

// Toast Utility
let toastTimer: any = null;
function showToast(message: string, durationMs = 2500) {
  if (!toastNotification) return;
  if (toastTimer) clearTimeout(toastTimer);
  toastNotification.textContent = message;
  toastNotification.style.display = 'flex';
  toastTimer = setTimeout(() => {
    toastNotification.style.display = 'none';
    toastTimer = null;
  }, durationMs);
}

// App Icon switching (Changes to spouse's picture when logged in)
function updateAppIcon(mode: UserMode) {
  let iconUrl = './Heart.png';
  if (mode === 'Артем') {
    // External app icon on Artem's phone shows spouse Irina
    iconUrl = './icon-irina-192.png';
  } else if (mode === 'Ирина') {
    // External app icon on Irina's phone shows spouse Artem
    iconUrl = './icon-artem-192.png';
  }

  // Favicon & Apple touch icon with cache-busting
  document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());
  const newLink = document.createElement('link');
  newLink.rel = 'icon';
  newLink.type = 'image/png';
  newLink.href = `${iconUrl}?v=${Date.now()}`;
  document.head.appendChild(newLink);

  const newApple = document.createElement('link');
  newApple.rel = 'apple-touch-icon';
  newApple.href = `${iconUrl}?v=${Date.now()}`;
  document.head.appendChild(newApple);
}

// Apply User Mode UI (cards styles, tags, sliders disabled state, user badge photo)
function applyUserModeUI() {
  updateAppIcon(currentUserMode);

  if (currentUserMode === 'none') {
    if (userModeBadge) userModeBadge.style.display = 'none';
  } else {
    if (userModeBadge) {
      userModeBadge.style.display = 'flex';
      badgeUserName.textContent = `Вы: ${currentUserMode}`;
      // In the badge next to "Вы: Ирина" / "Вы: Артём" show the logged in user's portrait!
      const userPhoto = currentUserMode === 'Артем' ? './icon-artem-192.png' : './icon-irina-192.png';
      if (badgeUserImg) badgeUserImg.src = userPhoto;
    }
  }

  for (const partner of PARTNERS) {
    const pId = PARTNER_ID[partner];
    const card = document.getElementById(`card-${pId}`);
    const roleTag = document.getElementById(`role-tag-${pId}`);

    const isUser = currentUserMode === partner;
    const isSpouse = currentUserMode !== 'none' && currentUserMode !== partner;

    if (card) {
      if (isUser) {
        card.classList.add('is-active-user');
        card.classList.remove('is-readonly');
      } else if (isSpouse) {
        card.classList.remove('is-active-user');
        card.classList.add('is-readonly');
      } else {
        card.classList.remove('is-active-user');
        card.classList.remove('is-readonly');
      }
    }

    if (roleTag) {
      if (isUser) {
        roleTag.className = 'role-tag-badge active-role';
        roleTag.textContent = 'ВЫ';
      } else if (isSpouse) {
        roleTag.className = 'role-tag-badge readonly-role';
        roleTag.textContent = 'ПРОСМОТР';
      } else {
        roleTag.className = 'role-tag-badge';
        roleTag.textContent = '';
      }
    }

    // Disable/enable sliders on spouse's card
    for (const cat of CATEGORIES) {
      const cId = CATEGORY_ID[cat];
      const slider = document.getElementById(`slider-${pId}-${cId}`) as HTMLInputElement;
      if (slider) {
        slider.disabled = isSpouse;
      }
    }
  }
}

function setUserMode(mode: UserMode) {
  currentUserMode = mode;
  if (mode === 'none') {
    localStorage.removeItem('horosho_v_lesu_user_mode');
  } else {
    localStorage.setItem('horosho_v_lesu_user_mode', mode);
  }
  applyUserModeUI();
}

// 10-tap interaction on partner avatar
const tapCounters: Record<Partner, { count: number; lastTime: number }> = {
  'Артем': { count: 0, lastTime: 0 },
  'Ирина': { count: 0, lastTime: 0 },
};

function handleAvatarTap(partner: Partner) {
  const now = Date.now();
  const tracker = tapCounters[partner];

  if (now - tracker.lastTime > 3000) {
    tracker.count = 1;
  } else {
    tracker.count++;
  }
  tracker.lastTime = now;

  try {
    if ('vibrate' in navigator) navigator.vibrate(20);
  } catch {}

  if (currentUserMode === partner) {
    showToast(`Вы уже авторизованы как ${partner} 👤`, 1200);
    return;
  }

  if (tracker.count < 10) {
    const left = 10 - tracker.count;
    const word = left === 1 ? 'нажатие' : left < 5 ? 'нажатия' : 'нажатий';
    showToast(`Вход как ${partner}: ${tracker.count}/10 (ещё ${left} ${word})...`, 900);
  } else if (tracker.count >= 10) {
    tracker.count = 0;
    setUserMode(partner);
    const spouse = partner === 'Артем' ? 'Ирины' : 'Артёма';
    showToast(`👤 Вы вошли как ${partner}! Иконка изменена на ${partner === 'Артем' ? 'Ирину' : 'Артёма'}. Параметры ${spouse} заблокированы.`, 4000);
  }
}

function setSyncState(text: string, state: 'ok' | 'syncing' | 'error' = 'ok') {
  syncStatusMsg.textContent = text;
  if (state === 'syncing') {
    syncBulb.style.backgroundColor = '#f1c40f';
  } else if (state === 'error') {
    syncBulb.style.backgroundColor = '#e74c3c';
  } else {
    syncBulb.style.backgroundColor = '#2ecc71';
  }
}

// Update all UI components from cachedStats
function renderAll() {
  if (!cachedStats) return;

  for (const partner of PARTNERS) {
    const pId = PARTNER_ID[partner];

    // Categories
    for (const cat of CATEGORIES) {
      const cId = CATEGORY_ID[cat];

      // Value & Slider
      const val = (cachedStats[cat]?.[partner] as number) ?? 5;
      const slider = document.getElementById(`slider-${pId}-${cId}`) as HTMLInputElement;
      const numLabel = document.getElementById(`num-${pId}-${cId}`);
      const statusLabel = document.getElementById(`status-text-${pId}-${cId}`);

      if (slider) slider.value = String(val);
      if (numLabel) numLabel.textContent = String(val);

      if (statusLabel) {
        const { text, cssClass } = getStateWord(val);
        statusLabel.textContent = text;
        statusLabel.className = `need-status-label ${cssClass}`;
      }

      // Direction
      const dirKey = `${cat} динамика` as keyof CoupleStats;
      const currentDir = (cachedStats[dirKey] as any)?.[partner] || '(=)';
      const dirImg = document.getElementById(`dir-img-${pId}-${cId}`) as HTMLImageElement;
      if (dirImg) {
        dirImg.src = getDirIcon(currentDir);
      }

      // Note Button
      const noteKey = `${cat} пожелания` as keyof CoupleStats;
      const noteText = (cachedStats[noteKey] as any)?.[partner] || '';
      const noteBtn = document.getElementById(`note-btn-${pId}-${cId}`);
      if (noteBtn) {
        if (noteText.trim()) {
          noteBtn.textContent = `💬 ${noteText}`;
          noteBtn.classList.add('has-content');
        } else {
          noteBtn.textContent = `+ Добавить пожелание...`;
          noteBtn.classList.remove('has-content');
        }
      }
    }
  }

  // Ensure read-only and slider states are retained after render
  applyUserModeUI();
}

// Refresh data from Google Apps Script
async function refreshData() {
  refreshIcon.style.display = 'inline-block';
  refreshIcon.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
    duration: 800,
    iterations: Infinity,
  });
  setSyncState('Загрузка из Google Docs...', 'syncing');

  try {
    const stats = await fetchStats();
    cachedStats = stats;
    renderAll();
    setSyncState('Синхронизировано');
  } catch (err: any) {
    console.error(err);
    setSyncState('Ошибка сети', 'error');
  } finally {
    refreshIcon.getAnimations().forEach((a) => a.cancel());
  }
}

// Handle Slider drag/change with permission check
async function handleSliderChange(partner: Partner, category: Category, newVal: number) {
  if (!cachedStats) return;

  if (currentUserMode !== 'none' && currentUserMode !== partner) {
    showToast(`🔒 Вы вошли как ${currentUserMode}. Параметры ${partner} доступны только для чтения!`);
    renderAll();
    return;
  }

  const pId = PARTNER_ID[partner];
  const cId = CATEGORY_ID[category];

  // Optimistic local update
  (cachedStats[category] as any)[partner] = newVal;
  const numLabel = document.getElementById(`num-${pId}-${cId}`);
  const statusLabel = document.getElementById(`status-text-${pId}-${cId}`);
  if (numLabel) numLabel.textContent = String(newVal);
  if (statusLabel) {
    const { text, cssClass } = getStateWord(newVal);
    statusLabel.textContent = text;
    statusLabel.className = `need-status-label ${cssClass}`;
  }

  setSyncState('Сохранение значения...', 'syncing');
  try {
    await updateStat(category, partner, newVal);
    setSyncState('Синхронизировано');
  } catch (err) {
    console.error(err);
    setSyncState('Ошибка сохранения', 'error');
  }
}

// Handle Direction Cycle with permission check
async function handleDirectionCycle(partner: Partner, category: Category) {
  if (!cachedStats) return;

  if (currentUserMode !== 'none' && currentUserMode !== partner) {
    showToast(`🔒 Вы вошли как ${currentUserMode}. Динамика ${partner} доступна только для чтения!`);
    return;
  }

  const pId = PARTNER_ID[partner];
  const cId = CATEGORY_ID[category];
  const dirKey = `${category} динамика` as keyof CoupleStats;

  const currentDir = (cachedStats[dirKey] as any)?.[partner] || '(=)';
  const idx = DIRECTIONS.indexOf(currentDir as any);
  const nextDir = DIRECTIONS[(idx + 1) % DIRECTIONS.length];

  (cachedStats[dirKey] as any)[partner] = nextDir;
  const dirImg = document.getElementById(`dir-img-${pId}-${cId}`) as HTMLImageElement;
  if (dirImg) dirImg.src = getDirIcon(nextDir);

  setSyncState('Обновление динамики...', 'syncing');
  try {
    await updateStat(dirKey, partner, nextDir);
    setSyncState('Синхронизировано');
  } catch (err) {
    console.error(err);
    setSyncState('Ошибка сохранения', 'error');
  }
}


// CommentWidget Note Editing (View-only if spouse)
function openCommentModal(partner: Partner, category: Category) {
  if (!cachedStats) return;

  activeCommentTarget = { partner, category };
  const noteKey = `${category} пожелания` as keyof CoupleStats;
  const note = (cachedStats[noteKey] as any)?.[partner] || '';

  const isSpouse = currentUserMode !== 'none' && currentUserMode !== partner;

  if (isSpouse) {
    commentModalTitle.textContent = `Заметка: ${category} (${partner}) [Просмотр]`;
    commentInput.value = note || '(Пожелание не заполнено)';
    commentInput.readOnly = true;
    btnCommentClear.style.display = 'none';
    btnCommentEnter.style.display = 'none';
  } else {
    commentModalTitle.textContent = `Заметка: ${category} (${partner})`;
    commentInput.value = note;
    commentInput.readOnly = false;
    btnCommentClear.style.display = 'inline-block';
    btnCommentEnter.style.display = 'inline-block';
  }

  commentWidget.classList.add('open');
  if (!isSpouse) {
    commentInput.focus();
  }
}

function closeCommentModal() {
  activeCommentTarget = null;
  commentWidget.classList.remove('open');
}

async function saveComment(text: string) {
  if (!activeCommentTarget || !cachedStats) return;

  const { partner, category } = activeCommentTarget;
  if (currentUserMode !== 'none' && currentUserMode !== partner) {
    closeCommentModal();
    return;
  }

  const noteKey = `${category} пожелания` as keyof CoupleStats;
  (cachedStats[noteKey] as any)[partner] = text;
  closeCommentModal();
  renderAll();

  setSyncState('Сохранение заметки...', 'syncing');
  try {
    await updateStat(noteKey, partner, text);
    setSyncState('Синхронизировано');
  } catch (err) {
    console.error(err);
    setSyncState('Ошибка сохранения', 'error');
  }
}

// Window Controls (Свернуть / Закрыть / Обновить программу)
function initWindowControls() {
  // PWA Install prompt
  let deferredPrompt: any = null;
  const btnPwaInstall = document.getElementById('btn-pwa-install') as HTMLButtonElement;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnPwaInstall) {
      btnPwaInstall.style.display = 'inline-flex';
    }
  });

  btnPwaInstall?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        btnPwaInstall.style.display = 'none';
      }
      deferredPrompt = null;
    }
  });

  // Свернуть
  btnWinMinimize.addEventListener('click', () => {
    appWindow.style.display = 'none';
    minimizedBar.classList.add('visible');
  });

  minimizedBar.addEventListener('click', () => {
    minimizedBar.classList.remove('visible');
    appWindow.style.display = 'flex';
  });

  // Закрыть
  btnWinClose.addEventListener('click', () => {
    closedAppScreen.classList.add('visible');
    try {
      window.close();
    } catch {
      // browser may block window.close
    }
  });

  closedAppScreen.addEventListener('click', () => {
    closedAppScreen.classList.remove('visible');
  });

  // Обновить программу (Hard reload with cache busting OR APK upgrade download)
  btnUpdateApp.addEventListener('click', () => {
    const isCapacitor = !!(window as any).Capacitor;
    const bridgeVer = (window as any).AndroidNativeBridge?.getApkVersion?.() || (window as any).__NATIVE_APK_VERSION__;

    if (isCapacitor && !bridgeVer) {
      showToast('📥 Скачивание обновления APK v1.3.1...', 4000);
      let apkUrl = 'https://shestirukiy.github.io/horosho-v-lesu/HoroshoVLesu-Artem.apk';
      if (currentUserMode === 'Ирина') {
        apkUrl = 'https://shestirukiy.github.io/horosho-v-lesu/HoroshoVLesu-Irina.apk';
      } else if (currentUserMode === 'Артем') {
        apkUrl = 'https://shestirukiy.github.io/horosho-v-lesu/HoroshoVLesu-Artem.apk';
      }
      setTimeout(() => {
        window.location.href = apkUrl;
      }, 500);
      return;
    }

    setSyncState('Обновление интерфейса...', 'syncing');
    btnUpdateApp.disabled = true;
    setTimeout(() => {
      window.location.reload();
    }, 300);
  });
}

// Setup Event Listeners
function initListeners() {
  initWindowControls();

  btnMainRefresh.addEventListener('click', refreshData);

  // User Mode Logout
  btnUserLogout?.addEventListener('click', () => {
    setUserMode('none');
    showToast('🔓 Вы вышли из режима аккаунта. Все параметры доступны.');
  });

  // 10-tap Avatar Listeners with fast touch responsiveness
  const bindFastTap = (boxId: string, partner: Partner) => {
    const el = document.getElementById(boxId);
    if (!el) return;
    let lastTap = 0;
    const handler = (e: Event) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastTap < 120) return; // debounce double trigger
      lastTap = now;
      handleAvatarTap(partner);
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);
  };

  bindFastTap('avatar-box-irina', 'Ирина');
  bindFastTap('avatar-box-artem', 'Артем');


  // Comment modal actions
  btnCommentClear.addEventListener('click', () => {
    commentInput.value = '';
    saveComment('');
  });
  btnCommentEnter.addEventListener('click', () => {
    saveComment(commentInput.value.trim());
  });
  btnCommentClose?.addEventListener('click', closeCommentModal);

  // Close comment modal on backdrop click
  commentWidget.addEventListener('click', (e) => {
    if (e.target === commentWidget) closeCommentModal();
  });

  // Bind controls for both Irina and Artem
  for (const partner of PARTNERS) {
    const pId = PARTNER_ID[partner];
    for (const cat of CATEGORIES) {
      const cId = CATEGORY_ID[cat];

      // Slider input & change
      const slider = document.getElementById(`slider-${pId}-${cId}`) as HTMLInputElement;
      if (slider) {
        slider.addEventListener('input', () => {
          const val = parseInt(slider.value, 10);
          const numLabel = document.getElementById(`num-${pId}-${cId}`);
          const statusLabel = document.getElementById(`status-text-${pId}-${cId}`);
          if (numLabel) numLabel.textContent = String(val);
          if (statusLabel) {
            const { text, cssClass } = getStateWord(val);
            statusLabel.textContent = text;
            statusLabel.className = `need-status-label ${cssClass}`;
          }
        });
        slider.addEventListener('change', () => {
          handleSliderChange(partner, cat, parseInt(slider.value, 10));
        });
      }

      // Direction button
      document.getElementById(`dir-btn-${pId}-${cId}`)?.addEventListener('click', () => {
        handleDirectionCycle(partner, cat);
      });

      // Note button
      document.getElementById(`note-btn-${pId}-${cId}`)?.addEventListener('click', () => {
        openCommentModal(partner, cat);
      });
    }
  }

  // Initial apply of saved user mode
  applyUserModeUI();

  // Initialize version display
  setupVersionDisplay();
}

function setupVersionDisplay() {
  const headerBadge = document.getElementById('header-version-badge');
  const footerBadge = document.getElementById('app-version-badge');

  function updateBadges(apkVer: string | null) {
    if (apkVer) {
      const text = `APK ${apkVer}`;
      if (headerBadge) {
        headerBadge.textContent = text;
        headerBadge.style.color = '#2ecc71';
        headerBadge.title = `Установлен нативный APK ${apkVer} (виджет поддерживается)`;
      }
      if (footerBadge) {
        footerBadge.textContent = `${text} • Web v1.3`;
        footerBadge.style.color = '#2ecc71';
        footerBadge.style.opacity = '0.9';
      }
    } else {
      const isCapacitor = !!(window as any).Capacitor;
      if (isCapacitor) {
        const text = `⚠️ Старый APK (обновите!)`;
        if (headerBadge) {
          headerBadge.textContent = text;
          headerBadge.style.color = '#e67e22';
          headerBadge.title = 'Обновите APK до v1.3 в релизах, чтобы появился виджет';
        }
        if (footerBadge) {
          footerBadge.textContent = `${text} • Web v1.3`;
          footerBadge.style.color = '#e67e22';
        }
      } else {
        const text = `Web v1.3`;
        if (headerBadge) headerBadge.textContent = text;
        if (footerBadge) footerBadge.textContent = text;
      }
    }
  }

  // 1. Synchronous check via AndroidNativeBridge
  const bridgeVer = (window as any).AndroidNativeBridge?.getApkVersion?.();
  if (bridgeVer) {
    updateBadges(bridgeVer);
  } else if ((window as any).__NATIVE_APK_VERSION__) {
    updateBadges((window as any).__NATIVE_APK_VERSION__);
  } else {
    setTimeout(() => {
      const lateVer = (window as any).AndroidNativeBridge?.getApkVersion?.() || (window as any).__NATIVE_APK_VERSION__;
      updateBadges(lateVer || null);
    }, 600);
  }

  // 2. Callback from native evaluateJavascript
  (window as any).__onNativeVersion = (ver: string) => {
    updateBadges(ver);
  };

  // Click on badge shows details toast / download offer
  const showVersionInfo = () => {
    const cur = (window as any).AndroidNativeBridge?.getApkVersion?.() || (window as any).__NATIVE_APK_VERSION__;
    if (cur) {
      showToast(`Установлен актуальный APK: ${cur}. Поддержка нативного виджета активна!`, 3500);
    } else if ((window as any).Capacitor) {
      showToast('📥 Скачивание обновления APK v1.3.1...', 4000);
      let apkUrl = 'https://shestirukiy.github.io/horosho-v-lesu/HoroshoVLesu-Artem.apk';
      if (currentUserMode === 'Ирина') {
        apkUrl = 'https://shestirukiy.github.io/horosho-v-lesu/HoroshoVLesu-Irina.apk';
      } else if (currentUserMode === 'Артем') {
        apkUrl = 'https://shestirukiy.github.io/horosho-v-lesu/HoroshoVLesu-Artem.apk';
      }
      setTimeout(() => {
        window.location.href = apkUrl;
      }, 500);
    } else {
      showToast(`Запущено в браузере (Web v1.3)`, 2500);
    }
  };

  headerBadge?.addEventListener('click', showVersionInfo);
  footerBadge?.addEventListener('click', showVersionInfo);
}

// Register Service Worker for seamless background auto-updates
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then((registration) => {
    // Check for updates
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('Доступна новая версия, автообновление...');
            setSyncState('Применение обновления программы...', 'syncing');
            setTimeout(() => window.location.reload(), 1000);
          }
        };
      }
    };
  }).catch((err) => console.log('SW registration error:', err));
}

// Start
initListeners();
refreshData();
