function barColor(p) {
  if (p >= 80) return '#e05c5c';
  if (p >= 50) return '#d4a017';
  return '#3b9eca';
}

function timeUntil(iso) {
  if (!iso) return '';
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return 'resetting soon';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `resets in ${h}h ${m}m` : `resets in ${m}m`;
}

function weeklyReset(iso) {
  if (!iso) return '';
  return 'resets ' + new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function render(usage) {
  document.getElementById('error').style.display = 'none';

  const s = usage.five_hour;
  const w = usage.seven_day;

  if (s) {
    const p = Math.round(s.utilization ?? 0);
    document.getElementById('s-pct').textContent = p + '%';
    document.getElementById('s-bar').style.width = Math.min(p, 100) + '%';
    document.getElementById('s-bar').style.backgroundColor = barColor(p);
    document.getElementById('s-reset').textContent = timeUntil(s.resets_at);
  }

  if (w) {
    const p = Math.round(w.utilization ?? 0);
    document.getElementById('w-pct').textContent = p + '%';
    document.getElementById('w-bar').style.width = Math.min(p, 100) + '%';
    document.getElementById('w-bar').style.backgroundColor = barColor(p);
    document.getElementById('w-reset').textContent = weeklyReset(w.resets_at);
  }
}

function showError(msg) {
  const el = document.getElementById('error');
  el.style.display = 'block';
  el.textContent = (msg?.includes('401') || msg?.includes('403') || msg?.includes('logged'))
    ? 'Log in to claude.ai first'
    : (msg || 'Failed to load');
}

async function load() {
  const { usage, error } = await chrome.storage.local.get(['usage', 'error', 'lastFetch']);
  if (usage) render(usage);
  if (error && !usage) showError(error);
}

async function refresh() {
  const btn = document.getElementById('reload');
  btn.classList.add('spinning');
  btn.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: 'refresh' });
  if (res.success) render(res.usage);
  else showError(res.error);
  btn.classList.remove('spinning');
  btn.disabled = false;
}

document.getElementById('reload').addEventListener('click', refresh);
load().then(refresh);
