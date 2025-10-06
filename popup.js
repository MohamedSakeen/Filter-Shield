document.addEventListener('DOMContentLoaded', function() {
    // Default keywords for each category
    const defaultKeywords = {
        adult: ['explicit', 'porn', 'nsfw', 'adult', 'xxx', 'sex','xnxx','xvideos','pornhub','hentai','xhamster','redtube','xham'],
        nudity: ['naked', 'nude', 'undressed', 'bare', 'exposed','topless','lingerie','lingery','lingary','lingarye','lingaryee','lingaryeee'],
        violence: ['gore', 'violence', 'blood', 'brutal', 'attack', 'kill','fight','war','killing','murder','suscide','genocide'],
        profanity: ['curse', 'swear', 'profanity', 'fuck', 'shit', 'asshole']
    };

    // Load settings and keywords from storage
    chrome.storage.local.get({
        enabled: true,
        blurImages: true,
        hideCompletely: false,
        blockedCount: 0,
        keywords: null,  // ← null means “not initialized yet”
        categoryStates: {
            adult: true,
            nudity: true,
            violence: true,
            profanity: true
        }
    }, function(settings) {
        // If keywords have never been saved before, initialize them with defaults
        if (!settings.keywords) {
            settings.keywords = defaultKeywords;
            chrome.storage.local.set({ keywords: defaultKeywords });
        }

        // Set toggle states
        document.getElementById('toggleEnabled').checked = settings.enabled;
        document.getElementById('toggleBlur').checked = settings.blurImages;
        document.getElementById('toggleHide').checked = settings.hideCompletely;
        
        // Set blocked count
        document.getElementById('blockedCount').textContent = settings.blockedCount;
        
        // Set category toggles and render keywords
        const categories = ['adult', 'nudity', 'violence', 'profanity'];
        categories.forEach(category => {
            // Set category toggle state
            const toggle = document.querySelector(`input[data-category="${category}"]`);
            if (toggle) {
                toggle.checked = settings.categoryStates[category];
                // Render keywords for this category
                renderKeywords(category, settings.keywords[category] || []);
            }
        });
    });

    // Toggle functionality
    document.getElementById('toggleEnabled').addEventListener('change', function() {
        chrome.storage.local.set({ enabled: this.checked });
    });
    
    document.getElementById('toggleBlur').addEventListener('change', function() {
        chrome.storage.local.set({ blurImages: this.checked });
    });
    
    document.getElementById('toggleHide').addEventListener('change', function() {
        chrome.storage.local.set({ hideCompletely: this.checked });
    });

    // Category toggle functionality
    document.querySelectorAll('input[data-category]').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const category = this.getAttribute('data-category');
            chrome.storage.local.get({ categoryStates: {} }, function(settings) {
                const categoryStates = settings.categoryStates;
                categoryStates[category] = toggle.checked;
                chrome.storage.local.set({ categoryStates: categoryStates });
            });
        });
    });

    // Add keyword functionality
    document.querySelectorAll('.add-keyword button').forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            const input = document.querySelector(`.add-keyword input[data-category="${category}"]`);
            const keyword = input.value.trim().toLowerCase();
            
            if (keyword) {
                chrome.storage.local.get({ keywords: {} }, function(settings) {
                    const keywords = settings.keywords || {};
                    if (!keywords[category]) keywords[category] = [];
                    
                    // Add keyword if not already present
                    if (!keywords[category].includes(keyword)) {
                        keywords[category].push(keyword);
                        chrome.storage.local.set({ keywords: keywords }, function() {
                            renderKeywords(category, keywords[category]);
                            input.value = '';
                        });
                    }
                });
            }
        });
    });

    // Function to render keywords for a category
    function renderKeywords(category, keywords) {
        const container = document.querySelector(`.filter-content[data-category="${category}"]`);
        container.innerHTML = '';
        
        keywords.forEach(keyword => {
            const keywordTag = document.createElement('div');
            keywordTag.className = 'keyword-tag';
            keywordTag.innerHTML = `
                <span>${keyword}</span>
                <button data-keyword="${keyword}" data-category="${category}">&times;</button>
            `;
            container.appendChild(keywordTag);
            
            // Add event to remove button
            keywordTag.querySelector('button').addEventListener('click', function() {
                const keywordToRemove = this.getAttribute('data-keyword');
                const category = this.getAttribute('data-category');
                
                chrome.storage.local.get({ keywords: {} }, function(settings) {
                    const keywords = settings.keywords;
                    if (keywords[category]) {
                        keywords[category] = keywords[category].filter(k => k !== keywordToRemove);
                        chrome.storage.local.set({ keywords: keywords }, function() {
                            renderKeywords(category, keywords[category]);
                        });
                    }
                });
            });
        });
    }
});
