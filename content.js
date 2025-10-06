// content.js - Blur or hide entire sections containing keywords

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function ensureStyles() {
  if (document.getElementById('contentshield-styles')) return;
  const style = document.createElement('style');
  style.id = 'contentshield-styles';
  style.textContent = `
    .contentshield-blur {
      filter: blur(8px);
      transition: filter 0.25s ease;
    }
    .contentshield-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Find the nearest block-level ancestor (stop before body/html)
function chooseBlockElement(textNode) {
  let el = textNode.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);

    // Good block-level candidates
    if (
      ["block", "flex", "grid", "list-item", "table"].includes(style.display) ||
      ["P", "DIV", "SECTION", "ARTICLE", "LI"].includes(el.tagName)
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return textNode.parentElement; // fallback, never return <body>
}

function blurBlock(node, settings) {
  const block = chooseBlockElement(node);
  if (!block || block.dataset.contentshield === '1') return;

  if (settings.hideCompletely) {
    block.classList.add('contentshield-hidden');
  } else {
    block.classList.add('contentshield-blur');
    block.title = 'Content hidden by ContentShield';
  }
  block.dataset.contentshield = '1';
}

function applyFilterToMedia(el, settings) {
  if (el.dataset.contentshield === '1') return;

  // Block the source to stop loading the actual content
  if ('src' in el) el.removeAttribute('src');
  if ('srcset' in el) el.removeAttribute('srcset');

  // Replace with transparent placeholder (keeps size)
  if (el.tagName === 'IMG') {
    el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  }
  if (el.tagName === 'VIDEO') {
    el.poster = '';
  }

  // Apply blur/hide style
  if (settings.hideCompletely) {
    el.classList.add('contentshield-hidden');
  } else {
    el.classList.add('contentshield-blur');
    el.title = 'Content blocked by ContentShield';
  }

  el.dataset.contentshield = '1';
}

function scanAndHide() {
  chrome.storage.local.get({
    enabled: true,
    blurImages: true,
    hideCompletely: false,
    keywords: {},
    categoryStates: {
      adult: true,
      nudity: true,
      violence: true,
      profanity: true
    }
  }, function(settings) {
    if (!settings.enabled) return;

    let allKeywords = [];
    for (const cat in settings.categoryStates) {
      if (settings.categoryStates[cat] && settings.keywords[cat]) {
        allKeywords = allKeywords.concat(settings.keywords[cat]);
      }
    }
    if (allKeywords.length === 0) return;

    ensureStyles();

    const escaped = allKeywords
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    if (escaped.length === 0) return;

    const regex = new RegExp(escaped.join('|'), 'i');

    // Handle images/videos separately
    if (settings.blurImages || settings.hideCompletely) {
      const media = document.querySelectorAll('img, video');
      media.forEach(el => {
        if (el.dataset.contentshield === '1') return;
        const text = `${el.alt || ''} ${el.title || ''} ${el.src || ''}`.toLowerCase();
        if (regex.test(text)) {
          applyFilterToMedia(el, settings);
        }
      });
    }

    // Walk text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          if (node.nodeValue.trim().length < 3) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && node.parentElement.dataset.contentshield === '1') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    let matches = 0;
    while ((node = walker.nextNode())) {
      const tag = node.parentElement?.tagName;
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(tag)) continue;

      const text = node.nodeValue;
      if (regex.test(text)) {
        blurBlock(node, settings);
        matches++;
      }
    }

    if (matches > 0) {
      chrome.storage.local.get({ blockedCount: 0 }, function(result) {
        chrome.storage.local.set({ blockedCount: result.blockedCount + matches });
      });
    }
  });
}

// declare debouncedScan only once
const debouncedScan = debounce(scanAndHide, 300);

function initObserver() {
  const observer = new MutationObserver(() => debouncedScan());
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } else {
    setTimeout(initObserver, 200);
  }
}

chrome.storage.local.get({ enabled: true }, function(settings) {
  if (settings.enabled) {
    ensureStyles();
    scanAndHide();
    initObserver();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    scanAndHide();
    sendResponse({ status: 'success' });
  }
});

function preventMediaLoad(regex) {
  const media = document.querySelectorAll('img, video, source');
  media.forEach(el => {
    if (el.dataset.contentshield === '1') return;
    const text = `${el.alt || ''} ${el.title || ''} ${el.src || ''} ${el.srcset || ''}`.toLowerCase();
    if (regex.test(text)) {
      if ('src' in el) el.removeAttribute('src');
      if ('srcset' in el) el.removeAttribute('srcset');
      if (el.tagName === 'IMG') {
        el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      }
      el.dataset.contentshield = '1';
    }
  });

  // Dynamically added media
  document.body.addEventListener('load', e => {
    const el = e.target;
    if (!el || el.dataset.contentshield === '1') return;
    if (['IMG', 'SOURCE', 'VIDEO'].includes(el.tagName)) {
      const text = `${el.alt || ''} ${el.title || ''} ${el.src || ''} ${el.srcset || ''}`.toLowerCase();
      if (regex.test(text)) {
        if ('src' in el) el.removeAttribute('src');
        if ('srcset' in el) el.removeAttribute('srcset');
        if (el.tagName === 'IMG') {
          el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
        }
        el.dataset.contentshield = '1';
      }
    }
  }, true);
}

    // For dynamically added images/videos
    const blockMediaLoad = (e) => {
      const el = e.target;
      if (!el || el.dataset.contentshield === '1') return;
      let text = '';
      if (el.tagName === 'IMG' || el.tagName === 'SOURCE' || el.tagName === 'VIDEO') {
        text = `${el.alt || ''} ${el.title || ''} ${el.src || ''} ${el.srcset || ''}`.toLowerCase();
        if (regex.test(text)) {
          if ('src' in el) el.src = '';
          if ('srcset' in el) el.srcset = '';
          el.removeAttribute('src');
          el.removeAttribute('srcset');
          el.dataset.contentshield = '1';
        }
      }
    };

    document.body.addEventListener('load', blockMediaLoad, true);

preventMediaLoad();
