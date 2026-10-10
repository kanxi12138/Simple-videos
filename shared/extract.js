(function registerExtractor(root) {
  'use strict';

  // Run only inside the platform page. Return public metadata, never account credentials.
  function extractPage(config) {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const bodyText = clean(document.body?.innerText);
    const visible = (element) => Boolean(element && element.getClientRects().length);
    const selectors = {
      tencent: ['.figure_title', '.figure_detail', '.video-title', '[class*="title"]'],
      iqiyi: ['.title', '.main-title', '.qy-mod-link', '[class*="title"]'],
      youku: ['.title', '.video-title', '[class*="title"]'],
      mango: ['.title', '.video-title', '[class*="title"]'],
      migu: ['.title', '.name', '[class*="title"]', '[class*="name"]'],
    };
    const mediaPattern = new RegExp(config.media);
    const searching = config.pageType === 'search';
    const searchRegions = {
      tencent: '.searchable-content',
      iqiyi: '.tab-content, .qy-search-result',
      youku: 'main, #searchContent',
      mango: '.leftbar',
      migu: '.search-container .video-list, .search-container .drama-item, .search-container .movie-item, .search-container .variety-item',
    };
    const inSearchResults = (node) => !searching || Boolean(node.closest(searchRegions[config.id]));
    const normalizeCover = (value) => {
      if (!value) return '';
      try {
        const url = new URL(value, location.href);
        if (url.protocol === 'http:') url.protocol = 'https:';
        if (url.protocol !== 'https:' || url.username || url.password
          || /\/(?:placeholder|loading|blank|spacer|default[-_]?cover)(?:[._/-]|$)/i.test(url.pathname)) return '';
        return url.href;
      } catch { return ''; }
    };
    const readCover = (image) => {
      if (!image || /mark|avatar|logo|icon|badge|metaTags|placeholder/i.test(`${image.className} ${image.alt} ${image.parentElement?.className}`)) return '';
      const sources = [image.getAttribute('data-src'), image.getAttribute('data-original'),
        image.getAttribute('data-lazy'), image.getAttribute('data-lazy-src')];
      const sourceSets = [image.getAttribute('data-srcset'), image.getAttribute('srcset')];
      sourceSets.filter((value) => value && !value.startsWith('data:')).forEach((value) => {
        value.split(',').map((entry) => entry.trim().split(/\s+/))
          .sort((first, second) => (parseFloat(second[1]) || 1) - (parseFloat(first[1]) || 1))
          .forEach(([url]) => sources.push(url));
      });
      sources.push(image.currentSrc, image.getAttribute('src'));
      return sources.map(normalizeCover).find(Boolean) || '';
    };
    const findCover = (node) => node ? [...node.querySelectorAll('img')].map(readCover).find(Boolean) || '' : '';
    const items = new Map();
    document.querySelectorAll('a[href]').forEach((anchor) => {
      if (!inSearchResults(anchor)) return;
      let url;
      try { url = new URL(anchor.href, location.href); } catch { return; }
      if (url.protocol !== 'https:' || !config.domains.some((domain) => url.hostname === domain
        || url.hostname.endsWith(`.${domain}`)) || !mediaPattern.test(url.pathname)) return;
      // The history popup contains private playback links, not public recommendations.
      if (config.id === 'mango' && (anchor.closest('.history-popup, .history-item, [mg-stat-mod="c_historypop"]')
        || url.searchParams.get('fpa') === 'c_historypop')) return;
      if (!clean(anchor.textContent) && !anchor.getAttribute('title') && !anchor.querySelector('img')) return;
      const searchCard = searching && anchor.closest('.root.list-item, .search-board-item, .m-search-program, .video-item, .drama-item, .movie-item, .variety-item');
      const candidate = searchCard || anchor.closest('[class*="card"], [class*="item"], [class*="figure"], li');
      const card = candidate && candidate.querySelectorAll('img').length < 6 ? candidate : anchor.parentElement || anchor;
      const image = (anchor.querySelector('img:not([class*="mark"]):not([class*="avatar"])')
        || card.querySelector('img:not([class*="mark"]):not([class*="avatar"])'));
      const titleElement = card.querySelector(selectors[config.id].join(','));
      const specificTitle = config.id === 'iqiyi'
        ? anchor.querySelector('[class*="thumbnailItemTitle"], [data-ai-entity="视频标题"], [data-ai-entity="缩略图标题"]') : null;
      const ownTitle = config.id === 'mango' ? clean(anchor.querySelector('[class*="title"]')?.textContent || anchor.textContent) : '';
      const title = clean(specificTitle?.textContent || anchor.getAttribute('title') || ownTitle || titleElement?.getAttribute('title')
        || titleElement?.textContent || image?.getAttribute('alt') || anchor.textContent);
      if (!title || title.length > 100 || /^(立即播放|播放|更多|详情|观看|VIP|会员|预告|正片|ad|广告|\d+(?::\d+)*|Sample Image)$/i.test(title)) return;
      // An episode shares only the official poster inside its own program result.
      const program = searching && config.id === 'mango' ? anchor.closest('.m-search-program') : null;
      const cover = findCover(anchor) || findCover(program ? program.querySelector('.proleft') : card);
      const description = clean(card.querySelector('[class*="desc"], [class*="subtitle"], [class*="sub-title"]')?.textContent).slice(0, 160);
      // Keep the original official URL, but strip tracking from the stable identity.
      const contentId = (config.id === 'tencent' ? url.pathname.match(/\/x\/cover\/([^/.]+)/)?.[1] : null)
        || url.searchParams.get('cid') || url.searchParams.get('contentId')
        || url.searchParams.get('vid') || url.searchParams.get('s') || url.searchParams.get('id')
        || url.searchParams.get('album_id') || url.searchParams.get('tv_id') || url.pathname;
      const key = `${config.id}:${contentId}`;
      const item = { key, id: contentId, platform: config.id, title, cover, description,
        type: /直播|赛事|live/i.test(`${card.textContent} ${url.pathname}`) ? 'live' : 'vod', url: url.href };
      if (!items.has(key) || specificTitle || (!items.get(key).cover && cover)) {
        items.set(key, { ...item, cover: cover || items.get(key)?.cover || '' });
      }
    });
    const addPublicItem = (id, title, cover, description, url, type = 'vod') => {
      if (!id || !clean(title) || !url) return;
      try {
        const parsed = new URL(url, location.href);
        if (parsed.protocol !== 'https:' || !config.domains.some((domain) => parsed.hostname === domain
          || parsed.hostname.endsWith(`.${domain}`))) return;
        const key = `${config.id}:${id}`;
        items.set(key, { key, id: String(id), platform: config.id, title: clean(title),
          cover: normalizeCover(cover) || items.get(key)?.cover || '', description: clean(description).slice(0, 160),
          url: parsed.href, type });
      } catch { /* An invalid public card link is excluded. */ }
    };
    const seen = new WeakSet();
    let visited = 0;
    const walk = (node) => {
      if (!node || typeof node !== 'object' || seen.has(node) || ++visited > 40000) return;
      seen.add(node);
      if (config.id === 'tencent' && node.cid && node.title && (node.coverPic || node.pic || node.poster)) {
        addPublicItem(node.cid, node.title, node.smallCoverPic || node.coverPic || node.pic || node.poster,
          node.subTitle || node.recNormalReason, `https://v.qq.com/x/cover/${encodeURIComponent(node.cid)}.html`);
      }
      if (config.id === 'youku' && /^JUMP_TO_(SHOW|VIDEO)$/.test(node.action_type) && node.title) {
        const target = String(node.action_value || '');
        const url = node.link || node.url || node.videoLink
          || (target ? `https://v.youku.com/video?${target.startsWith('X') ? 'vid' : 's'}=${encodeURIComponent(target)}` : '');
        if (url) addPublicItem(node.action_value, node.title, node.img || node.hImg,
          node.desc || node.subtitle, url.replace(/^http:/, 'https:'));
      }
      if (config.id === 'migu' && (node.title || node.name) && node.action?.params?.contentID) {
        const id = node.action.params.contentID;
        addPublicItem(id, node.title || node.name, node.pics?.highResolutionV || node.pics?.highResolutionH
          || node.pics?.lowResolutionH || node.cover, node.competitionName || node.subTitle,
          `https://www.miguvideo.com/p/detail/${encodeURIComponent(id)}`,
          node.programTypeV2 === 'LIVE' ? 'live' : 'vod');
      }
      Object.entries(node).forEach(([key, child]) => {
        if (!/user|login|cookie|token|account|credential/i.test(key)) walk(child);
      });
    };
    if (!searching && config.id === 'tencent') walk(window.__vikor__context__?.ssrPayloads?._piniaState);
    if (!searching && config.id === 'youku') walk(window.__INITIAL_DATA__);
    if (!searching && config.id === 'migu') { walk(window.__INITIAL_COMPS_STATE__); walk(window.__INITIAL_GROUPS_STATE__); }
    if (config.id === 'migu') {
      document.querySelectorAll('.drama-item,.video-item,.movie-item,.variety-item').forEach((node) => {
        if (!inSearchResults(node)) return;
        const data = node.__vue__?.$props?.showData;
        if (data) walk(data);
      });
    }
    if (config.id === 'tencent' && location.pathname.includes('/search')) {
      document.querySelectorAll('[dt-params]').forEach((node) => {
        if (!inSearchResults(node)) return;
        const params = new URLSearchParams(node.getAttribute('dt-params'));
        const cid = params.get('cid');
        const vid = params.get('vid');
        if (!cid && !vid) return;
        const card = node.closest('.root.list-item,.row,[class*="result-item"],[class*="video-card"],.card') || node.parentElement;
        const title = clean(card.querySelector('.summary-title,[class*="summary__title"],[class*="title"]')?.textContent);
        addPublicItem(cid || vid, title, findCover(card),
          card.querySelector('[class*="description"],[class*="subtitle"]')?.textContent,
          cid ? `https://v.qq.com/x/cover/${encodeURIComponent(cid)}.html`
            : `https://v.qq.com/x/page/${encodeURIComponent(vid)}.html`);
      });
    }
    const { auth } = extractAuthPage(config);
    const challenged = /安全验证|访问过于频繁|拖动滑块|完成验证|验证后继续|异常访问/.test(bodyText)
      && items.size === 0;
    const empty = /没有找到|未找到相关|暂无相关|暂无搜索|无搜索结果|没有相关/.test(bodyText);
    const next = [...document.querySelectorAll('a[href]')].find((element) => visible(element)
      && /^(下一页|下页|Next|›|>)$/i.test(clean(element.textContent))
      && !/disabled/.test(element.className));
    let nextUrl = next?.href || null;
    try { if (nextUrl && new URL(nextUrl).origin !== location.origin) nextUrl = null; } catch { nextUrl = null; }
    const loadMore = [...document.querySelectorAll('button, a, [role="button"]')].some((element) => visible(element)
      && /^(加载更多|查看更多结果|更多结果)$/.test(clean(element.textContent)));
    const metadata = (selector) => clean(document.querySelector(selector)?.getAttribute('content'));
    const detail = mediaPattern.test(location.pathname) ? {
      title: metadata('meta[property="og:title"]') || metadata('meta[name="title"]'),
      description: metadata('meta[property="og:description"]') || metadata('meta[name="description"]'),
      cover: metadata('meta[property="og:image"]'),
    } : null;
    return { items: [...items.values()], detail, auth, challenged, empty, nextUrl, loadMore,
      title: clean(document.title), ready: document.readyState === 'complete' };
  }

  const scriptFor = (config) => `(() => {
    const extractAuthPage = ${extractAuthPage.toString()};
    return (${extractPage.toString()})(${JSON.stringify(config)});
  })()`;
  function extractAuthPage(config) {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => Boolean(element && element.getClientRects().length);
    const controls = [...document.querySelectorAll('a,button,[role="button"],span,div')];
    const login = controls.some((element) => visible(element)
      && /^(登录|立即登录|请登录|登录\/注册|登录注册|登录·注册)$/.test(clean(element.textContent)))
      || (config.anonymousSelectors || []).some((selector) => [...document.querySelectorAll(selector)].some(visible));
    const logout = controls.some((element) => visible(element)
      && /^(退出登录|退出账号|注销登录)$/.test(clean(element.textContent)));
    const namedAccount = (node) => Boolean(clean(node.textContent)
      && !/登录|注册|游客|未登录|用户昵称/.test(node.textContent));
    const account = (config.accountSelectors || []).some((selector) => [...document.querySelectorAll(selector)]
      .some((node) => visible(node) && namedAccount(node)));
    // Only confirmed logged-in branches may provide evidence while their popup is closed.
    const hiddenAccount = (config.hiddenAccountSelectors || []).some((selector) => [...document.querySelectorAll(selector)]
      .some(namedAccount));
    const loggedBranch = (config.authenticatedSelectors || []).some((selector) => Boolean(document.querySelector(selector)));
    let sdkAuthenticated = false;
    try {
      if (config.id === 'tencent' && window.txv?.login?.hasReady === true
        && typeof window.txv.login.isLogin === 'function') sdkAuthenticated = window.txv.login.isLogin() === true;
      if (config.id === 'youku') sdkAuthenticated = window.yklogininstance?.isLoginStatus === true;
      if (config.id === 'migu' && typeof window.mgUserInfo?.isLogin === 'function') {
        sdkAuthenticated = window.mgUserInfo.isLogin() === true;
      }
    } catch {
      // SDK initialization may be incomplete; use the scoped official DOM evidence instead.
    }
    // An SDK's initial false is not proof of a completed anonymous session check.
    const authenticated = sdkAuthenticated || loggedBranch || hiddenAccount || logout || account;
    return { auth: authenticated ? 'authenticated' : login ? 'anonymous' : 'unknown',
      challenged: /安全验证|访问过于频繁|拖动滑块|完成验证|验证后继续|异常访问/.test(clean(document.body?.innerText)),
      ready: document.readyState === 'complete' };
  }

  root.SimpleExtractor = { extractPage, extractAuthPage, scriptFor };
  if (typeof module !== 'undefined') module.exports = root.SimpleExtractor;
}(globalThis));
