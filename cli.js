#!/usr/bin/env node
/**
 * 纯真IP库命令行查询工具
 * 
 * 使用方法:
 *   node cli.js 114.114.114.114
 *   node cli.js home.zeruns.com
 *   node cli.js 240e:3b0:8216:5517::1
 *   node cli.js -6 ipv6.google.com
 * 
 * v2.0 — 使用模块化架构，支持 IPv4/IPv6/域名解析+智能分类
 */

const net = require('net');
const ipdb = require('./src/ipdb');
const { classifyFields } = require('./src/classifier');

function printResult(data, input) {
  const { province, ispClean, ownerClean, countryCity } = classifyFields(
    data.region, data.isp, data.owner, data.country
  );

  console.log('============================================');
  console.log('  纯真IP库 地理位置查询结果');
  console.log('============================================');
  if (input && input !== data.ip) {
    console.log(`  域名:    ${input}`);
  }
  console.log(`  IP:      ${data.ip}`);
  console.log(`  类型:    ${data.type}`);
  console.log('--------------------------------------------');
  console.log(`  国家:    ${(data.country || '').split(/[–-]/)[0] || data.country || '-'}${data.country_code ? ' (' + data.country_code + ')' : ''}`);
  console.log(`  省份:    ${province || '-'}`);
  console.log(`  城市:    ${countryCity || data.city || '-'}`);
  console.log(`  区县:    ${data.district || '-'}`);
  console.log(`  运营商:  ${ispClean || '-'}`);
  console.log(`  所有者:  ${ownerClean || '-'}`);
  console.log(`  子网:    /${data.bitmask || '-'}`);
  console.log('============================================');
}

async function main() {
  const args = process.argv.slice(2);
  let forceV6 = false;
  let q = args[0];

  // 解析 -6 参数：node cli.js -6 ipv6.google.com
  if (args[0] === '-6' && args[1]) {
    forceV6 = true;
    q = args[1];
  }

  if (!q) {
    console.log('使用方法: node cli.js [选项] <IP地址或域名>');
    console.log('选项:');
    console.log('  -6    强制解析 IPv6 地址');
    console.log('');
    console.log('示例:');
    console.log('  node cli.js 114.114.114.114');
    console.log('  node cli.js home.zeruns.com');
    console.log('  node cli.js 240e:3b0:8216:5517::1');
    console.log('  node cli.js -6 ipv6.google.com');
    process.exit(1);
  }

  try {
    let result;
    if (forceV6 && !net.isIP(q)) {
      const addrs = await ipdb.resolveIPv6(q);
      if (!addrs || addrs.length === 0) {
        console.log(`错误: 域名 ${q} 无 IPv6 记录`);
        process.exit(1);
      }
      result = ipdb.query(addrs[0]);
      result.ip = addrs[0];
      result.type = 'IPv6';
    } else {
      result = await ipdb.queryWithResolve(q);
    }

    if (!result.success) {
      console.log(`错误: ${result.error}`);
      process.exit(1);
    }

    if (result.results && result.results.length > 1) {
      console.log(`域名: ${q}`);
      console.log(`解析到 ${result.count} 个地址 (IPv4: ${result.ipv4_count}, IPv6: ${result.ipv6_count})`);
      console.log('');
      printResult(result, q);
      if (result.results.length > 1) {
        console.log('\n所有解析地址:');
        result.results.forEach((r, i) => {
          const { province, ispClean } = classifyFields(r.region, r.isp, r.owner, r.country);
          const loc = [province, r.city, ispClean].filter(Boolean).join(' ');
          console.log(`  ${i+1}. [${r.type}] ${r.ip} ${loc ? '— ' + loc : ''}`);
        });
      }
    } else {
      printResult(result, q);
    }
  } catch (e) {
    console.log(`查询出错: ${e.message}`);
    process.exit(1);
  }
}

main();
