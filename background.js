// Track active tabs and their filtering status
const activeTabs = {};

// Listen for tab updates to apply content filtering
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        // Inject content script into the tab
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(err => console.log('Cannot inject script into special page'));
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'contentBlocked') {
        // Update blocked count
        chrome.storage.local.get({ blockedCount: 0 }, function(result) {
            chrome.storage.local.set({ blockedCount: result.blockedCount + 1 });
        });
    }
    sendResponse({ status: 'success' });
});

// Initialize default settings
chrome.runtime.onInstalled.addListener(function() {
    const defaultKeywords = {
        adult: ['explicit', 'porn', 'nsfw', 'adult', 'xxx', 'sex','desi'],
        nudity: ['naked', 'nude', 'undressed', 'bare', 'exposed'],
        violence: ['gore', 'violence', 'blood', 'brutal', 'attack', 'kill'],
        profanity: ['curse', 'swear', 'profanity', 'fuck', 'shit', 'asshole']
    };
    
    chrome.storage.local.set({
        enabled: true,
        blurImages: true,
        hideCompletely: false,
        blockedCount: 0,
        keywords: defaultKeywords,
        categoryStates: {
            adult: true,
            nudity: true,
            violence: true,
            profanity: true
        }
    });
});