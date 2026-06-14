(function() {
  // Guard against multiple injections
  if (window.__claudeUsageInjected) {
    console.log('Claude Usage: script already injected');
    return;
  }
  window.__claudeUsageInjected = true;

  const RING_SELECTOR = '.claude-usage-ring';
  const BUTTON_SELECTOR = '[aria-label="Add files, connectors, and more"]';

  let observerStarted = false;
  let currentRing = null;
  const AUTO_FETCH = 1; // set to 0 to disable auto-fetch

function getButton() {
  return document.querySelector(BUTTON_SELECTOR);
}

function getRing() {
  return document.querySelector(RING_SELECTOR);
}

function updateTooltipText(tooltip, resetsAt, is_fetch_failed) {
  if (!tooltip) return;
  if (is_fetch_failed == 0) {
    if (!resetsAt) {
      tooltip.textContent = `Resets in ?h ?m`;
      return;
    }
    const resetDate = new Date(resetsAt);
    if (isNaN(resetDate)) {
      tooltip.textContent = `Resets in ?h ?m`;
      return;
    }
    const diff = resetDate - new Date();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    tooltip.textContent = `Resets in ${h}h ${m}m`;
  } else {
    tooltip.textContent = `Failed to fetch`;
  }
}

function createRing() {
  const wrapper = document.createElement('div');
  wrapper.className = 'claude-usage-ring';
  wrapper.style.cssText = 'position:relative;flex-shrink:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center';

  const tooltip = document.createElement('div');
  tooltip.textContent = 'Resets in ?h ?m';
  tooltip.style.cssText = `
    position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);
    background:#2c2c2a;color:#fff;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    white-space:nowrap;padding:4px 8px;border-radius:6px;pointer-events:none;
    opacity:0;transition:opacity 0.15s ease;z-index:9999;
    border:0.5px solid #444441;
  `;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  svg.style.cssText = 'transition:transform 0.15s ease,opacity 0.15s ease';

  let isLoading = false;
  let spinAngle = 0;
  let spinFrame = null;

  function stopSpin() {
    if (spinFrame) {
      cancelAnimationFrame(spinFrame);
      spinFrame = null;
    }
  }

  function setLoading() {
    isLoading = true;
    const r = 11;
    const cx = 14;
    const cy = 14;
    const circ = 2 * Math.PI * r;

    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-200,#e5e2d9)" stroke-width="2.5"/>
      <circle id="claude-arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#d85a30" stroke-width="2.5"
        stroke-dasharray="${circ * 0.25} ${circ * 0.75}" stroke-linecap="round"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
        font-size="10" font-weight="600" fill="#aaaaaa"
        font-family="-apple-system,BlinkMacSystemFont,sans-serif">?</text>
    `;

    const arc = svg.querySelector('#claude-arc');
    spinAngle = 0;

    function spin() {
      spinAngle = (spinAngle + 4) % 360;
      arc.setAttribute('transform', `rotate(${spinAngle} ${cx} ${cy})`);
      spinFrame = requestAnimationFrame(spin);
    }

    spin();
  }

  function render(value) {
    stopSpin();
    isLoading = false;
    const r = 11;
    const cx = 14;
    const cy = 14;
    const circ = 2 * Math.PI * r;
    const fill = (value / 100) * circ;

    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#555555" stroke-width="2.5" stroke-opacity="0.4"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#d85a30" stroke-width="2.5"
        stroke-dasharray="${fill} ${circ}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
        font-size="9.5" font-weight="600" fill="#aaaaaa"
        font-family="-apple-system,BlinkMacSystemFont,sans-serif">${value}</text>
    `;
  }

  function reload() {
    setLoading();
    chrome.runtime.sendMessage({ type: 'refresh' }, (response) => {
      if (response && response.success) {
        const usage = response.usage.five_hour;
        render(Math.round(usage.utilization ?? 0));
        updateTooltipText(tooltip, usage.resets_at,0);
      } else {
        render('!');
        updateTooltipText(tooltip, null,1);
      }
    });
  }

  setLoading();

  wrapper.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
    if (!isLoading) svg.style.transform = 'scale(1.15)';
  });
  wrapper.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    svg.style.transform = 'scale(1)';
  });
  wrapper.addEventListener('mousedown', () => {
    if (isLoading) return;
    svg.style.opacity = '0.5';
    svg.style.transform = 'scale(0.9)';
  });
  wrapper.addEventListener('mouseup', () => {
    if (isLoading) return;
    svg.style.opacity = '1';
    svg.style.transform = 'scale(1.15)';
    reload();
  });

  wrapper.appendChild(tooltip);
  wrapper.appendChild(svg);

  return { wrapper, render, tooltip, reload };
}

function insertRing() {
  if (getRing()) return;

  const btn = getButton();
  if (!btn?.parentElement) return;

  const ring = createRing();
  currentRing = ring;
  btn.parentElement.insertAdjacentElement('afterend', ring.wrapper);

  chrome.runtime.sendMessage({ type: 'refresh' }, (response) => {
    if (response && response.success) {
      const usage = response.usage.five_hour;
      ring.render(Math.round(usage.utilization ?? 0));
      updateTooltipText(ring.tooltip, usage.resets_at,0);
    } else {
      ring.render('!');
      updateTooltipText(tooltip, null,1);
    }
  });
}

function ensureRing() {
  if (!getRing()) {
    insertRing();
  }
}

function insertRingWithoutFetch() {
  if (getRing()) return;

  const btn = getButton();
  if (!btn?.parentElement) return;

  const ring = createRing();
  currentRing = ring;
  btn.parentElement.insertAdjacentElement('afterend', ring.wrapper);

  // Get last cached value from storage instead of fetching
  chrome.storage.local.get(['usage'], (result) => {
    if (result.usage) {
      const usage = result.usage.five_hour;
      ring.render(Math.round(usage.utilization ?? 0));
      updateTooltipText(ring.tooltip, usage.resets_at,0);
    }
  });
}

function startObserver() {
  if (observerStarted || window.__claudeUsageObserverStarted) return;
  observerStarted = true;
  window.__claudeUsageObserverStarted = true;

  const observer = new MutationObserver(() => {
    if (!getRing()) {
      insertRingWithoutFetch();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  let wasGenerating = false;
  const responseObserver = new MutationObserver(() => {
    const stopBtn = document.querySelector('button[aria-label="Stop response"]');

    if (stopBtn && !wasGenerating) {
      console.log("✅ Response started");
      wasGenerating = true;
    }

    if (!stopBtn && wasGenerating) {
      console.log("🏁 Response ended");
      wasGenerating = false;
      if (AUTO_FETCH === 1 && currentRing) currentRing.reload();
    }
  });

  responseObserver.observe(document.body, { childList: true, subtree: true });
}

ensureRing();
startObserver();
})();