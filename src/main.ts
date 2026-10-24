import { fetchStats, updateStat, CoupleStats } from './api';

// Partners and Categories
type Partner = 'Ирина' | 'Артем';
type Category = 'Секс' | 'Общение' | 'Быт';

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

// Colors definition from Unreal ColorsTable
const COLOR_HEX: Record<string, string> = {
  'Green': '#2ecc71',
  'Yellow': '#f1c40f',
  'Orange': '#e67e22',
  'Red': '#e74c3c',
  'Blue': '#3498db',
  'Purple': '#9b59b6',
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
const DIR_ICONS: Record<string, string> = {
  '(+)': '/dir_plus.png',
  '(-)': '/dir_minus.png',
  '(=)': '/dir_equal.png',
};

// App State
let cachedStats: CoupleStats | null = null;
let activePalettePartner: Partner | null = null;
let activeCommentTarget: { partner: Partner; category: Category } | null = null;

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

// Palette Modal Elements
const coloursWidget = document.getElementById('colours-widget') as HTMLDivElement;
const btnClosePalette = document.getElementById('btn-close-palette') as HTMLButtonElement;

// Comment Modal Elements
const commentWidget = document.getElementById('comment-widget') as HTMLDivElement;
const commentModalTitle = document.getElementById('comment-modal-title') as HTMLDivElement;
const commentInput = document.getElementById('comment-input') as HTMLTextAreaElement;
const btnCommentClear = document.getElementById('btn-comment-clear') as HTMLButtonElement;
const btnCommentEnter = document.getElementById('btn-comment-enter') as HTMLButtonElement;

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

    // 1. Color Button
    const partnerColor = cachedStats['Цвет']?.[partner] || 'Yellow';
    const hex = COLOR_HEX[partnerColor] || '#f1c40f';
    const colorBtn = document.getElementById(`btn-color-${pId}`);
    const colorText = document.getElementById(`text-color-${pId}`);
    if (colorBtn) colorBtn.style.backgroundColor = hex;
    if (colorText) colorText.textContent = partnerColor;

    // 2. Categories
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
        dirImg.src = DIR_ICONS[currentDir] || '/dir_equal.png';
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

// Handle Slider drag/change
async function handleSliderChange(partner: Partner, category: Category, newVal: number) {
  if (!cachedStats) return;

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

// Handle Direction Cycle
async function handleDirectionCycle(partner: Partner, category: Category) {
  if (!cachedStats) return;

  const pId = PARTNER_ID[partner];
  const cId = CATEGORY_ID[category];
  const dirKey = `${category} динамика` as keyof CoupleStats;

  const currentDir = (cachedStats[dirKey] as any)?.[partner] || '(=)';
  const idx = DIRECTIONS.indexOf(currentDir as any);
  const nextDir = DIRECTIONS[(idx + 1) % DIRECTIONS.length];

  (cachedStats[dirKey] as any)[partner] = nextDir;
  const dirImg = document.getElementById(`dir-img-${pId}-${cId}`) as HTMLImageElement;
  if (dirImg) dirImg.src = DIR_ICONS[nextDir] || '/dir_equal.png';

  setSyncState('Обновление динамики...', 'syncing');
  try {
    await updateStat(dirKey, partner, nextDir);
    setSyncState('Синхронизировано');
  } catch (err) {
    console.error(err);
    setSyncState('Ошибка сохранения', 'error');
  }
}

// ColoursWidget Palette
function openColorPalette(partner: Partner) {
  activePalettePartner = partner;
  coloursWidget.classList.add('open');
}

function closeColorPalette() {
  activePalettePartner = null;
  coloursWidget.classList.remove('open');
}

async function selectColor(colorName: string) {
  if (!activePalettePartner || !cachedStats) return;

  const partner = activePalettePartner;
  (cachedStats['Цвет'] as any)[partner] = colorName;

  closeColorPalette();
  renderAll();

  setSyncState(`Цвет ${partner} изменён...`, 'syncing');
  try {
    await updateStat('Цвет', partner, colorName);
    setSyncState('Синхронизировано');
  } catch (err) {
    console.error(err);
    setSyncState('Ошибка сохранения', 'error');
  }
}

// CommentWidget Note Editing
function openCommentModal(partner: Partner, category: Category) {
  if (!cachedStats) return;

  activeCommentTarget = { partner, category };
  const noteKey = `${category} пожелания` as keyof CoupleStats;
  const note = (cachedStats[noteKey] as any)?.[partner] || '';

  commentModalTitle.textContent = `Заметка: ${category} (${partner})`;
  commentInput.value = note;
  commentWidget.classList.add('open');
  commentInput.focus();
}

function closeCommentModal() {
  activeCommentTarget = null;
  commentWidget.classList.remove('open');
}

async function saveComment(text: string) {
  if (!activeCommentTarget || !cachedStats) return;

  const { partner, category } = activeCommentTarget;
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

  // Обновить программу (Hard reload with cache busting)
  btnUpdateApp.addEventListener('click', () => {
    setSyncState('Обновление приложения...', 'syncing');
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

  // Palette triggers
  document.getElementById('btn-color-irina')?.addEventListener('click', () => openColorPalette('Ирина'));
  document.getElementById('btn-color-artem')?.addEventListener('click', () => openColorPalette('Артем'));
  btnClosePalette.addEventListener('click', closeColorPalette);

  // Palette buttons
  document.querySelectorAll<HTMLButtonElement>('.color-choice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color || 'Yellow';
      selectColor(color);
    });
  });

  // Comment modal actions
  btnCommentClear.addEventListener('click', () => {
    commentInput.value = '';
    saveComment('');
  });
  btnCommentEnter.addEventListener('click', () => {
    saveComment(commentInput.value.trim());
  });

  // Bind controls for both Irina and Artem
  for (const partner of PARTNERS) {
    const pId = PARTNER_ID[partner];
    for (const cat of CATEGORIES) {
      const cId = CATEGORY_ID[cat];

      // Slider
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
