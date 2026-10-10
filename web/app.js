(function startApplication() {
  'use strict';
  const { platforms, findPlatform, allowedUrl } = SimplePlatforms;
  const bridge = VideoBridge;
  const element = (selector) => document.querySelector(selector);
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const state = { tab: 'home', homeFilter: 'all', searchFilter: 'all', query: '', browser: false,
    home: new Map(), search: new Map(), generation: 0, auth: new Map(), favorites: new Map(), detail: null };
  let toastTimer;
  let theme = 'system';
  let systemDark = null;
  let playerSession = 0;
  let playerCompact = false;
  let playerState = null;
  let seeking = false;
  const playerOptions = new Map();
  const homeCache = new Map();
  const lastConfirmed = new Map();
  let updateState = null;
  let updateRevision = -1;

  function renderUpdate(snapshot) {
    if (!snapshot || !Number.isInteger(snapshot.revision) || snapshot.revision < updateRevision) return;
    updateRevision = snapshot.revision;
    const previousRelease = updateState?.releaseId;
    const selected = element('#update-asset').value;
    updateState = snapshot;
    const downloading = snapshot.status === 'downloading';
    const checking = snapshot.status === 'checking';
    const ready = snapshot.status === 'ready';
    element('#update-current').textContent = `当前版本 ${snapshot.currentVersion}`;
    element('#update-check').disabled = checking || downloading;
    element('#update-check').textContent = checking ? '正在检查…' : '检查更新';
    let message = snapshot.message;
    if (snapshot.tagName && !['unknown-version', 'available', 'ahead'].includes(snapshot.status)) {
      message += ` · 最新版本 ${snapshot.tagName}`;
    }
    if (downloading && snapshot.total > 0) message += ` · ${Math.floor(snapshot.downloaded / snapshot.total * 100)}%`;
    element('#update-message').textContent = message;
    const assets = Array.isArray(snapshot.assets) ? snapshot.assets : [];
    element('#update-download').hidden = !assets.length
      || !['available', 'downloading', 'download-error', 'ready'].includes(snapshot.status);
    const selector = element('#update-asset');
    selector.replaceChildren();
    assets.forEach((asset) => {
      const option = create('option', '', `${asset.name} · ${(asset.size / 1048576).toFixed(1)} MiB`);
      option.value = String(asset.id);
      selector.append(option);
    });
    const preferred = assets.find((asset) => asset.name === `Simple-videos-${snapshot.latestVersion}.apk`);
    if (previousRelease === snapshot.releaseId && assets.some((asset) => String(asset.id) === selected)) selector.value = selected;
    else if (preferred) selector.value = String(preferred.id);
    else if (assets.length > 1) {
      const option = create('option', '', '请选择安装包');
      option.value = '';
      selector.prepend(option);
      selector.value = '';
    }
    selector.disabled = downloading || ready;
    element('#update-progress').hidden = !downloading;
    element('#update-progress').value = snapshot.total > 0 ? snapshot.downloaded / snapshot.total : 0;
    element('#update-download-button').hidden = ready;
    element('#update-download-button').disabled = downloading || !selector.value;
    element('#update-download-button').textContent = downloading ? '正在下载…' : '下载更新';
    element('#update-install').hidden = !ready;
  }

  async function updateCommand(command, payload = {}) {
    try {
      const result = await bridge.request(command, payload);
      if (command === 'installUpdate') notice(result.message);
      else renderUpdate(result);
    } catch (error) { notice(error.message || '更新操作失败，请重试'); }
  }

  function notice(message) {
    const toast = element('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem('simple-favorites') || '[]');
      if (Array.isArray(saved)) saved.forEach((item) => {
        if (item && typeof item.key === 'string' && typeof item.title === 'string'
          && allowedUrl(item.platform, item.url)) state.favorites.set(item.key, item);
      });
      const preference = localStorage.getItem('simple-theme');
      if (['light', 'dark', 'system'].includes(preference)) theme = preference;
    } catch { notice('本机设置读取失败，请检查设备存储'); }
  }

  function loadHomeCache() {
    try {
      const stored = localStorage.getItem('simple-home-cache-v1');
      if (!stored || stored.length > 1048576) return;
      const cache = JSON.parse(stored);
      if (cache.version !== 1) return;
      let cacheChanged = false;
      platforms.forEach((platform) => {
        const record = cache.platforms?.[platform.id];
        if (!record || !Number.isFinite(record.timestamp) || !Array.isArray(record.items)) return;
        let items = record.items.slice(0, 24).filter((item) => item && item.platform === platform.id
          && typeof item.key === 'string' && typeof item.title === 'string' && allowedUrl(platform.id, item.url));
        if (platform.id === 'mango') {
          const recommendations = items.filter((item) => new URL(item.url).searchParams.get('fpa') !== 'c_historypop');
          if (recommendations.length !== items.length) {
            items = recommendations;
            cache.platforms.mango = { ...record, items };
            cacheChanged = true;
          }
        }
        homeCache.set(platform.id, { items, timestamp: record.timestamp });
        state.home.set(platform.id, { status: items.length ? 'ok' : 'empty', items,
          query: '', page: 1, hasMore: false, cached: true, timestamp: record.timestamp });
      });
      if (cacheChanged) {
        try { localStorage.setItem('simple-home-cache-v1', JSON.stringify(cache)); }
        catch { notice('历史推荐条目已过滤，但缓存保存失败'); }
      }
    } catch { notice('首页缓存读取失败，将重新获取官网内容'); }
  }

  function saveHomeCache(id, items) {
    const metadata = items.slice(0, 24).map((item) => ({
      key: item.key, platform: item.platform, title: item.title, url: item.url,
      cover: item.cover || '', description: item.description || '', type: item.type || 'vod',
    }));
    homeCache.set(id, { items: metadata, timestamp: Date.now() });
    try {
      localStorage.setItem('simple-home-cache-v1', JSON.stringify({ version: 1, platforms: Object.fromEntries(homeCache) }));
    } catch { notice('首页已更新，但缓存保存失败'); }
  }

  function applyTheme() {
    const dark = theme === 'dark' || (theme === 'system'
      && (systemDark ?? matchMedia('(prefers-color-scheme: dark)').matches));
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    element('#theme-select').value = theme;
    run('theme', { theme: dark ? 'dark' : 'light' });
  }

  function setTheme(value) {
    theme = value;
    applyTheme();
    try { localStorage.setItem('simple-theme', theme); } catch { notice('主题已切换，但保存失败'); }
  }

  async function run(command, payload = {}) {
    try { return await bridge.request(command, payload); }
    catch (error) { notice(error.message || '操作失败，请重试'); return null; }
  }

  function syncHeaderActions() {
    element('#refresh-home').hidden = state.tab !== 'home' || state.browser;
  }

  function switchTab(tab) {
    if (state.browser) return;
    state.tab = tab;
    syncHeaderActions();
    document.querySelectorAll('.page').forEach((page) => { page.hidden = page.id !== `page-${tab}`; });
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.tab === tab);
      button.setAttribute('aria-current', button.dataset.tab === tab ? 'page' : 'false');
    });
    if (tab === 'favorites') renderFavorites();
    if (tab === 'search') element('#search-input').focus();
    if (tab === 'settings') updateCommand('updateStatus');
  }

  function platformIcon(platform) {
    const node = create('span', 'platform-icon', platform.glyph);
    node.style.setProperty('--platform-color', platform.color);
    return node;
  }

  function renderTabs(kind) {
    const host = element(`#${kind}-platforms`);
    host.replaceChildren();
    [{ id: 'all', name: '全部平台', color: '#1764d9' }, ...platforms].forEach((platform) => {
      const button = create('button', 'platform-tab', platform.name);
      const dot = create('span', 'platform-dot');
      dot.style.setProperty('--platform-color', platform.color);
      button.prepend(dot);
      button.classList.toggle('selected', state[`${kind}Filter`] === platform.id);
      button.setAttribute('aria-pressed', String(state[`${kind}Filter`] === platform.id));
      button.addEventListener('click', () => {
        state[`${kind}Filter`] = platform.id;
        renderTabs(kind);
        renderResults(kind);
        if (kind === 'home') loadSelectedHome();
        else if (state.query) loadSearch(false);
      });
      host.append(button);
    });
  }

  function toggleFavorite(item) {
    const wasSaved = state.favorites.has(item.key);
    if (wasSaved) state.favorites.delete(item.key);
    else state.favorites.set(item.key, item);
    try { localStorage.setItem('simple-favorites', JSON.stringify([...state.favorites.values()])); }
    catch {
      if (wasSaved) state.favorites.set(item.key, item);
      else state.favorites.delete(item.key);
      notice('收藏保存失败，请检查设备存储');
      return;
    }
    renderResults('home');
    renderResults('search');
    renderFavorites();
    if (state.detail) renderDetail(state.detail);
    notice(wasSaved ? '已取消收藏' : '已加入收藏');
  }

  function videoCard(item) {
    const platform = findPlatform(item.platform);
    const card = create('article', 'video-card');
    const poster = create('button', 'poster-button');
    poster.setAttribute('aria-label', `查看 ${item.title}`);
    const fallback = () => {
      const background = create('div', 'poster-fallback');
      background.append(create('span', '', '▷'), create('div', '', item.title));
      const image = poster.querySelector('img');
      if (image) image.replaceWith(background);
      else poster.prepend(background);
    };
    if (/^https:\/\//.test(item.cover)) {
      const image = create('img');
      image.src = item.cover;
      image.alt = item.title;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', fallback, { once: true });
      poster.append(image);
    } else fallback();
    poster.append(create('span', 'platform-badge', platform.name));
    if (item.type === 'live') poster.append(create('span', 'live-badge', '直播'));
    poster.addEventListener('click', () => openDetail(item));
    const favorite = create('button', `favorite-button${state.favorites.has(item.key) ? ' saved' : ''}`,
      state.favorites.has(item.key) ? '♥' : '♡');
    favorite.setAttribute('aria-label', `${state.favorites.has(item.key) ? '取消收藏' : '收藏'} ${item.title}`);
    favorite.addEventListener('click', () => toggleFavorite(item));
    const title = create('button', 'video-title', item.title);
    title.title = item.title;
    title.addEventListener('click', () => openDetail(item));
    card.append(poster, favorite, title, create('p', 'video-description', item.description || platform.name));
    return card;
  }

  function statusCard(record, platform, kind) {
    if (record.status === 'loading') {
      const grid = create('div', 'video-grid');
      for (let index = 0; index < 4; index += 1) grid.append(create('div', 'skeleton'));
      return grid;
    }
    const card = create('div', 'status-card');
    const labels = { empty: '暂时没有相关内容', verification: '官网需要验证', 'parse-error': '影片信息暂时无法读取', 'network-error': '官网连接失败' };
    const content = create('div', 'status-body');
    content.append(create('strong', '', labels[record.status] || '等待加载'),
      create('p', '', record.message || '连接官网获取真实内容'));
    const actions = create('div', 'status-actions');
    if (record.status !== 'empty') {
      const retry = create('button', 'button secondary', '重试');
      retry.addEventListener('click', () => loadPlatform(kind, platform.id, true));
      actions.append(retry);
    }
    if (record.status === 'verification' || record.status === 'parse-error') {
      const official = create('button', 'button secondary', '打开官网');
      official.addEventListener('click', () => run('verify', { platform: platform.id, query: kind === 'search' ? state.query : '' }));
      actions.append(official);
    }
    card.append(create('span', 'status-symbol', '▷'), content, actions);
    return card;
  }

  function emptyState(icon, title, message) {
    const node = create('div', 'empty-state');
    node.append(create('span', '', icon), create('h3', '', title), create('p', '', message));
    return node;
  }

  function renderResults(kind, onlyId = null) {
    const host = element(`#${kind}-results`);
    if (!onlyId) host.replaceChildren();
    if (kind === 'search' && !state.query) {
      host.append(emptyState('⌕', '下一部好片，从这里开始', '输入关键词，搜索结果会按平台分别展示。'));
      return;
    }
    const filter = state[`${kind}Filter`];
    platforms.filter((platform) => (filter === 'all' || platform.id === filter)
      && (!onlyId || platform.id === onlyId)).forEach((platform) => {
      const record = state[kind].get(platform.id) || { status: 'loading', items: [] };
      const section = create('section', 'platform-section');
      section.dataset.platform = platform.id;
      const heading = create('div', 'platform-heading');
      heading.append(platformIcon(platform), create('h3', '', platform.name));
      if (record.items?.length) heading.append(create('span', 'muted', `${record.items.length} 部`));
      const login = create('button', 'text-button', '平台账号 ↗');
      login.addEventListener('click', () => run('login', { platform: platform.id }));
      heading.append(login);
      section.append(heading);
      if (record.refreshing || record.cached || record.refreshError) {
        const message = record.refreshError || (record.refreshing ? '正在更新官网内容…' : '显示本机缓存');
        const updated = record.timestamp ? ` · 上次获取 ${new Date(record.timestamp).toLocaleString()}` : '';
        section.append(create('p', 'refresh-state muted', message + updated));
        if (record.refreshError) {
          const retry = create('button', 'text-button', '重试刷新');
          retry.addEventListener('click', () => loadPlatform(kind, platform.id, true));
          section.append(retry);
        }
      }
      if (record.items?.length) {
        const grid = create('div', 'video-grid');
        record.items.forEach((item) => grid.append(videoCard(item)));
        section.append(grid);
        if (record.moreError) section.append(create('p', 'muted', record.moreError));
        if (record.hasMore) {
          const more = create('button', 'button secondary load-more', record.loadingMore ? '正在加载…' : '加载下一页');
          more.disabled = Boolean(record.loadingMore || record.refreshing);
          more.addEventListener('click', () => loadPlatform(kind, platform.id, false, true));
          section.append(more);
        }
      } else section.append(statusCard(record, platform, kind));
      const existing = onlyId && [...host.children].find((node) => node.dataset.platform === platform.id);
      if (existing) existing.replaceWith(section);
      else host.append(section);
    });
  }

  async function loadPlatform(kind, id, force = false, more = false) {
    const previous = state[kind].get(id);
    const query = kind === 'search' ? state.query : '';
    const generation = state.generation;
    if (previous?.query === query && (previous.status === 'loading' || previous.refreshing)) return;
    if (!force && !more && previous && (previous.status === 'loading' || previous.query === query)) return;
    if (more && (!previous?.hasMore || previous.loadingMore || previous.refreshing)) return;
    const record = more ? { ...previous, loadingMore: true, moreError: '' }
      : kind === 'home' && previous?.items?.length ? { ...previous, refreshing: true, refreshError: '', moreError: '' }
      : { status: 'loading', items: [], query, page: 1 };
    state[kind].set(id, record);
    renderResults(kind, id);
    const page = more ? previous.page + 1 : 1;
    let result;
    try {
      if (kind === 'search') {
        await searchReady;
        if (generation !== state.generation) return;
      }
      result = await bridge.request('list', { platform: id, query, page,
        batch: kind === 'search' ? generation : undefined, nextUrl: more ? previous.nextUrl : undefined });
    }
    catch (error) { result = { status: 'network-error', message: error.message, items: [] }; }
    if ((kind === 'search' && generation !== state.generation) || state[kind].get(id) !== record) return;
    if (['authenticated', 'anonymous', 'unknown'].includes(result.auth)) {
      state.auth.set(id, result.auth);
      renderAccounts();
    }
    if (more && result.status !== 'ok') {
      state[kind].set(id, { ...previous, loadingMore: false, moreError: result.message || '下一页加载失败，可重试' });
    } else if (kind === 'home' && previous?.items?.length && !['ok', 'empty'].includes(result.status)) {
      state.home.set(id, { ...previous, refreshing: false, refreshError: result.message || '官网更新失败，保留上次内容' });
    } else {
      const allItems = more ? [...previous.items, ...result.items] : result.items;
      const unique = [...new Map(allItems.filter((item) => allowedUrl(item.platform, item.url))
        .map((item) => [item.key, item])).values()];
      state[kind].set(id, { ...result, items: unique, query, page,
        timestamp: kind === 'home' && !more ? Date.now() : previous?.timestamp,
        hasMore: result.hasMore && (!more || unique.length > previous.items.length) });
      if (kind === 'home' && !more && ['ok', 'empty'].includes(result.status)) saveHomeCache(id, unique);
    }
    renderResults(kind, id);
  }

  function loadSelectedHome(force = false) {
    platforms.filter((platform) => state.homeFilter === 'all' || platform.id === state.homeFilter)
      .forEach((platform) => loadPlatform('home', platform.id, force));
  }

  let searchReady = Promise.resolve();

  function loadSearch(fresh = true) {
    if (!state.query) return;
    if (fresh) {
      state.generation += 1;
      state.search.clear();
      renderResults('search');
      searchReady = bridge.request('searchBegin', { batch: state.generation, query: state.query });
    }
    platforms.filter((platform) => state.searchFilter === 'all' || platform.id === state.searchFilter)
      .forEach((platform) => loadPlatform('search', platform.id, fresh));
  }

  function renderFavorites() {
    const host = element('#favorite-results');
    host.replaceChildren();
    if (!state.favorites.size) host.append(emptyState('♡', '把好片留给下次', '点击影片右上角的爱心，加入你的收藏。'));
    else [...state.favorites.values()].reverse().forEach((item) => host.append(videoCard(item)));
  }

  function renderDetail(item) {
    const platform = findPlatform(item.platform);
    const host = element('#detail-content');
    host.replaceChildren();
    const layout = create('div', 'detail-layout');
    if (/^https:\/\//.test(item.cover)) {
      const image = create('img', 'detail-cover');
      image.src = item.cover;
      image.alt = item.title;
      image.referrerPolicy = 'no-referrer';
      layout.append(image);
    }
    const text = create('div', 'detail-text');
    text.append(create('span', 'count-pill', `${platform.name} · ${item.type === 'live' ? '直播' : '点播'}`),
      create('h2', '', item.title), create('p', 'muted', item.description || '完整简介、选集和播放权益将在官网页面展示。'));
    const actions = create('div', 'detail-actions');
    const play = create('button', 'button primary', '▷ 打开播放');
    play.addEventListener('click', async () => {
      play.disabled = true;
      play.textContent = '正在检查登录…';
      const result = await run('open', { platform: item.platform, url: item.url, title: item.title,
        description: item.description || '', mediaType: item.type });
      if (result) element('#detail-dialog').close();
      play.disabled = false;
      play.textContent = '▷ 打开播放';
    });
    const favorite = create('button', 'button secondary', state.favorites.has(item.key) ? '♥ 已收藏' : '♡ 收藏');
    favorite.addEventListener('click', () => toggleFavorite(item));
    actions.append(play, favorite);
    text.append(actions, create('p', 'detail-note', '播放前需登录本平台账号。清晰度与会员权限以官网为准。'));
    layout.append(text);
    host.append(layout);
  }

  async function openDetail(item) {
    state.detail = item;
    renderDetail(item);
    element('#detail-dialog').showModal();
    const note = element('#detail-content .detail-note');
    note.textContent = '正在读取官网详情…';
    let result;
    try { result = await bridge.request('detail', { platform: item.platform, url: item.url }); }
    catch (error) {
      if (state.detail === item) note.textContent = `官网详情读取失败：${error.message}。可继续打开官网。`;
      return;
    }
    if (state.detail !== item || !element('#detail-dialog').open) return;
    if (result.detail?.description) {
      state.detail = { ...item, description: result.detail.description };
      renderDetail(state.detail);
    } else note.textContent = result.status === 'verification'
      ? '官网详情需要安全验证，可在官网完成。' : '官网未提供可读取的简介，完整详情可在官网查看。';
  }

  function renderAccounts() {
    const host = element('#accounts');
    host.replaceChildren();
    const labels = { authenticated: '已确认登录', anonymous: '未登录', unknown: '登录状态待确认' };
    platforms.forEach((platform) => {
      const row = create('div', 'setting-row');
      const name = create('div', 'account-name');
      const caption = create('div');
      const auth = state.auth.get(platform.id) || 'unknown';
      caption.append(create('strong', '', platform.name), create('p', 'account-state', auth === 'unknown'
        && lastConfirmed.has(platform.id) ? '上次已登录，待确认' : labels[auth]));
      name.append(platformIcon(platform), caption);
      const button = create('button', 'button secondary', '官方登录');
      button.addEventListener('click', () => run('login', { platform: platform.id }));
      row.append(name, button);
      host.append(row);
    });
  }

  function syncBounds() {
    if (!state.browser) return;
    const rect = element('#browser-viewport').getBoundingClientRect();
    bridge.request('bounds', { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
      .catch((error) => notice(error.message));
  }

  function playerMode(compact) {
    playerCompact = compact;
    element('#browser-panel').classList.toggle('unified-player', compact);
    element('#player-controls').hidden = !compact;
    element('#player-information').hidden = !compact;
    element('#player-mode').hidden = state.browserMode !== 'play';
    element('#player-mode').textContent = compact ? '官网操作' : '返回播放';
    element('#browser-back').hidden = compact;
    element('#browser-status').textContent = compact ? '官方播放引擎' : '官网页面';
    requestAnimationFrame(syncBounds);
  }

  function resetPlayer(session) {
    playerSession = session;
    playerState = null;
    seeking = false;
    playerOptions.clear();
    element('#player-toggle').disabled = true;
    element('#player-toggle').textContent = '播放';
    element('#player-seek').disabled = true;
    element('#player-seek').value = '0';
    element('#player-time').textContent = '00:00 / 00:00';
    element('#player-message').textContent = '正在识别官网播放器…';
    element('#player-qualities').replaceChildren();
    element('#player-episodes').replaceChildren();
    element('#player-episode-groups').replaceChildren();
    element('#player-episode-more').hidden = true;
    element('#player-episode-status').textContent = '';
    element('#player-episode-section').hidden = false;
  }

  function playerTime(seconds) {
    const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  async function playerAction(action, payload = {}) {
    const session = playerSession;
    try { await bridge.request('playerAction', { session, action, ...payload }); }
    catch (error) {
      if (session !== playerSession || !state.browser) return;
      element('#player-message').textContent = error.message || '官网操作未完成';
      notice(error.message || '官网操作未完成');
    }
  }

  function renderPlayerOptions(kind, options) {
    const signature = JSON.stringify([options, kind === 'episodes' ? playerState.episodeStatus : '']);
    if (playerOptions.get(kind) === signature) return;
    playerOptions.set(kind, signature);
    const host = element(`#player-${kind}`);
    host.replaceChildren();
    if (!options.length) {
      host.append(create('p', 'muted', kind === 'qualities'
        ? '暂未读取到清晰度，可读取官网选项或进入官网操作。'
        : playerState.episodeStatus === 'loading' ? '官网选集正在加载…'
          : '暂无法读取官网选集，请重试或进入官网操作。'));
      return;
    }
    options.forEach((option) => {
      const label = option.paid && !/VIP|会员|付费|购买/i.test(option.label) ? `${option.label} · 会员` : option.label;
      const button = create('button', `button secondary${option.selected ? ' selected' : ''}`, label);
      button.disabled = Boolean(option.disabled);
      button.setAttribute('aria-pressed', String(option.selected));
      button.addEventListener('click', () => playerAction(kind === 'qualities' ? 'quality' : 'episode', { optionId: option.id }));
      host.append(button);
    });
  }

  function renderEpisodeNavigation(snapshot) {
    const groups = snapshot.episodeGroups || [];
    const signature = JSON.stringify(groups);
    const host = element('#player-episode-groups');
    if (playerOptions.get('episodeGroups') !== signature) {
      playerOptions.set('episodeGroups', signature);
      host.replaceChildren();
      const rows = new Map();
      groups.forEach((option) => {
        if (!rows.has(option.group)) {
          const row = create('div', 'player-options');
          rows.set(option.group, row);
          host.append(row);
        }
        const button = create('button', `button secondary${option.selected ? ' selected' : ''}`, option.label);
        button.disabled = Boolean(option.disabled);
        button.setAttribute('aria-pressed', String(option.selected));
        button.addEventListener('click', () => playerAction('episodeGroup', { optionId: option.id }));
        rows.get(option.group).append(button);
      });
    }
    const more = element('#player-episode-more');
    more.hidden = !snapshot.episodeMore && !snapshot.episodeLoading;
    more.disabled = Boolean(snapshot.episodeLoading || snapshot.episodeMore?.disabled);
    more.textContent = snapshot.episodeLoading ? '加载中…' : snapshot.episodeMore?.label || '';
    more.dataset.optionId = snapshot.episodeMore?.id || '';
    const count = snapshot.episodes?.length || 0;
    element('#player-episode-status').textContent = snapshot.episodeMessage
      || (count ? `已读取 ${count} 条${snapshot.episodeHasMore === false ? ' · 官网列表已读完' : ''}` : '');
  }

  function renderPlayer(snapshot) {
    playerState = snapshot;
    element('#player-toggle').disabled = !snapshot.canControl;
    element('#player-toggle').textContent = snapshot.paused ? '播放' : '暂停';
    const duration = Number.isFinite(snapshot.duration) ? snapshot.duration : 0;
    const position = Number.isFinite(snapshot.currentTime) ? snapshot.currentTime : 0;
    const slider = element('#player-seek');
    slider.disabled = !snapshot.canControl || snapshot.live || duration <= 0 || !snapshot.ranges?.length;
    slider.max = String(Math.max(1, duration));
    if (!seeking) slider.value = String(position);
    element('#player-time').textContent = snapshot.live ? '直播' : `${playerTime(position)} / ${playerTime(duration)}`;
    const labels = { loading: '官网播放器正在加载…', ended: '播放已结束', ready: '' };
    element('#player-message').textContent = snapshot.error || snapshot.message || labels[snapshot.phase] || '';
    if (snapshot.description) element('#player-description').textContent = snapshot.description;
    if (snapshot.title) {
      element('#player-name').textContent = snapshot.title;
      element('#browser-title').textContent = snapshot.title;
    }
    renderPlayerOptions('qualities', snapshot.qualities || []);
    renderEpisodeNavigation(snapshot);
    renderPlayerOptions('episodes', snapshot.episodes || []);
    element('#player-episode-section').hidden = Boolean(snapshot.live || snapshot.noEpisodes);
  }

  function showBrowser(message) {
    state.browser = true;
    syncHeaderActions();
    state.browserPlatform = message.platform;
    state.browserMode = message.mode;
    resetPlayer(message.session);
    playerMode(message.mode === 'play');
    element('#player-name').textContent = message.title;
    element('#player-source').textContent = findPlatform(message.platform)?.name || '';
    element('#player-description').textContent = message.description || '官网尚未提供可读取的简介。';
    document.body.classList.add('browser-open');
    element('#detail-dialog').close();
    element('#main').hidden = true;
    element('#browser-panel').hidden = false;
    element('#browser-title').textContent = message.title;
    element('#browser-status').textContent = message.mode === 'login' ? '官网登录与安全验证'
      : message.mode === 'play' ? '官方播放引擎' : '官网页面';
    element('#finish-login').hidden = message.mode === 'play';
    element('#finish-login').textContent = message.mode === 'verify' ? '完成验证，重试' : '完成登录，继续';
    element('#login-hint').hidden = message.mode !== 'login';
    requestAnimationFrame(syncBounds);
  }

  function hideBrowser() {
    state.browser = false;
    syncHeaderActions();
    document.body.classList.remove('browser-open');
    document.body.classList.remove('player-fullscreen');
    playerMode(false);
    resetPlayer(0);
    element('#browser-panel').hidden = true;
    element('#main').hidden = false;
  }

  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  element('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.query = element('#search-input').value.trim();
    if (!state.query) { notice('请输入搜索关键词'); return; }
    loadSearch();
  });
  element('#refresh-home').addEventListener('click', () => loadSelectedHome(true));
  element('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  element('#theme-select').addEventListener('change', (event) => setTheme(event.target.value));
  element('#update-check').addEventListener('click', async () => {
    element('#update-check').disabled = true;
    await updateCommand('checkUpdate');
    if (updateState) renderUpdate(updateState);
    else element('#update-check').disabled = false;
  });
  element('#update-asset').addEventListener('change', () => {
    element('#update-download-button').disabled = !element('#update-asset').value;
  });
  element('#update-download-button').addEventListener('click', async () => {
    const assetId = Number(element('#update-asset').value);
    if (!updateState || !assetId) return;
    element('#update-download-button').disabled = true;
    await updateCommand('downloadUpdate', { releaseId: updateState.releaseId, assetId });
    if (updateState) renderUpdate(updateState);
  });
  element('#update-install').addEventListener('click', async () => {
    element('#update-install').disabled = true;
    await updateCommand('installUpdate');
    element('#update-install').disabled = false;
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  element('#detail-close').addEventListener('click', () => element('#detail-dialog').close());
  element('#detail-dialog').addEventListener('close', () => { state.detail = null; });
  element('#browser-close').addEventListener('click', async () => { await run('browserClose'); hideBrowser(); });
  element('#browser-back').addEventListener('click', () => run('browserBack'));
  element('#browser-reload').addEventListener('click', () => run('browserReload'));
  element('#player-toggle').addEventListener('click', () => {
    if (playerState?.canControl) playerAction(playerState.paused ? 'play' : 'pause');
  });
  element('#player-seek').addEventListener('input', () => { seeking = true; });
  element('#player-seek').addEventListener('change', (event) => {
    seeking = false;
    playerAction('seek', { position: Number(event.target.value) });
  });
  element('#player-quality-read').addEventListener('click', () => playerAction('qualityMenu'));
  element('#player-episode-more').addEventListener('click', () => playerAction('episodeMore', {
    optionId: element('#player-episode-more').dataset.optionId,
  }));
  element('#player-seek').addEventListener('pointercancel', () => { seeking = false; });
  element('#player-mode').addEventListener('click', () => run('playerMode', { session: playerSession, compact: !playerCompact }));
  element('#player-fullscreen').addEventListener('click', () => run('playerFullscreen', {
    session: playerSession, enabled: !document.body.classList.contains('player-fullscreen'),
  }));
  element('#finish-login').addEventListener('click', async () => {
    if (state.browserMode === 'verify') { await run('finishVerification'); return; }
    const button = element('#finish-login');
    button.disabled = true;
    const result = await run('finishLogin');
    button.disabled = false;
    if (!result) return;
    state.auth.set(state.browserPlatform, result.auth);
    renderAccounts();
    notice(result.auth === 'authenticated' ? '已确认登录' : result.auth === 'anonymous'
      ? '官网仍显示未登录，请先完成登录' : '暂时无法确认账号登录，请完成官网登录后重试');
  });
  bridge.onEvent((message) => {
    if (message.type === 'update-state') renderUpdate(message.state);
    else if (message.type === 'browser') showBrowser(message);
    else if (message.type === 'system-theme') {
      systemDark = message.dark;
      if (theme === 'system') applyTheme();
    }
    else if (message.type === 'browser-closed') hideBrowser();
    else if (message.type === 'player-reset' && state.browserMode === 'play' && state.browser) resetPlayer(message.session);
    else if (message.type === 'player-state' && state.browser && playerCompact && message.session === playerSession) renderPlayer(message.state);
    else if (message.type === 'player-mode' && state.browserMode === 'play' && state.browser) playerMode(message.compact);
    else if (message.type === 'player-fullscreen') {
      document.body.classList.toggle('player-fullscreen', message.enabled);
      element('#player-fullscreen').textContent = message.enabled ? '退出全屏' : '全屏';
      requestAnimationFrame(syncBounds);
    }
    else if (message.type === 'auth-state') {
      state.auth.set(message.platform, message.auth);
      renderAccounts();
    }
    else if (message.type === 'notice') notice(message.message);
    else if (message.type === 'verified') {
      if (message.query && message.query === state.query) loadPlatform('search', message.platform, true);
      else if (!message.query) loadPlatform('home', message.platform, true);
    }
    else if (message.type === 'browser-loading') {
      element('#browser-status').textContent = message.loading ? '正在连接官网…'
        : playerCompact ? '官方播放引擎' : '官网页面';
    }
  });
  new ResizeObserver(syncBounds).observe(element('#browser-viewport'));
  window.addEventListener('resize', syncBounds);
  loadPreferences();
  loadHomeCache();
  applyTheme();
  renderTabs('home');
  renderTabs('search');
  renderAccounts();
  renderFavorites();
  renderResults('home');
  loadSelectedHome(true);
  updateCommand('updateStatus');
  run('info').then((info) => {
    if (!info) return;
    systemDark = info.systemDark;
    Object.entries(info.lastConfirmed || {}).forEach(([id, time]) => {
      if (findPlatform(id) && Number.isFinite(time) && time > 0) lastConfirmed.set(id, time);
    });
    renderAccounts();
    if (theme === 'system') applyTheme();
    element('#runtime-info').textContent = info.runtime;
    element('#drm-info').textContent = info.drm?.message || '播放能力由系统 WebView 和官网决定';
  });
}());
