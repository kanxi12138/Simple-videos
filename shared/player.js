(function registerPlayer(root) {
  'use strict';

  // These selectors describe official page controls, not media URLs or entitlements.
  const adapters = {
    tencent: {
      containers: ['#mod_player', '#player', '.txp_player'],
      qualities: ['.txp_menuitem', '.txp_quality_list [role="menuitem"]', '.txp_quality_list li'],
      qualityTrigger: ['.txp_btn_quality'],
      episodes: ['.mod_episode a', '.episode-list a', '.mod_playlist a', '.episode-list [role="button"]'],
      episodeRegions: ['#module-pc_web_episode_list_sec', '.main-episode-list-container > .episode-module-container:has(.tab-node-container)',
        '.player-playlist__container', '.mod_episode', '.episode-list', '.mod_playlist'],
      episodeFull: '#module-pc_web_episode_list_sec',
      episodeScroll: ['.virtual-list-container', '.video-list__container'],
      episodeNodes: ['.video-item-wrapper', '[data-video-idx]', '.episode-item'],
      episodeTitle: '.video-item-right-main, .episode-item-title',
      episodeGroups: ['.tab-header', '.tab-node-container .tab-node'],
      episodeMore: ['.module-bottom-view-more-btn'],
      ad: ['.txp_ad', '.txp_ad_countdown'],
      bars: ['.txp_top', '.txp_bottom', '.txp_title', '.txp_controlbar', '.plugin_ctrl_txp_bottom', '.txp_controls'],
      pauseAds: ['.creative-player-pause-layer', '.creative-player-pause-container', '.creative-player-pause-picture-container',
        '.txp_full_screen_pause-bg', '.txp_full_screen_pause-material-container', '.txp_full_screen_pause-player-mask'],
      interaction: ['.txp_popup', '.txp_menu', '.txp_quality_list', '.txp_progress', '.txp_btn'],
      protected: ['.txp_ad', '.txp_ad_countdown', '.txp_vip', '.txp_trial', '.txp_error', '.txp_warning'],
      settings: ['.txp_btn_settings', '.txp_btn_setting'],
      panels: ['.txp_settings', '.txp_setting_panel', '.txp_popup_settings'],
      menus: ['.txp_popup', '.txp_menu', '.txp_quality_list'],
      fullscreen: ['.txp_btn_fullscreen', '.txp_btn_fullscreenexit'],
    },
    iqiyi: {
      containers: ['#flashbox', '#iqiyi-player', '.iqp-player'],
      qualities: ['.iqp-quality-list li', '.iqp-quality-list [role="menuitem"]', '[data-player-hook="qualityItem"]'],
      qualityTrigger: ['.iqp-btn-quality', '[data-player-hook="quality"]'],
      episodes: ['.album-item a', '.episode-list a', '[data-playlist-albumitem] a', '.album-list a'],
      episodeRegions: ['[data-ai-entity="选集二级页"] [class*="superAlbumEpisodes_contentWrapper"]',
        '[class*="superAlbumEpisodes_contentWrapper"]', '.album-list', '.episode-list', '[data-playlist-albumitem]'],
      episodeFull: '[data-ai-entity="选集二级页"]',
      episodeScroll: ['[class*="episodesNew_episodeContent"]', '[class*="list_list"]'],
      episodeNodes: ['[class*="episodesNew_item"]', '[class*="list_list"] > div > div', '.album-item'],
      episodeTitle: '[id="text"], [class*="episodeTitle"], [class*="videoTitle"], [class*="titleText"]',
      episodeGroups: ['[role="tab"]', '[class*="superAlbumEpisodes"] [class*="tab"] [role="button"]'],
      episodeMore: ['[class*="checkMoreBtn"]', '[class*="superAlbumEpisodes_more"]'],
      ad: ['.iqp-ad', '.iqp-ad-countdown'],
      bars: ['.iqp-top', '.iqp-top-bar', '.iqp-bottom', '.iqp-bottom-bar', '.iqp-control-bar', '.iqp-title'],
      pauseAds: ['.iqp-player .common-pause', '.flash-max1:has(.pause-main)',
        '.flash-max1 .pause-main', '.flash-max1 .pause-max-close-area'],
      interaction: ['.iqp-menu', '.iqp-popup', '.iqp-progress', '.iqp-btn', '[data-player-hook="quality"]'],
      protected: ['.iqp-ad', '.iqp-ad-countdown', '.iqp-vip', '.iqp-trial', '.iqp-error', '.iqp-pay'],
      settings: ['.iqp-btn-setting', '.iqp-btn-settings', '[data-player-hook="setting"]'],
      panels: ['.iqp-setting-panel', '.iqp-settings-panel', '[data-player-hook="settingPanel"]'],
      menus: ['.iqp-menu', '.iqp-popup', '.iqp-quality-list'],
      fullscreen: ['.iqp-btn-fullscreen', '.iqp-btn-exitfullscreen', '[data-player-hook="fullscreen"]'],
    },
    youku: {
      containers: ['#player', '#ykPlayer', '.youku-player'],
      qualities: ['.kui-quality-list li', '.kui-quality-menu li', '.kui-quality-item'],
      qualityTrigger: ['.kui-quality', '.kui-quality-button'],
      episodes: ['.anthology-list a', '.episode-list a', '.anthology-content a', '[data-spm="episode"] a'],
      episodeRegions: ['.anthology-list-container', '.anthology-container', '.anthology-content', '.anthology-list', '.episode-list'],
      episodeFull: '.anthology-list-container',
      episodeScroll: ['.box-anthology-items', '.anthology-list-container'],
      episodeNodes: ['.box-anthology-item'],
      episodeTitle: '.box-stage',
      episodeGroups: ['.anthology-stageTabs-list > a', '[role="tab"]'],
      episodeMore: ['.anthology-more'],
      ad: ['.kui-ad-countdown', '.kui-advertise'],
      // Current Youku controls use an instance suffix (for example, kui-top-0).
      bars: ['.kui-topbar', '.kui-title', '.kui-control-bar', '.kui-bottom-bar', 'top[class*="kui-top-"]',
        'top-layer[class*="kui-top-"]', '.kui-toplayer-title',
        '.kui-dashboard-timer-container', '.kui-dashboard-bar-container',
        '.kui-dashboard-dashboard-panel', '.kui-dashboard-dashboard-background'],
      hoverTargets: ['#youku-dashboard'],
      pauseAds: ['#youku-pause-container'],
      interaction: ['.kui-menu', '.kui-panel', '.kui-quality', '.kui-progress', '.kui-button', '.kui-btn',
        '.dashboard-control', '.control-btn', '.control-container', '[class*="kui-player-progressbar-"]'],
      protected: ['.kui-ad-countdown', '.kui-advertise', '.kui-vip', '.kui-pay', '.kui-trial', '.kui-error', '.kui-notice'],
      settings: ['.kui-setting', '.kui-settings', '.kui-setting-button', '.kui-settings-button',
        '.dashboard-control[class*="kui-settings-"]', '[class*="kui-setting-icon-"]'],
      panels: ['.kui-setting-panel', '.kui-settings-panel', '.kui-setting-menu', '.kui-settings-menu',
        '.kui-settings-settings-container'],
      menus: ['.kui-menu', '.kui-panel', '.kui-quality-list', '.kui-quality-menu'],
      touchPanel: '.kui-settings-settings-container',
      fullscreen: ['.kui-fullscreen', '.kui-fullscreen-button', '.kui-fullscreen-icon', '.kui-exitfullscreen',
        '.kui-fullscreen-exit', '[class*="kui-fullscreen-icon-"]', '[class*="kui-fullscreen2-icon-"]',
        '[class*="kui-webfullscreen-icon-"]', '[class*="kui-webfullscreen2-icon-"]'],
    },
    mango: {
      containers: ['#mgtv-player-wrap', '#mgtv-player', '#mgtvPlayer', '#player', '.mgtv-player'],
      qualities: ['.mgtv-quality-list li', '.vjs-resolution-menu li', '.mgtv-quality-item'],
      qualityTrigger: ['.mgtv-quality', '.vjs-resolution-button'],
      episodes: ['.episode-list a', '.playlist a', '.list-video a', '.anthology-list a'],
      episodeRegions: ['.mgtv-player-aside-drawer__content .mgtv-player-aside-video-selector',
        '.mgtv-player-aside-video-selector', '.episode-list', '.playlist', '.list-video', '.anthology-list'],
      episodeFull: '.mgtv-player-aside-drawer__content',
      episodeScroll: ['.mgtv-drawer__body'],
      episodeNodes: ['.mgtv-player-aside-image-selector__card', '.mgtv-player-aside-number-selector__item'],
      episodeTitle: '.mgtv-player-aside-image-selector__title, .mgtv-player-aside-number-selector__number',
      episodeGroups: ['.mgtv-player-aside-overflow-tabs__items > button'],
      episodeMore: ['.mgtv-player-aside-video-selector__overflow-btn'],
      ad: ['.mgtv-ad-countdown', '.mgtv-ad', '.mango-ad-layer .as_paster_video'],
      bars: ['.mgtv-control-bar', '.mgtv-player-title', '.mgtv-player-top', '.vjs-control-bar', '.vjs-title-bar',
        '.mango-control-bar .ControlBar', '.mango-control-bar [class*="_ControlBarShadow_"]'],
      pauseAds: ['.mango-ad-layer .as_stage-item:has(.as-pause_container)',
        '.mango-ad-layer .as_stage-item:has(.as-pause-full_container)', '.as-pause_container', '.as-pause-full_container'],
      pauseClose: '.as-pause-full_close, .as-pause_container .as_close-button',
      interaction: ['.mgtv-menu', '.mgtv-progress', '.vjs-menu', '.vjs-slider', '.vjs-button',
        '.mango-control-bar .ActionItem', '.mango-control-bar [class*="_ActionItem_"]',
        '.mango-control-bar [class*="_ProgressBar_"]'],
      protected: ['.mgtv-ad-countdown', '.mgtv-ad', '.mgtv-vip', '.mgtv-trial', '.mgtv-error', '.vjs-error-display',
        '.mango-ad-layer', 'mango-vip-dialog'],
      settings: ['.mgtv-setting', '.mgtv-settings-button', '.vjs-settings-button'],
      panels: ['.mgtv-setting-panel', '.mgtv-settings-panel', '.vjs-settings-menu', '.mango-control-bar [class*="_settingsWrap_"]'],
      menus: ['.mgtv-menu', '.mgtv-quality-list', '.vjs-menu',
        '.mango-control-bar [class*="_PopoverContainer_"]', '.mango-control-bar [class*="_settingWrap_"]'],
      fullscreen: ['.mgtv-fullscreen', '.mgtv-fullscreen-button', '.vjs-fullscreen-control'],
    },
    migu: {
      containers: ['#mod-player', '#migu-player', '#video-player', '#player', '.migu-player', '.video-player'],
      qualities: ['.quality-list li', '.definition-list li', '.vjs-resolution-menu li'],
      qualityTrigger: ['.quality-button', '.definition-button', '.vjs-resolution-button'],
      episodes: ['.episode-list a', '.episode-list button', '.series-list a', '.playlist a'],
      episodeRegions: ['.episode-expand-panel', '.tv-episode', '.episode-list', '.series-list', '.playlist'],
      episodeFull: '.episode-expand-panel:not(.episode-expand-panel--hidden)',
      episodeScroll: ['.episode-grid', '.episode-expand-panel'],
      episodeNodes: ['.episode-card'],
      episodeTitle: '.episode-num',
      episodeGroups: ['[role="tab"]', '.episode-tabs button'],
      episodeMore: ['.view-all-btn'],
      ad: ['.ad-countdown', '.advertisement-countdown'],
      bars: ['.migu-player-controls', '.migu-player-title', '.video-control-bar', '.video-title-bar', '.vjs-control-bar',
        '.vjs-title-bar', '.control-wrapper'],
      pauseAds: ['.pauseAdFr', '.pauseAdFrame'],
      interaction: ['.quality-list', '.definition-list', '.video-progress', '.vjs-menu', '.vjs-slider', '.vjs-button',
        '.control-btn', '.progress-control', '.subtitle-content'],
      protected: ['.ad-countdown', '.advertisement-countdown', '.migu-vip', '.video-trial', '.video-error', '.vjs-error-display'],
      settings: ['.migu-setting', '.video-settings-button', '.vjs-settings-button'],
      panels: ['.migu-setting-panel', '.video-settings-panel', '.vjs-settings-menu'],
      menus: ['.quality-list', '.definition-list', '.vjs-menu'],
      fullscreen: ['.migu-fullscreen', '.video-fullscreen-button', '.vjs-fullscreen-control'],
    },
  };
  let platformId;
  let compact = false;
  let mediaType = '';
  let savedStyles = new Map();
  let qualityItems = new Map();
  let episodeItems = new Map();
  let episodeGroupItems = new Map();
  let episodeMoreItems = new Map();
  let episodeLocation = '';
  let episodeStartedAt = 0;
  let episodeContext = '';
  let episodeCache = new Map();
  let nextEpisodeId = 0;
  let episodeLoad = null;
  let episodeJump = null;
  let episodeTransition = null;
  let episodeError = '';
  const episodeBranches = new Set();
  const nodeIds = new WeakMap();
  let nextNodeId = 0;
  let lastError = '';
  let viewportMeta;
  let viewportContent;
  let createdViewport = false;
  let fullscreen = false;
  let fullscreenRequest = null;
  let lastFullscreenButton = null;
  let lastFullscreenTap = -Infinity;
  let controlsShown = true;
  let nextFullscreenId = 0;
  const fullscreenBindings = new Map();

  const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const visible = (node) => !!node?.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
  const selected = (node) => /(?:^|[\s_-])(active|current|selected|playing)(?:$|[\s_-])/.test(node.className || '')
    || node.getAttribute('aria-selected') === 'true' || node.getAttribute('aria-current') === 'true'
    || node.getAttribute('aria-current') === 'page';

  function documents() {
    const result = [document];
    for (let index = 0; index < result.length && result.length < 16; index += 1) {
      result[index].querySelectorAll('iframe').forEach((frame) => {
        try { if (frame.contentDocument && !result.includes(frame.contentDocument)) result.push(frame.contentDocument); }
        catch { /* Cross-origin frames are deliberately left to the official page. */ }
      });
    }
    return result;
  }

  function nodes(selectors, docs = documents()) {
    const result = new Set();
    docs.forEach((doc) => selectors.forEach((selector) => doc.querySelectorAll(selector).forEach((node) => result.add(node))));
    return [...result];
  }

  function media() {
    const pauseSelector = adapters[platformId]?.pauseAds.join(',');
    return nodes(['video']).filter((node) => visible(node) && !(compact && pauseSelector && node.closest(pauseSelector))).sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
    })[0] || null;
  }

  function container(video) {
    const config = adapters[platformId];
    if (!config) return null;
    const candidates = nodes(config.containers, [document]).filter(visible);
    const match = candidates.find((node) => video && node.contains(video));
    if (match) return match;
    const frame = candidates.find((node) => node.querySelector('iframe'));
    return frame || null;
  }

  function style(node, values) {
    if (!savedStyles.has(node)) savedStyles.set(node, node.getAttribute('style'));
    Object.entries(values).forEach(([name, value]) => {
      if (node.style.getPropertyValue(name) !== value || node.style.getPropertyPriority(name) !== 'important') {
        node.style.setProperty(name, value, 'important');
      }
    });
  }

  function restoreProperty(node, name) {
    if (!savedStyles.has(node)) return;
    const original = node.ownerDocument.createElement('div').style;
    original.cssText = savedStyles.get(node) || '';
    const value = original.getPropertyValue(name);
    const priority = original.getPropertyPriority(name);
    if (value) {
      if (node.style.getPropertyValue(name) !== value || node.style.getPropertyPriority(name) !== priority) {
        node.style.setProperty(name, value, priority);
      }
    } else if (node.style.getPropertyValue(name)) node.style.removeProperty(name);
  }

  function playerNodes(host, selectors) {
    const config = adapters[platformId];
    const doc = host.ownerDocument;
    const players = nodes(config.containers, [doc]).filter((node) => node.querySelector('video,iframe'));
    const singlePlayer = players.every((node) => node === host || host.contains(node));
    return nodes(selectors, [doc]).filter((node) => {
      if (node === host || node.contains(host)) return false;
      if (host.contains(node)) return true;
      // Only explicit player selectors can claim a portal outside a single player's subtree.
      const owner = node.closest(config.containers.join(','));
      return !owner && singlePlayer;
    });
  }

  function playerTitles(host) {
    const doc = host.ownerDocument;
    const titles = new Set([doc.querySelector('meta[property="og:title"]')?.content, doc.title?.split(' - ')[0]]
      .filter(Boolean).map((value) => value.replace(/\s+/g, ' ').trim().slice(0, 160)));
    const rect = host.getBoundingClientRect();
    const excluded = [...adapters[platformId].protected, ...adapters[platformId].pauseAds,
      ...adapters[platformId].panels, 'a', 'button', '[role="button"]', '[role="alert"]', '[role="dialog"]',
      'mango-danmu-layer', 'mango-player-state', '.iqp-subtitle-cont', '.subtitle-box', '[class*="subtitle"]',
      '[class*="watermark"]', '[class*="Watermark"]'].join(',');
    return [...host.querySelectorAll('*')].filter((node) => {
      // Mango's title lives separately from ControlBar and can differ from the document title.
      const inMangoControls = platformId === 'mango' && node.closest('.mango-control-bar');
      if (node.children.length || !text(node) || (!inMangoControls && !titles.has(text(node))) || node.closest(excluded)) return false;
      if (node.hasAttribute('data-simple-videos-control')) return true;
      const titleRect = node.getBoundingClientRect();
      if (!titleRect.height || titleRect.height > rect.height * 0.2 || titleRect.top < rect.top - 2
        || titleRect.bottom > rect.top + rect.height * 0.2) return false;
      for (let ancestor = node; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
        if (['absolute', 'fixed'].includes(doc.defaultView.getComputedStyle(ancestor).position)) return true;
      }
      return false;
    });
  }

  function blockingAd() {
    const config = adapters[platformId];
    const pause = nodes(config.pauseAds);
    return nodes(config.ad).some((node) => {
      if (!visible(node) || pause.some((overlay) => overlay === node || overlay.contains(node))) return false;
      if (!pause.some((overlay) => node.contains(overlay))) return true;
      // A shared ad host containing only a pause overlay must not disable the content's resume button.
      return [...node.querySelectorAll([...config.ad, 'video', 'iframe'].join(','))].some((child) =>
        visible(child) && !pause.some((overlay) => overlay === child || overlay.contains(child) || child.contains(overlay)));
    });
  }

  function settingsPanels(host) {
    const config = adapters[platformId];
    return nodes([...config.panels, ...(fullscreen ? config.menus : [])], [host.ownerDocument]).filter((panel) => {
      if (panel === host || panel.contains(host) || panel.querySelector('video,iframe')) return false;
      const owner = panel.closest(config.containers.join(','));
      return !owner || owner === host || host.contains(owner);
    });
  }

  function preservePanels(host) {
    const panels = settingsPanels(host);
    panels.forEach((panel) => {
      let ancestor = panel.parentElement;
      while (ancestor) {
        restoreProperty(ancestor, 'display');
        restoreProperty(ancestor, 'overflow');
        ancestor = ancestor.parentElement;
      }
    });
    return panels;
  }

  function restore() {
    clearFullscreen();
    fullscreenRequest = null;
    lastFullscreenButton = null;
    lastFullscreenTap = -Infinity;
    savedStyles.forEach((value, node) => {
      if (value === null) node.removeAttribute('style');
      else node.setAttribute('style', value);
    });
    savedStyles = new Map();
    episodeBranches.clear();
    if (viewportMeta) {
      if (createdViewport) viewportMeta.remove();
      else if (viewportContent === null) viewportMeta.removeAttribute('content');
      else viewportMeta.setAttribute('content', viewportContent);
      viewportMeta = undefined;
    }
  }

  function clearFullscreen() {
    fullscreenBindings.forEach((binding) => binding.dispose());
    fullscreenBindings.clear();
  }

  function bindFullscreen(host) {
    const config = adapters[platformId];
    const id = String(++nextFullscreenId);
    const doc = host.ownerDocument;
    const view = doc.defaultView;
    const sheet = doc.createElement('style');
    const bars = new Map();
    const menus = new Map();
    const pauseAds = new Map();
    let pauseCloseAttempts = new WeakSet();
    let disposed = false;
    let scopedObserver;
    let observedNodes = [];
    const attributeNames = ['data-simple-videos-player', 'data-simple-videos-controls'];
    const previousAttributes = attributeNames.map((name) => host.getAttribute(name));
    const settingsSelector = [...config.settings, '[title*="设置"]', '[aria-label*="设置"]'].join(',');
    const fullscreenSelector = [...config.fullscreen, '[title*="全屏"]', '[aria-label*="全屏"]',
      '[title*="Fullscreen"]', '[aria-label*="Fullscreen"]'].join(',');
    const interactive = ['a', 'button', 'input', 'select', 'textarea', '[role="button"]', '[role="slider"]',
      '[role="menu"]', '[role="dialog"]', '[contenteditable="true"]',
      '[onclick]', '[data-spm-click]',
      ...config.interaction, ...config.qualities, ...config.qualityTrigger,
      settingsSelector, fullscreenSelector].join(',');
    const protectedSelector = [...config.protected, '[role="dialog"]', '[role="alert"]'].join(',');
    const menuButtonSelector = [settingsSelector, ...config.qualityTrigger, '[title*="倍速"]', '[aria-label*="倍速"]',
      '[title*="清晰度"]', '[aria-label*="清晰度"]', '[title*="音量"]', '[aria-label*="音量"]'].join(',');
    let gesture = null;
    let lastTap = -Infinity;
    let nextBarId = 0;
    let nextMenuId = 0;
    let menusClosed = !controlsShown;
    let menuTrigger = null;
    let menuGesture = null;
    let touchMenu = null;
    host.setAttribute(attributeNames[0], id);
    (doc.head || doc.documentElement).append(sheet);

    function refresh() {
      const overlays = playerNodes(host, config.pauseAds);
      const video = media();
      if (video && !video.paused) pauseCloseAttempts = new WeakSet();
      pauseAds.forEach((attribute, node) => {
        if (overlays.includes(node)) return;
        if (attribute === null) node.removeAttribute('data-simple-videos-pause-ad');
        else node.setAttribute('data-simple-videos-pause-ad', attribute);
        pauseAds.delete(node);
      });
      overlays.forEach((node) => {
        if (!pauseAds.has(node)) pauseAds.set(node, node.getAttribute('data-simple-videos-pause-ad'));
        if (node.getAttribute('data-simple-videos-pause-ad') !== id) node.setAttribute('data-simple-videos-pause-ad', id);
        // Only this verified SDK version separates close/unlock from resume; unknown versions are hidden only.
        const close = config.pauseClose && [...doc.scripts].some((script) =>
          script.src.split('?')[0] === 'https://tb.mgtv.com/sdk/pc-sdk/3.4.3/ad-sdk.js')
          && node.querySelector(config.pauseClose);
        if (close && video?.paused && !blockingAd() && !pauseCloseAttempts.has(close)) {
          pauseCloseAttempts.add(close);
          // Mango's verified close handler unlocks pause UI without resuming (unlike its resume tile).
          view.requestAnimationFrame(() => { if (!disposed && close.isConnected && video.paused) close.click(); });
        }
      });
      const protectedNodes = [...host.querySelectorAll([...config.protected, '[role="dialog"]', '[role="alert"]'].join(','))];
      const candidates = [...new Set([...playerNodes(host, config.bars), ...playerTitles(host)])].filter((node) =>
        !node.querySelector('video,iframe') && !protectedNodes.some((prompt) => node === prompt || node.contains(prompt)));
      const activeBars = candidates.filter((node) => !candidates.some((parent) => parent !== node && parent.contains(node)));
      bars.forEach((saved, node) => {
        if (activeBars.includes(node)) return;
        if (saved.attribute === null) node.removeAttribute('data-simple-videos-control');
        else node.setAttribute('data-simple-videos-control', saved.attribute);
        bars.delete(node);
      });
      activeBars.forEach((node) => {
        if (bars.has(node)) return;
        const saved = { attribute: node.getAttribute('data-simple-videos-control'),
          id: `${id}:${++nextBarId}` };
        bars.set(node, saved);
        node.setAttribute('data-simple-videos-control', saved.id);
      });
      const scope = `[data-simple-videos-player="${id}"]`;
      const rules = [`[data-simple-videos-pause-ad="${id}"]{display:none!important;visibility:hidden!important;pointer-events:none!important}`];
      if (fullscreen) rules.push(`${scope},${scope} *{-webkit-tap-highlight-color:transparent!important}`);
      bars.forEach((saved, node) => {
        // Remember a layout actually shown by the site; never invent a display value for hidden widgets.
        const display = view.getComputedStyle(node).display;
        if (display !== 'none') saved.display = display;
        const target = `[data-simple-videos-control="${saved.id}"]`;
        if (!fullscreen) return;
        // Mango slides its known bottom bar below the viewport when inactive; opacity alone cannot reveal it.
        const position = platformId === 'mango' && node.matches('.mango-control-bar .ControlBar')
          ? 'transform:translateY(0)!important;' : '';
        rules.push(controlsShown ? `${target}{${saved.display ? `display:${saved.display}!important;` : ''}${position}opacity:1!important;visibility:visible!important;pointer-events:auto!important}`
          : `${target}{opacity:0!important;visibility:hidden!important;pointer-events:none!important}`);
      });
      const panels = preservePanels(host).filter((panel) => !panel.matches(config.protected.join(','))
        && !panel.querySelector([...config.protected, '[role="alert"]'].join(',')));
      menus.forEach((saved, panel) => {
        if (panels.includes(panel)) return;
        if (saved.attribute === null) panel.removeAttribute('data-simple-videos-menu');
        else panel.setAttribute('data-simple-videos-menu', saved.attribute);
        menus.delete(panel);
      });
      panels.forEach((panel) => {
        if (!menus.has(panel)) menus.set(panel, { attribute: panel.getAttribute('data-simple-videos-menu'), id: `${id}:${++nextMenuId}` });
        const menuId = menus.get(panel).id;
        if (panel.getAttribute('data-simple-videos-menu') !== menuId) panel.setAttribute('data-simple-videos-menu', menuId);
      });
      const allowedMenus = menuTrigger?.isConnected ? relatedPanels(menuTrigger) : [];
      if (fullscreen && touchMenu?.isConnected && (!menusClosed || allowedMenus.includes(touchMenu))) {
        // This is Youku's existing block-layout settings panel, not a replacement menu.
        rules.push(`[data-simple-videos-menu="${menus.get(touchMenu)?.id}"]${config.touchPanel}{display:block!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important}`);
      }
      if (fullscreen && menusClosed) menus.forEach((saved, panel) => {
        if (controlsShown && allowedMenus.some((allowed) => panel === allowed || panel.contains(allowed))) return;
        rules.push(`[data-simple-videos-menu="${saved.id}"]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}`);
      });
      const css = rules.join('\n');
      if (sheet.textContent !== css) sheet.textContent = css;
      const state = fullscreen ? (controlsShown ? 'visible' : 'hidden') : 'official';
      if (host.getAttribute(attributeNames[1]) !== state) host.setAttribute(attributeNames[1], state);
      const watchNodes = [...new Set([...bars.keys(), ...menus.keys(), ...pauseAds.keys(), ...protectedNodes])]
        .filter((node) => node.isConnected);
      if (scopedObserver && (watchNodes.length !== observedNodes.length
        || watchNodes.some((node) => !observedNodes.includes(node)))) {
        scopedObserver.disconnect();
        scopedObserver.observe(host, { attributes: true, attributeFilter: ['class', 'style'] });
        watchNodes.forEach((node) => scopedObserver.observe(node, { childList: true, subtree: true,
          characterData: true, attributes: true, attributeFilter: ['class', 'style'] }));
        observedNodes = watchNodes;
      }
    }

    function hit(target, selector) {
      if (!target || target.nodeType !== 1 || (!host.contains(target)
        && ![...bars.keys(), ...menus.keys()].some((node) => node.contains(target)))) return null;
      let node = target;
      while (node && node !== host) {
        // Focusable/clickable video wrappers are not controls themselves.
        if (node.matches(selector) && !node.querySelector('video,iframe') && node.tagName !== 'VIDEO') return node;
        node = node.parentElement;
      }
      return null;
    }

    function surface(node) {
      if (node === host || node.tagName === 'VIDEO' || node.querySelector('video,iframe')) return true;
      const rect = node.getBoundingClientRect();
      const playerRect = host.getBoundingClientRect();
      return rect.width >= playerRect.width * 0.8 && rect.height >= playerRect.height * 0.5;
    }

    function menuKind(node) {
      const label = `${node.className} ${node.getAttribute('title') || ''} ${node.getAttribute('aria-label') || ''} ${text(node)}`;
      if (/setting|设置/i.test(label)) return 'settings';
      if (/playrate|speed|倍速|\b\d+(?:\.\d+)?\s*x\b/i.test(label)) return 'speed';
      if (/quality|clarity|definition|清晰|蓝光|超清|\b\d{3,4}p\b/i.test(label)) return 'quality';
      if (/volume|音量/i.test(label)) return 'volume';
      return null;
    }

    function relatedPanels(trigger) {
      const panels = [...menus.keys()];
      const controlled = (trigger.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean);
      const direct = panels.filter((panel) => controlled.includes(panel.id));
      if (direct.length) return direct;
      for (let node = trigger; node && node !== host && !bars.has(node); node = node.parentElement) {
        if (surface(node)) break;
        const owned = panels.filter((panel) => node.contains(panel) && !panel.contains(trigger));
        if (owned.length) return owned;
      }
      const kind = menuKind(trigger);
      return panels.filter((panel) => kind && (menuKind(panel) === kind
        || kind === 'settings' && panel.matches(config.panels.join(','))));
    }

    function menuButton(target) {
      if ([...menus.keys()].some((panel) => panel.contains(target))) return null;
      const trigger = hit(target, menuButtonSelector) || hit(target, interactive);
      if (!trigger || surface(trigger)) return null;
      return relatedPanels(trigger).length || menuKind(trigger) ? trigger : null;
    }

    function menuVisible(panel) {
      if (!visible(panel)) return false;
      for (let node = panel; node; node = node.parentElement) {
        const computed = view.getComputedStyle(node);
        if (computed.visibility === 'hidden' || Number(computed.opacity) === 0) return false;
      }
      return true;
    }

    function closeMenus() {
      // The verified Mango Popover owns mouseleave; never click a site's unknown close/resume action.
      if (platformId === 'mango') {
        const popovers = new Set([...menus.keys()].map((panel) => panel.closest('.mango-control-bar [class*="_Popover_"]')).filter(Boolean));
        popovers.forEach((node) => node.dispatchEvent(new view.MouseEvent('mouseleave')));
      }
      menusClosed = true;
      menuTrigger = null;
      menuGesture = null;
      touchMenu = null;
    }

    function blank(target) {
      if (!fullscreen || !target || target.nodeType !== 1 || !host.contains(target) || !bars.size) return false;
      if (hit(target, protectedSelector) || [...menus.keys()].some((panel) => panel.contains(target))) return false;
      for (let node = target; node && node !== host; node = node.parentElement) {
        if (node.matches('a,button,input,select,textarea,[role="slider"],[role="menuitem"]')) return false;
        // Only actual controls block a tap; the full-size hit surface and control backgrounds do not.
        if (surface(node) || bars.has(node)) continue;
        if (node.matches('[role="button"]') || node.matches(interactive) && !node.querySelector(interactive)) return false;
      }
      return true;
    }

    function showOfficialControls() {
      // Dispatch from the actual video too: bubbling reaches inner player UI listeners, unlike the outer host.
      const targets = [...new Set([host, ...host.querySelectorAll('video'),
        ...(config.hoverTargets ? host.querySelectorAll(config.hoverTargets.join(',')) : [])])];
      targets.forEach((target) => {
        const rect = target.getBoundingClientRect();
        const position = { clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
        target.dispatchEvent(new view.MouseEvent('mouseover', { bubbles: true, ...position }));
        target.dispatchEvent(new view.MouseEvent('mouseenter', position));
        target.dispatchEvent(new view.MouseEvent('mousemove', { bubbles: true, ...position }));
      });
    }

    function block(event) {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    }

    function handle(event) {
      const fullButton = hit(event.target, fullscreenSelector);
      if (event.type === 'click' && fullButton) {
        if ((fullButton !== lastFullscreenButton || performance.now() - lastFullscreenTap >= 700)
          && fullscreenRequest === null) fullscreenRequest = !fullscreen;
        block(event);
        return;
      }
      const menuTarget = event.target?.nodeType === 1 && menuButton(event.target);
      const trigger = menuTarget && (fullscreen || menuTarget.matches(settingsSelector)) ? menuTarget : null;
      if (trigger && (event.type === 'pointerdown' || event.type === 'click')) {
        const wasOpen = event.type === 'click' && menuGesture?.trigger === trigger
          ? menuGesture.wasOpen : relatedPanels(trigger).some(menuVisible);
        menuGesture = event.type === 'pointerdown' ? { trigger, wasOpen } : null;
        menusClosed = true;
        menuTrigger = trigger;
        controlsShown = true;
        refresh();
        if (event.type === 'pointerdown') return;
        // Let the site's click run first, then support panels that only listen for hover.
        view.requestAnimationFrame(() => {
          if (disposed || !compact || menuTrigger !== trigger || !host.isConnected || !fullscreenBindings.has(host)) return;
          preservePanels(host);
          refresh();
          const opened = relatedPanels(trigger).some(menuVisible);
          const hover = trigger.closest('.mango-control-bar [class*="_Popover_"]')
            || trigger.querySelector('.mango-control-bar [class*="_Popover_"]')
            || (trigger.matches(settingsSelector) ? trigger : null);
          if (!opened && !wasOpen && hover) {
            hover.dispatchEvent(new view.MouseEvent('mouseover', { bubbles: true }));
            hover.dispatchEvent(new view.MouseEvent('mouseenter'));
            if (fullscreen && config.touchPanel && trigger.matches(settingsSelector)) {
              touchMenu = relatedPanels(trigger).find((panel) => panel.matches(config.touchPanel));
            }
          } else if (opened && wasOpen && hover && trigger.matches(settingsSelector)) {
            hover.dispatchEvent(new view.MouseEvent('mouseout', { bubbles: true }));
            hover.dispatchEvent(new view.MouseEvent('mouseleave'));
            closeMenus();
          }
          refresh();
        });
        return;
      }
      if (event.type === 'pointerdown') {
        if (!event.isPrimary) { if (gesture) gesture.valid = false; return; }
        if (event.button !== 0 || (!fullButton && !blank(event.target))) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(),
          button: fullButton, valid: true };
        event.stopImmediatePropagation();
      } else if (event.type === 'pointermove' && gesture?.id === event.pointerId) {
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.valid = false;
        if (gesture.valid) event.stopImmediatePropagation();
      } else if (event.type === 'pointerup' && gesture?.id === event.pointerId) {
        const tap = gesture.valid && performance.now() - gesture.time <= 350
          && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 10
          && (gesture.button ? fullButton === gesture.button : blank(event.target));
        const button = gesture.button;
        gesture = null;
        if (!tap) return;
        lastTap = performance.now();
        if (button) {
          lastFullscreenButton = button;
          lastFullscreenTap = lastTap;
          if (fullscreenRequest === null) fullscreenRequest = !fullscreen;
        } else {
          fullscreenBindings.forEach((binding) => binding.closeMenus());
          controlsShown = !controlsShown;
          if (controlsShown) showOfficialControls();
        }
        fullscreenBindings.forEach((binding) => binding.refresh());
        block(event);
      } else if (event.type === 'pointercancel' || event.type === 'blur') {
        gesture = null;
        menuGesture = null;
      } else if (event.type === 'touchstart' && event.touches.length > 1) {
        if (gesture) gesture.valid = false;
      } else if (fullButton || blank(event.target)) {
        // Block compatibility touch/mouse events too; desktop sites can listen to both families.
        if (fullButton === lastFullscreenButton && performance.now() - lastFullscreenTap < 700
          && event.type !== 'touchstart') block(event);
        else if (performance.now() - lastTap < 700 && event.type !== 'touchstart') block(event);
        else if (gesture?.valid) event.stopImmediatePropagation();
      }
    }

    const eventNames = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove',
      'touchend', 'mousedown', 'mouseup', 'click', 'dblclick', 'blur'];
    eventNames.forEach((name) => view.addEventListener(name, handle, { capture: true, passive: false }));
    let refreshFrame = null;
    function scheduleRefresh() {
      if (refreshFrame !== null || disposed) return;
      refreshFrame = view.requestAnimationFrame(() => { refreshFrame = null; if (!disposed) refresh(); });
    }
    scopedObserver = new view.MutationObserver(scheduleRefresh);
    scopedObserver.observe(host, { attributes: true, attributeFilter: ['class', 'style'] });
    const discoverySelector = [...config.containers, ...config.bars, ...config.panels, ...config.menus, ...config.pauseAds,
      ...config.protected, 'video', 'iframe'].join(',');
    const observer = new view.MutationObserver((records) => {
      if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some((node) =>
        node.nodeType === 1 && node !== sheet && (node.matches(discoverySelector)
          || node.querySelector(discoverySelector))))) scheduleRefresh();
    });
    // Discovery sees structural changes only; attribute/text animation stays scoped to official UI.
    observer.observe(doc.body || host, { childList: true, subtree: true });
    if (fullscreen && controlsShown) showOfficialControls();
    refresh();
    return { refresh, closeMenus, dispose() {
      disposed = true;
      observer.disconnect();
      scopedObserver.disconnect();
      if (refreshFrame !== null) view.cancelAnimationFrame(refreshFrame);
      eventNames.forEach((name) => view.removeEventListener(name, handle, true));
      bars.forEach((saved, node) => {
        if (saved.attribute === null) node.removeAttribute('data-simple-videos-control');
        else node.setAttribute('data-simple-videos-control', saved.attribute);
      });
      menus.forEach((saved, panel) => {
        if (saved.attribute === null) panel.removeAttribute('data-simple-videos-menu');
        else panel.setAttribute('data-simple-videos-menu', saved.attribute);
      });
      pauseAds.forEach((attribute, node) => {
        if (attribute === null) node.removeAttribute('data-simple-videos-pause-ad');
        else node.setAttribute('data-simple-videos-pause-ad', attribute);
      });
      attributeNames.forEach((name, index) => {
        if (previousAttributes[index] === null) host.removeAttribute(name);
        else host.setAttribute(name, previousAttributes[index]);
      });
      sheet.remove();
    } };
  }

  function syncFullscreen() {
    if (!compact) { clearFullscreen(); return; }
    const candidates = nodes(adapters[platformId].containers).filter((node) => node.querySelector('video,iframe'));
    const hosts = candidates.filter((node) => !candidates.some((parent) => parent !== node && parent.contains(node)));
    fullscreenBindings.forEach((binding, host) => {
      if (hosts.includes(host) && host.isConnected) return;
      binding.dispose();
      fullscreenBindings.delete(host);
    });
    hosts.forEach((host) => {
      if (!fullscreenBindings.has(host)) fullscreenBindings.set(host, bindFullscreen(host));
      else fullscreenBindings.get(host).refresh();
    });
  }

  function layout() {
    if (!compact) return;
    const video = media();
    const host = container(video);
    if (!host) return;
    const panels = [...settingsPanels(host), ...playerNodes(host, adapters[platformId].bars)]
      .filter((node) => !node.querySelector('video,iframe'));
    const regions = nodes(adapters[platformId].episodeRegions, [document]);
    // Keep lists laid out behind the opaque player, inside the viewport for lazy/virtual rendering.
    episodeBranches.forEach((node) => {
      if (node.isConnected && regions.some((region) => node === region || node.contains(region))) return;
      ['display', 'position', 'left', 'top', 'width', 'height', 'overflow', 'pointer-events', 'z-index']
        .forEach((name) => restoreProperty(node, name));
      episodeBranches.delete(node);
    });
    regions.forEach((region) => {
      let ancestor = region.parentElement;
      while (ancestor) { restoreProperty(ancestor, 'display'); ancestor = ancestor.parentElement; }
    });
    if (!viewportMeta) {
      viewportMeta = document.querySelector('meta[name="viewport"]');
      createdViewport = !viewportMeta;
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.append(viewportMeta);
      }
      viewportContent = viewportMeta.getAttribute('content');
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1');
    }
    // Hide only siblings outside the player; preserve all of its permission/ad overlays.
    let branch = host;
    while (branch.parentElement) {
      const parent = branch.parentElement;
      [...parent.children].filter((node) => node !== branch && !panels.some((panel) => node === panel || node.contains(panel))
        && !['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD'].includes(node.tagName))
        .forEach((node) => {
          if (regions.some((region) => node === region || node.contains(region))) {
            restoreProperty(node, 'display');
            style(node, { position: 'fixed', left: '0', top: '0', width: '100vw',
              height: '100vh', overflow: 'auto', 'pointer-events': 'none', 'z-index': '0' });
            episodeBranches.add(node);
          } else style(node, { display: 'none' });
        });
      style(parent, { width: '100%', height: '100%', margin: '0', padding: '0', 'min-width': '0', 'min-height': '0', overflow: 'hidden' });
      branch = parent;
      if (branch === document.documentElement) break;
    }
    preservePanels(host);
    panels.filter((panel) => !host.contains(panel)).forEach((panel) => {
      let ancestor = panel;
      while (ancestor) { restoreProperty(ancestor, 'display'); ancestor = ancestor.parentElement; }
    });
    style(host, { position: 'fixed', inset: '0', width: '100%', height: '100%', 'max-width': 'none',
      'max-height': 'none', 'min-width': '0', margin: '0', padding: '0', background: '#000', 'z-index': '1' });
    host.querySelectorAll('iframe').forEach((frame) => style(frame, { width: '100%', height: '100%', border: '0' }));
    if (video && host.contains(video)) {
      // Desktop player wrappers can retain fixed sizes after the WebView rotates.
      let wrapper = video.parentElement;
      while (wrapper && wrapper !== host) {
        style(wrapper, { width: '100%', height: '100%', 'min-width': '0', 'min-height': '0',
          'max-width': 'none', 'max-height': 'none', margin: '0', padding: '0' });
        wrapper = wrapper.parentElement;
      }
      style(video, { width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none', 'object-fit': 'contain' });
    }
  }

  function options(kind) {
    const config = adapters[platformId];
    const items = new Map();
    const labels = new Set();
    nodes(config[kind]).forEach((node) => {
      const label = text(node);
      if (!label || labels.has(label)) return;
      if (kind === 'qualities' && !/自动|流畅|标清|高清|超清|蓝光|原画|[248]K|\d{3,4}\s*[pP]|HDR|杜比/i.test(label)) return;
      if (!nodeIds.has(node)) nodeIds.set(node, String(++nextNodeId));
      const id = `${kind}:${nodeIds.get(node)}`;
      items.set(id, node);
      labels.add(label);
    });
    qualityItems = items;
    return [...items].slice(0, 24).map(([id, node]) => ({
      id, label: text(node), selected: selected(node), disabled: node.matches('[disabled],[aria-disabled="true"]'),
      paid: /VIP|会员|付费|购买/i.test(text(node) + (node.getAttribute('title') || '') + node.className),
    }));
  }

  function episodeNodes(region, selectors) {
    const candidates = nodes(selectors, [region]);
    return candidates.filter((node) => !node.closest('.history-popup,.history-item,[class*="__measure"]'))
      .filter((node) => !candidates.some((parent) => parent !== node && parent.contains(node)))
      .sort((left, right) => left.compareDocumentPosition(right) & 2 ? 1 : -1);
  }

  function episodeOption(node, kind, label, items) {
    if (!nodeIds.has(node)) nodeIds.set(node, String(++nextNodeId));
    const id = `${kind}:${nodeIds.get(node)}`;
    items.set(id, node);
    return { id, label, selected: episodeSelected(node) || !!node.querySelector(
      '.selected,.active,.playing,[aria-current="true"],[aria-current="page"],[class*="playingFlag"]'),
    disabled: node.matches('[disabled],[aria-disabled="true"]'),
    paid: /VIP|会员|付费|购买/i.test(text(node) + (node.getAttribute('title') || '') + node.className) };
  }

  function episodeSelected(node) {
    return selected(node) || /playingItem/.test(node.className || '')
      || selected(node.parentElement || node);
  }

  function episodeVisible(node) {
    if (!visible(node) || node.closest('[hidden],[aria-hidden="true"],.episode-expand-panel--hidden')) return false;
    let ancestor = node;
    while (ancestor && ancestor !== node.ownerDocument.body) {
      if (Number(node.ownerDocument.defaultView.getComputedStyle(ancestor).opacity) === 0) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  }

  function mangoEpisodeData(region) {
    if (platformId !== 'mango' || !region.matches('.mgtv-player-aside-video-selector')) return null;
    // Read only the public selector component's episode/pagination fields, never account/session state.
    try {
      const component = region.__vue__;
      if (component?.$options?.name !== 'PlayerAsideVideoSelector') return null;
      const items = component.finalVisibleItems;
      let ancestor = region.parentElement;
      while (ancestor && ancestor.__vue__?.$options?.name !== 'PlayerAsideDrawer') ancestor = ancestor.parentElement;
      const drawer = ancestor?.__vue__;
      const module = drawer?.selectorModule;
      const page = module?.media?.filters?.[0]?.page;
      return { items: Array.isArray(items) ? items : [],
        previous: module?.media?.fallback === 1 && typeof drawer?.isPreviousPageExhausted === 'boolean'
          ? !drawer.isPreviousPageExhausted : module?.media?.fallback === 0 ? false : null,
        next: page && Number.isFinite(page.pageNum) && Number.isFinite(page.pageTotal)
          && page.pageNum >= 1 && page.pageTotal >= 1
          ? page.pageNum < page.pageTotal : null,
        loading: component.isLoading === true || drawer?.isLoadingPrevious === true || drawer?.isLoadingMore === true };
    } catch { return null; /* A changed official component falls back to its mounted DOM. */ }
  }

  function episodeIdentity(node, index, doc) {
    let identity = ['data-vid', 'data-video-id', 'data-tvid', 'data-cid', 'data-id']
      .map((name) => node.getAttribute(name)).find(Boolean);
    let order = Number(node.getAttribute('data-video-idx') ?? index);
    if (platformId === 'tencent' && node.hasAttribute('dt-params')) {
      const params = new URLSearchParams(node.getAttribute('dt-params'));
      identity = params.get('vid') || identity;
      if (params.has('item_idx')) order = Number(params.get('item_idx'));
    }
    const entity = node.getAttribute('data-ai-entity') || '';
    const number = platformId === 'iqiyi' ? entity.match(/^第(\d+)集$/)?.[1]
      : ['migu', 'youku'].includes(platformId)
        ? text(node.querySelector(platformId === 'migu' ? '.episode-num' : '.box-stage')).match(/^\d+$/)?.[0] : null;
    if (number) { identity ||= `number:${number}`; order = Number(number); }
    const href = node.getAttribute('href');
    if (href && !href.startsWith('#')) {
      try {
        const url = new URL(href, doc.location.href);
        if (url.protocol !== 'https:' || url.origin !== doc.location.origin || url.username || url.password) return null;
        [...url.searchParams.keys()].filter((name) => /^(scm|spm|fpa|lastp|e2|qyTrace)$/i.test(name))
          .forEach((name) => url.searchParams.delete(name));
        url.searchParams.sort();
        identity ||= `${url.origin}${url.pathname}${url.search}`;
      } catch { return null; }
    }
    return { identity, order: Number.isFinite(order) ? order : index };
  }

  function episodeRead() {
    const config = adapters[platformId];
    episodeGroupItems = new Map();
    for (const doc of documents()) {
      // A mounted empty/closed complete panel must not suppress the working preview.
      const region = config.episodeRegions.map((selector) => [...doc.querySelectorAll(selector)]
        .filter((node) => episodeVisible(node) && episodeNodes(node, [...config.episodeNodes, ...config.episodes]).length)
        .sort((left, right) => episodeNodes(right, [...config.episodeNodes, ...config.episodes]).length
          - episodeNodes(left, [...config.episodeNodes, ...config.episodes]).length)[0]).find(Boolean);
      if (!region) continue;
      const groupNodes = episodeNodes(region, [...config.episodeGroups,
        '[class*="rangeItem"]', '[class*="groupItem"]', '[class*="page-item"]'])
        .filter((node) => episodeVisible(node));
      const groups = [];
      groupNodes.forEach((node) => {
        const label = text(node);
        if (!label || label.length > 60) return;
        const range = /^\d+\s*[-~～–]\s*\d+\s*集?$/.test(label);
        if (!node.matches(config.episodeGroups.join(',')) && !range) return;
        const option = episodeOption(node, 'episodeGroup', label, episodeGroupItems);
        const row = node.closest('.tab-node-container') || node.parentElement;
        if (!nodeIds.has(row)) nodeIds.set(row, String(++nextNodeId));
        groups.push({ ...option, group: nodeIds.get(row), range });
      });
      const groupKey = groups.filter((option) => option.selected && !option.range).map((option) => option.label).join('|');
      const full = !!region.closest(config.episodeFull);
      const mango = mangoEpisodeData(region);
      const items = new Map();
      episodeNodes(region, [...config.episodeNodes, ...config.episodes]).forEach((node, index) => {
        if (platformId === 'mango' && text(node.querySelector('.mgtv-player-aside-image-selector__tag')) === '推荐') return;
        const title = node.querySelector(config.episodeTitle);
        const label = text(title) || node.getAttribute('aria-label')?.trim()
          || node.getAttribute('title')?.trim() || text(node);
        if (!label || label.length > 160) return;
        const identity = episodeIdentity(node, index, doc);
        if (!identity) return;
        const official = mango?.items[index];
        if (official?.videoId && String(official.titleText || official.title || '').replace(/\s+/g, ' ').trim() === label) {
          identity.identity = `mango:${official.clipId || ''}:${official.videoId}`;
        }
        const key = identity.identity || `position:${identity.order}:${label}`;
        if (!items.has(key)) items.set(key, { node, label, ...identity });
      });
      const more = episodeNodes(region, config.episodeMore).find((node) => episodeVisible(node) && text(node));
      const scrollCandidates = new Set(nodes(config.episodeScroll, [region]));
      let ancestor = region;
      while (ancestor && !ancestor.contains(media())) {
        if (config.episodeScroll.some((selector) => ancestor.matches(selector))) scrollCandidates.add(ancestor);
        ancestor = ancestor.parentElement;
      }
      const scroll = [...scrollCandidates].find((node) => node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 2
        && /auto|scroll/.test(doc.defaultView.getComputedStyle(node).overflowY));
      const loading = mango?.loading || nodes(['[class*="__loading"]', '[class*="loading-more"]', '[aria-busy="true"]'], [region])
        .some(episodeVisible);
      // Totals for numeric series are comparable to episode numbers; variety totals can exclude Plus/preview entries.
      const totalMatch = ['iqiyi', 'youku', 'migu'].includes(platformId)
        ? text(region.closest(config.episodeFull) || region).match(/共\s*(\d+)\s*集|(\d+)\s*集全|查看全部\s*[（(](\d+)[）)]/) : null;
      const total = totalMatch ? Number(totalMatch[1] || totalMatch[2] || totalMatch[3]) : null;
      return { region, doc, groups, groupKey, full, items, more, scroll, loading, total, mango,
        context: `${doc.location.href}|${groupKey}` };
    }
    return null;
  }

  function episodeScrollTo(scroll, position) {
    scroll.scrollTop = Math.max(0, position);
    scroll.dispatchEvent(new scroll.ownerDocument.defaultView.Event('scroll', { bubbles: true }));
  }

  function episodeReset() {
    episodeCache.clear();
    episodeItems.clear();
    episodeLoad = null;
    episodeJump = null;
    episodeTransition = null;
    episodeContext = '';
    episodeError = '';
    episodeStartedAt = performance.now();
  }

  function episodeSnapshot() {
    const now = performance.now();
    if (episodeLocation !== document.location.href) {
      episodeLocation = document.location.href;
      episodeReset();
    }
    const read = episodeRead();
    if (episodeTransition) {
      if (!read?.loading && read?.groups.some((option) => option.selected && option.label === episodeTransition.label)) episodeTransition = null;
      else if (now > episodeTransition.until) {
        episodeTransition = null;
        episodeError = '官网分组尚未完成切换，请重试或进入官网操作';
      } else return { episodes: [], episodeGroups: read?.groups || [], episodeMore: null,
        episodeLoading: true, episodeHasMore: null, episodeStatus: 'loading', episodeMessage: '' };
    }
    if (read && episodeContext !== read.context) {
      episodeReset();
      episodeContext = read.context;
    }
    // Position-only entries are replaced from current DOM, never accumulated across recycled list nodes.
    if (read) {
      const previousItems = new Map(episodeCache);
      episodeCache.forEach((record, key) => { if (!record.identity) episodeCache.delete(key); else record.node = null; });
      const activeRange = read.groups.find((option) => option.range && option.selected)?.label;
      read.items.forEach((item, key) => {
        const previous = previousItems.get(key);
        const option = episodeOption(item.node, 'episodes', item.label, new Map());
        const offset = read.scroll ? item.node.getBoundingClientRect().top - read.scroll.getBoundingClientRect().top + read.scroll.scrollTop : 0;
        // Content owns the operation ID: virtual lists reuse one node for several episodes.
        episodeCache.set(key, { ...item, option: { ...option, id: previous?.option.id || `episodes:content:${++nextEpisodeId}` },
          range: activeRange, offset, context: read.context });
      });
    }
    if (episodeJump) {
      const target = read?.items.get(episodeJump.key);
      if (target?.node.isConnected && !target.node.matches('[disabled],[aria-disabled="true"]')) {
        target.node.click();
        episodeJump = null;
      } else if (now > episodeJump.until) {
        episodeJump = null;
        episodeError = '该选集的官网节点暂未恢复，请重新读取或进入官网操作';
      }
    }
    const records = [...episodeCache.values()].sort((left, right) => left.order - right.order);
    episodeItems = new Map(records.map((record) => [record.option.id, record]));
    const numericCount = new Set(records.map((record) => {
      const label = record.label.match(/^(?:第\s*)?(\d+)\s*(?:集)?$/);
      return record.identity?.startsWith('number:') ? Number(record.identity.slice(7)) : label ? Number(label[1]) : null;
    }).filter((number) => number !== null)).size;
    const ended = read?.full && !read.loading && ((read.total !== null && read.total > 0 && numericCount >= read.total)
      || (platformId === 'mango' && !read.region.classList.contains('mgtv-player-aside-video-selector--has-more')
        && read.mango?.previous === false && read.mango?.next === false));
    const signature = JSON.stringify([...episodeCache.keys()].sort());
    if (episodeLoad) {
      if (signature === episodeLoad.signature && !read?.loading) episodeLoad.stable += 1;
      else { episodeLoad.signature = signature; episodeLoad.stable = 0; }
      const previousEnded = episodeLoad.mode === 'previous' && read?.mango?.previous === false;
      if ((signature !== episodeLoad.before || ended || previousEnded) && episodeLoad.stable >= 3) episodeLoad = null;
      else if (now > episodeLoad.until) {
        episodeLoad = null;
        episodeError = '官网选集未返回新增内容，已保留已读取条目，可再次加载或进入官网操作';
      }
    }
    episodeMoreItems = new Map();
    let more = null;
    if (read?.more && !read.full) more = { mode: 'expand', node: read.more, label: '加载更多' };
    else if (read && !ended) {
      const range = read.groups.find((option) => option.range && option.selected);
      const ranges = read.groups.filter((option) => option.range);
      const next = range && ranges[ranges.indexOf(range) + 1];
      if (next) more = { mode: 'next', node: episodeGroupItems.get(next.id), label: '加载更多' };
      else if (read.scroll) {
        const previous = read.mango ? read.mango.previous : read.scroll.scrollTop > 2
          && !records.some((record) => record.order === 0 || record.identity === 'number:1');
        more = { mode: previous ? 'previous' : 'next', scroll: read.scroll,
          label: previous ? '加载前面的选集' : '加载更多' };
      }
    }
    if (more) { more.id = `episodeMore:${more.mode}`; episodeMoreItems.set(more.id, more); }
    return { episodes: records.map((record) => ({ ...record.option, selected: !!record.node && record.option.selected })),
      episodeGroups: read?.groups || [], episodeMore: more ? { id: more.id, label: more.label, mode: more.mode,
        disabled: !!episodeLoad || !!episodeJump } : null,
      episodeLoading: !!episodeLoad || !!episodeJump, episodeHasMore: ended ? false
        : more && (more.node || read?.mango?.previous === true || read?.mango?.next === true) ? true : null,
      episodeMessage: episodeError, episodeStatus: records.length ? 'ready'
        : document.readyState !== 'complete' || now - episodeStartedAt < 10000 ? 'loading' : 'unavailable' };
  }

  function snapshot() {
    const episodeData = episodeSnapshot();
    layout();
    syncFullscreen();
    const video = media();
    const host = container(video);
    const ad = blockingAd();
    const ranges = [];
    if (video && !ad) for (let index = 0; index < video.seekable.length; index += 1) {
      ranges.push({ start: video.seekable.start(index), end: video.seekable.end(index) });
    }
    const live = mediaType === 'live' || video?.duration === Infinity;
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    const qualities = options('qualities');
    const episodes = live ? [] : episodeData.episodes;
    const phase = ad ? 'ad' : !host ? 'unavailable' : !video ? 'unsupported'
      : video.error ? 'error' : video.ended ? 'ended' : video.readyState < 3 ? 'loading' : 'ready';
    return { phase, paused: video?.paused ?? true, currentTime: video?.currentTime || 0, duration, fullscreenRequest,
      canControl: !!video && !!host && !ad && !video.error, ranges, live, qualities, ...episodeData, episodes,
      noEpisodes: !live && !episodes.length && (mediaType === 'movie'
        || document.querySelector('meta[property="og:type"]')?.content === 'video.movie'),
      description: document.querySelector('meta[property="og:description"]')?.content?.slice(0, 4000) || '',
      title: document.querySelector('meta[property="og:title"]')?.content?.slice(0, 160) || '',
      message: lastError || (phase === 'unavailable' ? '暂无法识别官网播放器，请重试或进入官网操作'
        : phase === 'unsupported' ? '官网播放器暂不支持统一控制，请进入官网操作'
          : phase === 'ad' ? '正在播放官网广告，请按官网提示操作'
            : phase === 'error' ? '官网媒体播放失败，请进入官网查看提示' : '') };
  }

  function action(command, payload) {
    lastError = '';
    const video = media();
    if (['play', 'pause', 'seek'].includes(command)) {
      if (!video || !container(video) || blockingAd()) return { error: '当前阶段不支持统一播放操作' };
      if (command === 'play') {
        const promise = video.play();
        if (promise) promise.catch(() => { lastError = '官网拒绝播放操作，请点击播放器或进入官网操作'; });
      } else if (command === 'pause') video.pause();
      else {
        const position = payload.position;
        if (!Number.isFinite(position) || mediaType === 'live' || !Number.isFinite(video.duration)) return { error: '当前内容不能拖动进度' };
        const ranges = snapshot().ranges;
        if (!ranges.some((range) => position >= range.start && position <= range.end)) return { error: '超出官网可播放范围' };
        video.currentTime = position;
      }
    } else if (command === 'quality') {
      const node = qualityItems.get(payload.optionId);
      if (!node?.isConnected || node.matches('[disabled],[aria-disabled="true"]')) return { error: '官网选项已变化或不可用，请进入官网操作' };
      node.click();
    } else if (['episode', 'episodeGroup', 'episodeMore'].includes(command)) {
      const current = episodeSnapshot();
      const read = episodeRead();
      if (!read || episodeTransition && command !== 'episodeGroup') return { error: '官网选集尚未准备好，请稍后重试' };
      episodeError = '';
      if (command === 'episodeMore') {
        if (episodeLoad || episodeJump) return { accepted: true };
        const more = episodeMoreItems.get(payload.optionId);
        if (!more || more.node && (!more.node.isConnected || more.node.matches('[disabled],[aria-disabled="true"]'))) {
          return { error: '官网更多入口已变化，请重新读取或进入官网操作' };
        }
        const before = JSON.stringify([...episodeCache.keys()].sort());
        episodeLoad = { before, signature: before, mode: more.mode, stable: 0, until: performance.now() + 30000 };
        if (more.node) more.node.click();
        else episodeScrollTo(more.scroll, more.mode === 'previous' ? 0 : more.scroll.scrollHeight);
      } else if (command === 'episodeGroup') {
        const node = episodeGroupItems.get(payload.optionId);
        const option = current.episodeGroups.find((group) => group.id === payload.optionId);
        if (!option || !node?.isConnected || node.matches('[disabled],[aria-disabled="true"]')) {
          return { error: '官网分组已变化或不可用，请重新读取' };
        }
        episodeLoad = null;
        episodeJump = null;
        if (!option.range && !option.selected) {
          episodeReset();
          episodeTransition = { label: option.label, until: performance.now() + 30000 };
        }
        node.click();
      } else {
        const record = episodeItems.get(payload.optionId);
        if (!record || record.option.disabled || record.context !== read.context) {
          return { error: '官网选集已变化或不可用，请重新读取' };
        }
        episodeLoad = null;
        const key = [...episodeCache].find(([, item]) => item === record)[0];
        const target = read.items.get(key);
        if (target?.node.isConnected && !target.node.matches('[disabled],[aria-disabled="true"]')) target.node.click();
        else {
          const range = read.groups.find((group) => group.range && group.label === record.range);
          const rangeNode = range && episodeGroupItems.get(range.id);
          if (rangeNode?.isConnected && !range.disabled) rangeNode.click();
          else if (read.scroll) episodeScrollTo(read.scroll, record.offset);
          else return { error: '该选集的官网节点已变化，请重新读取或进入官网操作' };
          episodeJump = { key, until: performance.now() + 30000 };
        }
      }
    } else if (command === 'qualityMenu') {
      const trigger = nodes(adapters[platformId].qualityTrigger).find(visible);
      if (!trigger) return { error: '暂无法读取清晰度，请进入官网操作' };
      trigger.click();
    } else return { error: '不支持的播放操作' };
    return { accepted: true };
  }

  root.SimplePlayer = {
    init(id, type, mode) { platformId = id; mediaType = type; compact = mode; lastError = ''; episodeReset(); },
    mode(value) {
      restore();
      episodeLoad = null;
      episodeJump = null;
      compact = value;
      layout();
      return { compact };
    },
    fullscreen(value) {
      if (fullscreenRequest === value) fullscreenRequest = null;
      if (fullscreen === value) return { fullscreen };
      if (fullscreen !== value) { clearFullscreen(); controlsShown = true; }
      fullscreen = value;
      syncFullscreen();
      return { fullscreen };
    },
    snapshot,
    action(command, payload) {
      try { return action(command, payload); }
      catch { return { error: '官网操作未完成，请重试或进入官网操作' }; }
    },
  };
}(globalThis));
