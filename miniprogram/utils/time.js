const zones = [
  { label: '新西兰 · 基督城', value: 'Pacific/Auckland' },
  { label: '中国 · 北京', value: 'Asia/Shanghai' },
  { label: '澳大利亚 · 悉尼', value: 'Australia/Sydney' },
  { label: '英国 · 伦敦', value: 'Europe/London' },
  { label: '美国 · 洛杉矶', value: 'America/Los_Angeles' },
  { label: '美国 · 纽约', value: 'America/New_York' },
  { label: '加拿大 · 温哥华', value: 'America/Vancouver' }
];
function formatTime(iso, zone) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  } catch (_) { return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC（当前基础库不支持时区显示）'; }
}
module.exports = { zones, formatTime };
