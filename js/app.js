/**
 * Mystic Weave Tarot - 主交互逻辑
 * 洗牌 → 切牌 → 抽牌飞入 → 3D翻牌 → 牌义展示
 */
(function () {
  'use strict';

  /* ===== 状态管理 ===== */
  const state = {
    phase: 'idle',        // idle | shuffled | cut | drawing | reading-done
    deck: [],             // 当前牌组（洗牌后的顺序）
    drawnCards: [],        // 抽到的3张牌
    drawIndex: 0,         // 当前抽到第几张（0-2）
    flippedCount: 0,      // 已翻牌数
    animating: false       // 动画锁
  };

  /* ===== DOM 缓存 ===== */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const btnShuffle  = $('#btnShuffle');
  const btnCut      = $('#btnCut');
  const btnStart    = $('#btnStart');
  const btnReset    = $('#btnReset');
  const deckStack   = $('#deckStack');
  const deckArea    = $('#deckArea');
  const drawingArea = $('#drawingArea');
  const resetWrapper = $('#resetWrapper');
  const hamburger   = $('#hamburger');
  const mobileNav   = $('#mobileNav');
  const panelToggle = $('#panelToggle');
  const panelBody   = $('#panelBody');

  /* 牌堆张数 */
  const STACK_COUNT = 7;

  /* ===== 初始化 ===== */
  function init() {
    preloadCardBack().then(() => {
      buildDeckStack();
      bindEvents();
      updateButtons();
    });
  }

  /* 预加载牌背图片，确保可用 */
  function preloadCardBack() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = CARD_BACK_IMAGE;
    });
  }

  /* 生成牌堆视觉（多张堆叠） */
  function buildDeckStack() {
    deckStack.innerHTML = '';
    for (let i = 0; i < STACK_COUNT; i++) {
      const card = document.createElement('div');
      card.className = 'deck-card';
      card.style.zIndex = i;
      card.style.top = -(i * 2) + 'px';
      card.style.left = (i * 1.2) + 'px';
      card.style.boxShadow = '2px 3px 12px rgba(0,0,0,0.5)';
      const img = document.createElement('img');
      img.src = CARD_BACK_IMAGE;
      img.alt = '塔罗牌背';
      img.draggable = false;
      card.appendChild(img);
      deckStack.appendChild(card);
    }
  }

  /* ===== 按钮状态控制 ===== */
  function updateButtons() {
    btnShuffle.disabled = state.animating || state.phase === 'drawing' || state.phase === 'reading-done';
    btnCut.disabled     = state.animating || state.phase !== 'shuffled';
    btnStart.disabled   = state.animating || state.phase !== 'cut';
  }

  function lockUI() { state.animating = true; updateButtons(); }
  function unlockUI() { state.animating = false; updateButtons(); }

  /* ===== 事件绑定 ===== */
  function bindEvents() {
    btnShuffle.addEventListener('click', handleShuffle);
    btnCut.addEventListener('click', handleCut);
    btnStart.addEventListener('click', handleStartReading);
    btnReset.addEventListener('click', handleReset);

    // 汉堡菜单
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', mobileNav.classList.contains('open'));
    });

    // 移动端面板
    panelToggle.addEventListener('click', () => {
      const open = panelBody.classList.toggle('open');
      panelToggle.setAttribute('aria-expanded', open);
    });

    // 截图按钮
    const btnScreenshot = $('#btnScreenshot');
    if (btnScreenshot) {
      btnScreenshot.addEventListener('click', handleScreenshot);
    }
  }

  /* ===== 洗牌 ===== */
  function handleShuffle() {
    if (state.animating) return;
    lockUI();

    // Fisher-Yates 洗牌
    state.deck = [...TAROT_DECK];
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }

    // 重置放牌区
    resetSlots();

    // 扇形展开动画
    const cards = deckStack.querySelectorAll('.deck-card');
    const total = cards.length;
    const spreadAngle = 140;
    const startAngle = -spreadAngle / 2;

    cards.forEach((card, i) => {
      card.classList.remove('stacked');
      card.classList.add('fanned');
      const angle = startAngle + (spreadAngle / (total - 1)) * i;
      const offsetX = Math.sin((angle * Math.PI) / 180) * 140;
      const offsetY = -Math.abs(Math.cos((angle * Math.PI) / 180)) * 40 + 40;
      card.style.transform = `translateX(${offsetX}px) translateY(${offsetY}px) rotate(${angle}deg)`;
      card.style.zIndex = i;
    });

    // 收拢回牌堆
    setTimeout(() => {
      cards.forEach((card, i) => {
        card.classList.remove('fanned');
        card.classList.add('stacked');
        card.style.transform = '';
        card.style.top = -(i * 2) + 'px';
        card.style.left = (i * 1.2) + 'px';
      });

      setTimeout(() => {
        cards.forEach(c => c.classList.remove('stacked'));
        state.phase = 'shuffled';
        unlockUI();
      }, 650);
    }, 1200);
  }

  /* ===== 切牌 ===== */
  function handleCut() {
    if (state.animating || state.phase !== 'shuffled') return;
    lockUI();

    const cards = deckStack.querySelectorAll('.deck-card');
    const cutIndex = Math.floor(cards.length / 2);

    cards.forEach((card, i) => {
      card.classList.remove('fanned', 'stacked');
      if (i >= cutIndex) {
        card.classList.add('cut-top');
      } else {
        card.classList.add('cut-bottom');
      }
    });

    // 随机切牌位置（对牌组数组）
    const cutPos = Math.floor(Math.random() * (state.deck.length - 10)) + 5;
    const top = state.deck.splice(cutPos);
    state.deck = [...top, ...state.deck];

    setTimeout(() => {
      cards.forEach(c => {
        c.classList.remove('cut-top', 'cut-bottom');
        c.style.transform = '';
      });
      state.phase = 'cut';
      unlockUI();
    }, 800);
  }

  /* ===== 开始占卜（依次抽3张） ===== */
  function handleStartReading() {
    if (state.animating || state.phase !== 'cut') return;
    state.phase = 'drawing';
    state.drawnCards = state.deck.slice(0, 3);
    state.drawIndex = 0;
    updateButtons();
    drawNextCard();
  }

  function drawNextCard() {
    if (state.drawIndex >= 3) {
      state.phase = 'reading-done';
      updateButtons();
      resetWrapper.style.display = '';
      return;
    }

    lockUI();
    const cardData = state.drawnCards[state.drawIndex];
    const slotIndex = state.drawIndex;
    const slot = $(`#slot${slotIndex}`);
    const placeholder = slot.querySelector('.card-placeholder');

    // 获取 CSS 变量中牌的尺寸
    const rootStyles = getComputedStyle(document.documentElement);
    const cardW = parseInt(rootStyles.getPropertyValue('--card-w'));
    const cardH = parseInt(rootStyles.getPropertyValue('--card-h'));

    // 创建飞行牌
    const flyCard = document.createElement('div');
    flyCard.className = 'deck-card';
    flyCard.style.width = cardW + 'px';
    flyCard.style.height = cardH + 'px';

    const img = document.createElement('img');
    img.src = CARD_BACK_IMAGE;
    img.alt = cardData.nameCN;
    img.draggable = false;
    flyCard.appendChild(img);

    // 获取起始位置（牌堆中心）
    const deckRect = deckStack.getBoundingClientRect();
    const startX = deckRect.left + deckRect.width / 2 - cardW / 2;
    const startY = deckRect.top + deckRect.height / 2 - cardH / 2;

    // 获取目标位置
    const slotRect = placeholder.getBoundingClientRect();
    const endX = slotRect.left;
    const endY = slotRect.top;

    // 设置飞行卡起始位
    flyCard.style.position = 'fixed';
    flyCard.style.left = startX + 'px';
    flyCard.style.top = startY + 'px';
    flyCard.style.zIndex = '200';
    flyCard.style.transition = 'none';
    document.body.appendChild(flyCard);

    // 强制回流后飞入
    void flyCard.offsetHeight;
    flyCard.style.transition = 'all 0.85s cubic-bezier(0.22, 1, 0.36, 1)';
    flyCard.style.left = endX + 'px';
    flyCard.style.top = endY + 'px';
    flyCard.style.boxShadow = '0 0 30px rgba(201, 168, 76, 0.6), 0 0 60px rgba(201, 168, 76, 0.2)';

    setTimeout(() => {
      if (flyCard.parentNode) document.body.removeChild(flyCard);
      placeFlipper(slot, cardData, slotIndex);
      state.drawIndex++;
      unlockUI();
      setTimeout(() => drawNextCard(), 300);
    }, 900);
  }

  /* 在牌位放置可翻转牌 */
  function placeFlipper(slot, cardData, slotIndex) {
    const placeholder = slot.querySelector('.card-placeholder');
    placeholder.style.display = 'none';

    const flipContainer = document.createElement('div');
    flipContainer.className = 'placed-card';
    flipContainer.setAttribute('data-card-id', cardData.id);

    const inner = document.createElement('div');
    inner.className = 'flip-card-inner';

    // 正面（牌背）
    const front = document.createElement('div');
    front.className = 'flip-card-front';
    const frontImg = document.createElement('img');
    frontImg.src = CARD_BACK_IMAGE;
    frontImg.alt = '牌背';
    frontImg.draggable = false;
    front.appendChild(frontImg);

    // 背面（牌面）
    const back = document.createElement('div');
    back.className = 'flip-card-back';
    const backImg = document.createElement('img');
    backImg.src = cardData.image;
    backImg.alt = cardData.nameCN;
    backImg.loading = 'lazy';
    backImg.draggable = false;
    back.appendChild(backImg);

    inner.appendChild(front);
    inner.appendChild(back);
    flipContainer.appendChild(inner);

    // 点击翻牌
    flipContainer.addEventListener('click', function handler() {
      if (inner.classList.contains('flipped')) return;
      inner.classList.add('flipped');
      state.flippedCount++;
      flipContainer.removeEventListener('click', handler);
      showInterpretation(cardData, slotIndex);
    });

    slot.insertBefore(flipContainer, slot.querySelector('.slot-label'));
  }

  /* ===== 牌义展示 ===== */
  function showInterpretation(cardData, slotIndex) {
    const positions = ['过去', '现在', '未来'];
    const posLabel = positions[slotIndex];

    const html = `
      <div class="interp-card">
        <div class="interp-position">${posLabel} · 揭牌</div>
        <div class="interp-name">${cardData.nameCN}（${cardData.name}）</div>
        <div class="interp-keywords">${cardData.keywordsCN}</div>
      </div>
    `;

    // 桌面端侧边栏
    const desktopContent = $('#interpretationContent');
    if (desktopContent.querySelector('.interpretation-placeholder')) {
      desktopContent.innerHTML = '';
    }
    desktopContent.insertAdjacentHTML('beforeend', html);

    // 移动端面板
    const mobileContent = $('#interpretationContentMobile');
    if (mobileContent.querySelector('.interpretation-placeholder')) {
      mobileContent.innerHTML = '';
    }
    mobileContent.insertAdjacentHTML('beforeend', html);
  }

  /* ===== 重置 ===== */
  function handleReset() {
    state.phase = 'idle';
    state.deck = [];
    state.drawnCards = [];
    state.drawIndex = 0;
    state.flippedCount = 0;
    state.animating = false;

    resetWrapper.style.display = 'none';
    buildDeckStack();
    resetSlots();

    // 清空解读
    $('#interpretationContent').innerHTML = '<p class="interpretation-placeholder">抽牌后将在此显示解读...</p>';
    $('#interpretationContentMobile').innerHTML = '<p class="interpretation-placeholder">抽牌后将在此显示解读...</p>';

    updateButtons();
  }

  function resetSlots() {
    for (let i = 0; i < 3; i++) {
      const slot = $(`#slot${i}`);
      const existing = slot.querySelector('.placed-card');
      if (existing) existing.remove();
      const placeholder = slot.querySelector('.card-placeholder');
      if (placeholder) placeholder.style.display = '';
    }
  }

  /* ===== 截图功能（html2canvas） ===== */
  function handleScreenshot() {
    if (typeof html2canvas === 'undefined') {
      alert('截图组件加载中，请稍后再试...');
      return;
    }
    const target = $('main');
    html2canvas(target, {
      backgroundColor: '#0f0a1a',
      scale: 2,
      useCORS: true,
      logging: false
    }).then(canvas => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '塔罗占卜_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    }).catch(() => {
      alert('截图失败，请使用系统截图工具（Win+Shift+S）');
    });
  }

  /* ===== 启动 ===== */
  document.addEventListener('DOMContentLoaded', init);
})();
