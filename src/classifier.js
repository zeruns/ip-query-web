/**
 * 纯真IP库智能分类器
 *
 * 纯真IP库的 region 字段可能混用省份名、运营商名或公司名。
 * 本模块提供统一的字段分类逻辑，供 CLI、前端等复用。
 * 同时支持 CommonJS (Node.js) 和 <script> 加载 (浏览器)。
 */

(function() {
  // ISP 关键词
  var ISP_KEYWORDS = ['电信', '联通', '移动', '铁通', '广电', '骨干网', '教育网', '科技网',
    '长城宽带', '阿里云', '腾讯云', '华为云', 'CZ88.NET'];

  // 中国省级行政区列表
  var PROVINCE_LIST = ['北京', '天津', '上海', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海',
    '台湾', '广西', '内蒙古', '宁夏', '新疆',
    '西藏', '香港', '澳门'];

  function isProvinceName(str) {
    if (!str) return false;
    return PROVINCE_LIST.some(function(p) { return str === p || str.startsWith(p); });
  }

  function isKnownOrg(str) {
    if (!str) return false;
    if (/电信|联通|移动|铁通|广电|骨干网|教育网|科技网|长城宽带|阿里云|腾讯云|华为云/.test(str)) return true;
    if (/公司|集团|有限公|网络科技|数据中心|IDC/.test(str)) return true;
    return false;
  }

  /**
   * 智能分类纯真IP库的字段
   *
   * @param {string} region - region 字段
   * @param {string} isp - isp 字段
   * @param {string} owner - owner 字段
   * @param {string} country - country 字段
   * @returns {{ province: string, ispClean: string, ownerClean: string, countryCity: string }}
   */
  function classifyFields(region, isp, owner, country) {
    var province = region || '';
    var ispClean = isp || '';
    var ownerClean = owner || '';
    var countryProvince = '';
    var countryCity = '';

    if (country && /–/.test(country)) {
      var parts = country.split('–');
      if (parts.length >= 2) countryProvince = parts[1];
      if (parts.length >= 3) countryCity = parts[2];
    }

    if (region && !isProvinceName(region) && isKnownOrg(region)) {
      if (region.includes('电信') || region.includes('联通') || region.includes('移动')
          || region.includes('铁通') || region.includes('广电') || region.includes('骨干网')
          || region.includes('教育网') || region.includes('科技网')) {
        ispClean = ispClean ? ispClean + ' / ' + region.replace(/^中国/, '') : region;
      } else {
        ownerClean = ownerClean ? ownerClean + ' / ' + region : region;
      }
      province = '';
    }

    if (!province && countryProvince) province = countryProvince;

    if (region && isKnownOrg(region) && !isProvinceName(region) && countryProvince) {}

    if (province && /^中国(电信|联通|移动|铁通|广电)/.test(province)) {
      if (!ispClean) ispClean = province;
      province = '';
    }

    if (province && !isProvinceName(province)) {
      for (var i = 0; i < PROVINCE_LIST.length; i++) {
        var p = PROVINCE_LIST[i];
        if (province.startsWith(p)) { province = p; break; }
      }
    }

    return { province: province, ispClean: ispClean, ownerClean: ownerClean, countryCity: countryCity };
  }

  // 浏览器环境：暴露到全局
  if (typeof window !== 'undefined') {
    window.classifyFields = classifyFields;
  }

  // Node.js 环境：CommonJS 导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classifyFields: classifyFields };
  }
})();
