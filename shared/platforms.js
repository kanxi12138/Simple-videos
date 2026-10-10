(function registerPlatforms(root) {
  'use strict';

  const platforms = [
    { id: 'tencent', name: '腾讯视频', short: '腾讯', color: '#1878ee', glyph: '腾',
      home: 'https://v.qq.com/', login: 'https://v.qq.com/',
      domains: ['qq.com'], media: '/(?:x/cover|x/page|cover)/',
      search: 'https://v.qq.com/x/search/?q={query}&cur={page}',
      authCookies: ['vqq_vusession', 'vqq_access_token', 'vusession', 'v_vusession'],
      hiddenAccountSelectors: ['#mod_head_user .user_nickname'],
      accountSelectors: ['.account-info .nickname', '.user-info .user-name', '.mod_user .user_name'] },
    { id: 'iqiyi', name: '爱奇艺', short: '爱奇艺', color: '#16a05b', glyph: '爱',
      home: 'https://www.iqiyi.com/', login: 'https://www.iqiyi.com/',
      domains: ['iqiyi.com'], media: '/(?:v_|a_)[a-zA-Z0-9]+\\.html|/tvg/to_page_url',
      search: 'https://so.iqiyi.com/so/q_{query}?page={page}',
      authCookies: ['P00001'],
      authenticatedSelectors: ['#btn_user[data-ai-entity*="用户头像按钮"]'],
      anonymousSelectors: ['#btn_user[data-ai-entity*="登录按钮"]'],
      accountSelectors: ['.header-userInfo .user-name', '.qy-header-user .user-name', '.qy-header-user .nickname'] },
    { id: 'youku', name: '优酷', short: '优酷', color: '#009be8', glyph: '优',
      home: 'https://www.youku.com/ku/webhome', login: 'https://www.youku.com/ku/webhome',
      domains: ['youku.com', 'tudou.com', 'taobao.com', 'alipay.com'], media: '/v_show/id_|/video(?:/|$)|/show_page/',
      search: 'https://so.youku.com/search_video/q_{query}?pg={page}',
      authCookies: ['P_sck', 'yktk', 'P_gck'],
      authenticatedSelectors: ['.crmusercenter_user_center_box .crmusercenter_avatar_logined'],
      accountSelectors: ['.yk-userlog .username', '.user-info .user-name', '.user-avatar .nickname'] },
    { id: 'mango', name: '芒果 TV', short: '芒果', color: '#ec8516', glyph: '芒',
      home: 'https://www.mgtv.com/', login: 'https://www.mgtv.com/',
      domains: ['mgtv.com'], media: '/(?:b/\\d+/\\d+|l/\\d+)',
      search: 'https://so.mgtv.com/so?k={query}&pn={page}',
      authCookies: ['HDCN', 'HDCN1'],
      loginTrigger: '.top-header-v2-actions__avatar',
      hiddenAccountSelectors: ['.avatar-popup .avatar-login .avatar-user-name'],
      accountSelectors: ['.avatar-login .nickname', '.avatar-login-name', '.avatar-login-title', '.user-info .nickname', '.user-name', '.user-login .name'] },
    { id: 'migu', name: '咪咕视频', short: '咪咕', color: '#d54893', glyph: '咪',
      home: 'https://www.miguvideo.com/', login: 'https://www.miguvideo.com/',
      domains: ['miguvideo.com', 'migu.cn', '10086.cn', 'cmcc.com'],
      media: '/(?:p/detail|p/play|detail|play|live)|/watch/',
      search: 'https://www.miguvideo.com/p/search?keywords={query}&page={page}',
      authCookies: ['userToken', 'UserToken', 'token', 'miguToken', 'userInfo'],
      loginTrigger: '.header-user .icon-item.user',
      hiddenAccountSelectors: ['.header-user .login-info-box .nick-name'],
      accountSelectors: ['.user-info-wrapper .name', '.user-info-wrapper .nickname', '.user-info .nickname', '.user-name', '.userName', '.user-info .name'] },
  ];

  const findPlatform = (id) => platforms.find((platform) => platform.id === id);
  const allowedUrl = (id, candidate) => {
    const platform = findPlatform(id);
    if (!platform || typeof candidate !== 'string') return false;
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' && !url.username && !url.password
        && platform.domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch { return false; }
  };
  const listUrl = (id, query, page = 1) => {
    const platform = findPlatform(id);
    if (!platform) throw new Error('未知平台');
    return query ? platform.search.replace('{query}', encodeURIComponent(query))
      .replace('{page}', String(page)) : platform.home;
  };

  root.SimplePlatforms = { platforms, findPlatform, allowedUrl, listUrl };
  if (typeof module !== 'undefined') module.exports = root.SimplePlatforms;
}(globalThis));
