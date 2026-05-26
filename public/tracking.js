/**
 * 统一统计代码（模板）
 * 集中管理百度统计、Google Analytics、Cloudflare Analytics
 *
 * ------------------------------------------------------------
 * 部署说明：复制本文件到生产环境后，将占位 ID 替换为实际值
 *   百度统计: 登录 tongji.baidu.com -> 管理 -> 获取代码 -> 找到 hm.js? 后的 ID
 *   Google Analytics (GA4): 登录 analytics.google.com -> 管理 -> 数据流 -> 衡量 ID (G-XXXXXXXXXX)
 *   Cloudflare Web Analytics: 登录 dash.cloudflare.com -> Analytics & Logs -> Web Analytics -> 获取 token
 * ------------------------------------------------------------
 */

// 百度统计
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.async = true;
  hm.src = "https://hm.baidu.com/hm.js?YOUR_BAIDU_ID";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();

// Google Analytics (GA4)
(function() {
  var ga = document.createElement('script');
  ga.async = true;
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=YOUR_GA_ID';
  document.head.appendChild(ga);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'YOUR_GA_ID');
})();

// Cloudflare Web Analytics
(function() {
  var cf = document.createElement('script');
  cf.async = true;
  cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  cf.setAttribute('data-cf-beacon', '{"token":"YOUR_CF_TOKEN"}');
  document.head.appendChild(cf);
})();
