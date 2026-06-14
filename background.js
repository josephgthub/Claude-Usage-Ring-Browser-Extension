async function fetchUsage(fromCache = false) {
  if (fromCache) {
    const { usage } = await chrome.storage.local.get('usage');
    if (usage) return { success: true, usage };
    //if no cache, fall through to fetch
  }
  try {
    const orgRes = await fetch('https://claude.ai/api/organizations', { credentials: 'include' });
    if (!orgRes.ok) throw new Error('Not logged in');
    const orgs = await orgRes.json();
    const org = orgs.find(o => o.capabilities?.includes('chat'));
    if (!org) throw new Error('No org found');

    const usageRes = await fetch(`https://claude.ai/api/organizations/${org.uuid}/usage`, { credentials: 'include' });
    if (!usageRes.ok) throw new Error('Failed to fetch usage');
    const usage = await usageRes.json();

    const { fetchCount = 0 } = await chrome.storage.local.get('fetchCount');
    await chrome.storage.local.set({ usage, lastFetch: Date.now(), error: null, fetchCount: fetchCount + 1 });
    return { success: true, usage };
  } catch (e) {
    await chrome.storage.local.set({ error: e.message });
    return { success: false, error: e.message };
  }
}

chrome.runtime.onInstalled.addListener(() => fetchUsage());
chrome.runtime.onStartup.addListener(() => fetchUsage());

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === 'refresh') {
    fetchUsage().then(sendResponse);
    return true;
  }
});

// Fetch usage data and send it to the content script
async function sendUsageToContentScript(tabId) {
  const { success, usage } = await fetchUsage(); //use this if getting old cache data
  // const { success, usage } = await fetchUsage(true);
  if (!success) {
    console.error('Failed to fetch usage:', error);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (usage) => {
        // Update the tooltip with actual reset time
        const tooltip = document.querySelector('.claude-usage-ring div');
        if (tooltip) {
          const s = usage.five_hour;
          if (s) {
            const h = Math.floor((new Date(s.resets_at) - new Date()) / 3600000);
            const m = Math.floor(((new Date(s.resets_at) - new Date()) % 3600000) / 60000);
            tooltip.textContent = `Resets in ${h}h ${m}m`;
          }
        }

        // Render the actual usage value
        const svg = document.querySelector('.claude-usage-ring svg');
        if (svg) {
          const s = usage.five_hour;
          if (s) {
            const p = Math.round(s.utilization ?? 0);
            render(p);
          }
        }
      },
      args: [usage],
    });
  } catch (e) {
    console.error('Failed to execute script:', e);
  }
}

// Listen for tab updates to detect Claude.ai tabs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('claude.ai')) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      sendUsageToContentScript(tabId);
    } catch (e) {
      console.error('Failed to inject content script:', e);
    }
  }
});