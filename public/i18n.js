/**
 * i18n 国际化引擎
 *
 * 功能：
 * - 自动检测浏览器语言 (navigator.language)
 * - 从 localStorage 读取用户语言偏好
 * - 加载对应 JSON 翻译文件
 * - 替换页面中所有 data-i18n 元素的文本
 * - 提供语言切换 API
 */
(function(){
  var I18N = window.I18N = {};
  var currentLang = 'zh-CN';
  var translations = {};
  var tCache = {};

  // 支持的语言
  var SUPPORTED = ['zh-CN', 'en'];

  // 检测语言优先级：localStorage > 浏览器语言 > 默认 zh-CN
  function detectLang() {
    var stored = localStorage.getItem('lang');
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav.indexOf('zh') === 0) return 'zh-CN';
    // 其他语言默认英语
    return 'en';
  }

  // 加载翻译文件
  function load(lang, cb) {
    if (tCache[lang]) {
      translations = tCache[lang];
      currentLang = lang;
      cb();
      return;
    }
    fetch('/lang/' + lang + '.json')
      .then(function(r){ return r.json(); })
      .then(function(data){
        tCache[lang] = data;
        translations = data;
        currentLang = lang;
        localStorage.setItem('lang', lang);
        cb();
      })
      .catch(function(){
        console.warn('[i18n] 加载 ' + lang + ' 翻译失败，使用默认中文');
        currentLang = 'zh-CN';
        cb();
      });
  }

  // 应用翻译
  function apply() {
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var val = getTranslation(key);
      if (val) el.textContent = val;
    }
    // 处理 placeholder
    var phs = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < phs.length; j++) {
      var p = phs[j];
      var k = p.getAttribute('data-i18n-placeholder');
      var v = getTranslation(k);
      if (v) p.placeholder = v;
    }
    // 处理 title 属性
    var tts = document.querySelectorAll('[data-i18n-title]');
    for (var kk = 0; kk < tts.length; kk++) {
      var tt = tts[kk];
      var tk = tt.getAttribute('data-i18n-title');
      var tv = getTranslation(tk);
      if (tv) tt.title = tv;
    }
  }

  // 获取翻译值（支持 . 分隔的嵌套 key）
  function getTranslation(key) {
    var parts = key.split('.');
    var obj = translations;
    for (var i = 0; i < parts.length; i++) {
      if (!obj) return null;
      obj = obj[parts[i]];
    }
    return typeof obj === 'string' ? obj : null;
  }

  // 公开 t() 方法供页面 JS 使用
  I18N.t = getTranslation;

  // 切换语言
  I18N.switchTo = function(lang, cb) {
    load(lang, function(){
      apply();
      document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en';
      if (cb) cb();
    });
  };

  I18N.getLang = function(){ return currentLang; };

  // 初始化
  var lang = detectLang();
  load(lang, function(){
    apply();
    document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en';
  });

})();
