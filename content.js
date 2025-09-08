// Function to scan and hide sensitive content
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
        
        // Combine all active keywords
        let allKeywords = [];
        for (const category in settings.categoryStates) {
            if (settings.categoryStates[category] && settings.keywords[category]) {
                allKeywords = allKeywords.concat(settings.keywords[category]);
            }
        }
        
        if (allKeywords.length === 0) return;
        
        // Select elements to check
        const elements = document.querySelectorAll('p, div, span, article, section, header, footer, aside, main, img, video, a');
        
        elements.forEach(element => {
            // Check text content
            const text = element.textContent?.toLowerCase();
            if (text) {
                for (let keyword of allKeywords) {
                    if (text.includes(keyword.toLowerCase())) {
                        applyFilter(element, settings);
                        break;
                    }
                }
            }
            
            // Check image alt text
            const altText = element.getAttribute('alt')?.toLowerCase();
            if (altText) {
                for (let keyword of allKeywords) {
                    if (altText.includes(keyword.toLowerCase())) {
                        applyFilter(element, settings);
                        break;
                    }
                }
            }
            
            // Check data attributes that might contain text
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                if (attr.name.startsWith('data-') && typeof attr.value === 'string') {
                    const attrValue = attr.value.toLowerCase();
                    for (let keyword of allKeywords) {
                        if (attrValue.includes(keyword.toLowerCase())) {
                            applyFilter(element, settings);
                            break;
                        }
                    }
                }
            }
        });
        
        // Update blocked count
        chrome.storage.local.get({ blockedCount: 0 }, function(result) {
            chrome.storage.local.set({ blockedCount: result.blockedCount + 1 });
        });
    });
}

// Apply filter to element based on settings
function applyFilter(element, settings) {
    if (settings.hideCompletely) {
        element.style.display = 'none';
    } else if (settings.blurImages && (element.tagName === 'IMG' || element.tagName === 'VIDEO')) {
        element.style.filter = 'blur(20px)';
        element.style.transition = 'filter 0.3s ease';
        element.title = 'Content hidden by ContentShield';
    } else {
        element.style.filter = 'blur(5px)';
        element.style.transition = 'filter 0.3s ease';
        element.title = 'Content hidden by ContentShield';
    }
}

// Initialize content scanning
chrome.storage.local.get({ enabled: true }, function(settings) {
    if (settings.enabled) {
        // Run initially
        scanAndHide();
        
        // Set up MutationObserver to detect new content
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    scanAndHide();
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also scan on interval to catch any dynamic content
        setInterval(scanAndHide, 3000);
    }
});

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'scan') {
        scanAndHide();
        sendResponse({ status: 'success' });
    }
});