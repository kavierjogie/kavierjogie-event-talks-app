// Application State
let state = {
    updates: [],
    filteredUpdates: [],
    currentCategory: 'all',
    searchQuery: '',
    selectedUpdate: null,
    selectedHashtags: new Set(['#BigQuery', '#GoogleCloud']),
    lastFetchedTime: null
};

// DOM Elements
const DOM = {
    feedGrid: document.getElementById('feedGrid'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    emptyState: document.getElementById('emptyState'),
    errorMsg: document.getElementById('errorMsg'),
    refreshBtn: document.getElementById('refreshBtn'),
    cacheInfo: document.getElementById('cacheInfo'),
    searchInput: document.getElementById('searchInput'),
    categoryFilters: document.getElementById('categoryFilters'),
    themeToggle: document.getElementById('themeToggle'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    
    // Stats
    totalCount: document.getElementById('totalCount'),
    featureCount: document.getElementById('featureCount'),
    issueCount: document.getElementById('issueCount'),
    otherCount: document.getElementById('otherCount'),
    
    // Modal
    tweetModal: document.getElementById('tweetModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    tweetContent: document.getElementById('tweetContent'),
    charCount: document.getElementById('charCount'),
    progressCircle: document.getElementById('progressCircle'),
    hashtagPills: document.getElementById('hashtagPills'),
    copyTweetBtn: document.getElementById('copyTweetBtn'),
    postTweetBtn: document.getElementById('postTweetBtn'),
    
    // Toast
    toast: document.getElementById('toast')
};

// SVG Spinner Icon rotation trigger
const refreshIcon = DOM.refreshBtn.querySelector('svg');

// Progress Circle Setup
const CIRCUMFERENCE = 2 * Math.PI * 8; // r=8 -> ~50.26
DOM.progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    DOM.refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });
    
    // Search input
    DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    });
    
    // Category pills
    DOM.categoryFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        
        // Remove active class from siblings
        DOM.categoryFilters.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');
        
        state.currentCategory = pill.dataset.type;
        applyFilters();
    });
    
    // Modal Close
    DOM.closeModalBtn.addEventListener('click', closeTweetModal);
    DOM.tweetModal.addEventListener('click', (e) => {
        if (e.target === DOM.tweetModal) closeTweetModal();
    });
    
    // Tweet Textarea Change
    DOM.tweetContent.addEventListener('input', handleTweetTextareaChange);
    
    // Hashtags Pill Toggling
    DOM.hashtagPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.hashtag-pill');
        if (!pill) return;
        
        const tag = pill.dataset.tag;
        if (state.selectedHashtags.has(tag)) {
            state.selectedHashtags.delete(tag);
            pill.classList.remove('selected');
        } else {
            state.selectedHashtags.add(tag);
            pill.classList.add('selected');
        }
        
        rebuildTweetTextWithHashtags();
    });
    
    // Copy Tweet Button
    DOM.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    
    // Post Tweet Button
    DOM.postTweetBtn.addEventListener('click', postTweetToTwitter);

    // Export CSV Button
    if (DOM.exportCsvBtn) {
        DOM.exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Theme Toggle Switch
    if (DOM.themeToggle) {
        DOM.themeToggle.addEventListener('change', handleThemeChange);
    }
}

// Fetch Release Notes from Backend API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    try {
        refreshIcon.classList.add('loading');
        DOM.refreshBtn.disabled = true;
        
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'error') {
            throw new Error(result.error || 'Server parsing error');
        }
        
        state.updates = result.data;
        state.lastFetchedTime = result.last_fetched;
        
        updateCacheIndicator(state.lastFetchedTime);
        updateStats(state.updates);
        applyFilters();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        DOM.errorMsg.textContent = error.message;
        showError(true);
    } finally {
        refreshIcon.classList.remove('loading');
        DOM.refreshBtn.disabled = false;
        showLoading(false);
    }
}

// Cache Info String Formatter
function updateCacheIndicator(epochSeconds) {
    if (!epochSeconds) return;
    const date = new Date(epochSeconds * 1000);
    const formatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    DOM.cacheInfo.textContent = `Last synced: ${formatted}`;
}

// Update Dashboard Statistics Card
function updateStats(items) {
    const total = items.length;
    const features = items.filter(item => item.type.toLowerCase() === 'feature').length;
    const issues = items.filter(item => item.type.toLowerCase() === 'issue').length;
    const others = total - features - issues;
    
    animateNumberValue(DOM.totalCount, total);
    animateNumberValue(DOM.featureCount, features);
    animateNumberValue(DOM.issueCount, issues);
    animateNumberValue(DOM.otherCount, others);
}

// Stats Number Counting Animation for Premium Feel
function animateNumberValue(element, targetValue) {
    let start = 0;
    const duration = 500; // ms
    const stepTime = 15; // ms
    const increment = targetValue / (duration / stepTime);
    
    const timer = setInterval(() => {
        start += increment;
        if (start >= targetValue) {
            element.textContent = targetValue;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start);
        }
    }, stepTime);
}

// Filter and Search Logic
function applyFilters() {
    state.filteredUpdates = state.updates.filter(item => {
        // Category Filter
        let categoryMatch = false;
        const itemType = item.type.toLowerCase();
        
        if (state.currentCategory === 'all') {
            categoryMatch = true;
        } else if (state.currentCategory === 'feature') {
            categoryMatch = itemType === 'feature';
        } else if (state.currentCategory === 'issue') {
            categoryMatch = itemType === 'issue';
        } else if (state.currentCategory === 'deprecated') {
            categoryMatch = itemType === 'deprecated';
        } else if (state.currentCategory === 'other') {
            categoryMatch = itemType !== 'feature' && itemType !== 'issue' && itemType !== 'deprecated';
        }
        
        // Search Filter (date, type, description content)
        const searchMatch = !state.searchQuery || 
            item.date.toLowerCase().includes(state.searchQuery) ||
            item.type.toLowerCase().includes(state.searchQuery) ||
            item.plain_text.toLowerCase().includes(state.searchQuery);
            
        return categoryMatch && searchMatch;
    });
    
    renderFeed();
}

// Render the updates card stream
function renderFeed() {
    DOM.feedGrid.innerHTML = '';
    
    if (state.filteredUpdates.length === 0) {
        showEmpty(true);
        DOM.feedGrid.classList.add('hidden');
        return;
    }
    
    showEmpty(false);
    DOM.feedGrid.classList.remove('hidden');
    
    state.filteredUpdates.forEach(update => {
        const card = document.createElement('article');
        card.className = 'release-card';
        card.dataset.type = update.type;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="meta-group">
                    <span class="date-badge">${update.date}</span>
                    <span class="type-badge">${update.type}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-copy-card" title="Copy this update to clipboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn-tweet-share" title="Compose a tweet for this release note">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            </div>
            <div class="card-content">
                ${update.content_html}
            </div>
        `;
        
        // Copy card content action
        const copyBtn = card.querySelector('.btn-copy-card');
        copyBtn.addEventListener('click', async () => {
            const copyText = `[BigQuery - ${update.date}] ${update.type}: ${update.plain_text}`;
            try {
                await navigator.clipboard.writeText(copyText);
                showToast('Update copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy card text:', err);
                showToast('Failed to copy to clipboard!');
            }
        });

        // Tweet button event inside the card
        const tweetBtn = card.querySelector('.btn-tweet-share');
        tweetBtn.addEventListener('click', () => openTweetModal(update));
        
        DOM.feedGrid.appendChild(card);
    });
}

// Open Tweet Composer Modal
function openTweetModal(update) {
    state.selectedUpdate = update;
    
    // Sync default hashtag selections
    DOM.hashtagPills.querySelectorAll('.hashtag-pill').forEach(pill => {
        const tag = pill.dataset.tag;
        if (state.selectedHashtags.has(tag)) {
            pill.classList.add('selected');
        } else {
            pill.classList.remove('selected');
        }
    });
    
    generateDefaultTweetContent();
    DOM.tweetModal.classList.remove('hidden');
    DOM.tweetContent.focus();
}

// Close Tweet Modal
function closeTweetModal() {
    DOM.tweetModal.classList.add('hidden');
    state.selectedUpdate = null;
}

// Default Tweet Text Generator with proper truncation
function generateDefaultTweetContent() {
    if (!state.selectedUpdate) return;
    
    const date = state.selectedUpdate.date;
    const type = state.selectedUpdate.type.toUpperCase();
    const bodyText = state.selectedUpdate.plain_text;
    
    // Start formatting
    const header = `BigQuery (${date}) | ${type}:\n`;
    
    // Construct hashtags string
    const hashtagsStr = state.selectedHashtags.size > 0 
        ? '\n\n' + Array.from(state.selectedHashtags).join(' ') 
        : '';
        
    // Max body length is 280 - header length - hashtags length
    const reservedLength = header.length + hashtagsStr.length;
    const maxBodyLength = 280 - reservedLength;
    
    let processedBodyText = bodyText;
    if (processedBodyText.length > maxBodyLength) {
        processedBodyText = processedBodyText.substring(0, maxBodyLength - 3) + "...";
    }
    
    const fullTweet = `${header}${processedBodyText}${hashtagsStr}`;
    
    DOM.tweetContent.value = fullTweet;
    updateProgressIndicator(fullTweet.length);
}

// Rebuild tweet content when hashtags are toggled
function rebuildTweetTextWithHashtags() {
    if (!state.selectedUpdate) return;
    
    const text = DOM.tweetContent.value;
    
    // Separate body text and old hashtags by stripping hashtags from the end
    // Standard approach: since we generated it, let's just regenerate the text to prevent manual edits from getting lost.
    // However, if the user manually edited, we should preserve their edits if possible!
    // Let's do a smart parse: find where our hashtags list was, or just replace/update the end hashtags.
    
    // Simple way to maintain edits:
    // 1. Get the current text
    // 2. Filter out any hashtags that match our standard set from the end of the text
    // 3. Append the new set of active selected hashtags
    let cleanedText = text;
    
    // Regex matching our hashtags at the very end of the string
    const hashtagRegex = /(?:\r?\n)*\s*(#[a-zA-Z0-9_]+\s*)+$/;
    cleanedText = cleanedText.replace(hashtagRegex, '');
    
    const hashtagsStr = state.selectedHashtags.size > 0 
        ? '\n\n' + Array.from(state.selectedHashtags).join(' ') 
        : '';
        
    // If it exceeds 280 characters, notify the user but don't force truncate their custom edits.
    const newTweet = cleanedText + hashtagsStr;
    DOM.tweetContent.value = newTweet;
    updateProgressIndicator(newTweet.length);
}

// Handle Textarea manual typing changes
function handleTweetTextareaChange(e) {
    const text = e.target.value;
    updateProgressIndicator(text.length);
    
    // Keep tag pills visually in sync if user manually types them (Optional premium touch!)
    DOM.hashtagPills.querySelectorAll('.hashtag-pill').forEach(pill => {
        const tag = pill.dataset.tag;
        if (text.includes(tag)) {
            state.selectedHashtags.add(tag);
            pill.classList.add('selected');
        } else {
            state.selectedHashtags.delete(tag);
            pill.classList.remove('selected');
        }
    });
}

// Update Character progress indicator (circle and number)
function updateProgressIndicator(length) {
    DOM.charCount.textContent = length;
    
    // Color states
    const countContainer = DOM.charCount.parentElement;
    if (length > 280) {
        countContainer.className = 'char-count-container exceeded';
        DOM.postTweetBtn.disabled = true;
    } else if (length > 250) {
        countContainer.className = 'char-count-container warning';
        DOM.postTweetBtn.disabled = false;
    } else {
        countContainer.className = 'char-count-container';
        DOM.postTweetBtn.disabled = false;
    }
    
    // Stroke dashoffset calculation
    const progress = Math.min(1, length / 280);
    const offset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
    DOM.progressCircle.style.strokeDashoffset = offset;
    
    // Change color of progress circle indicator
    if (length > 280) {
        DOM.progressCircle.style.stroke = 'var(--accent-issue)';
    } else if (length > 250) {
        DOM.progressCircle.style.stroke = 'var(--accent-deprecated)';
    } else {
        DOM.progressCircle.style.stroke = 'var(--brand-primary)';
    }
}

// Copy Tweet text to Clipboard
async function copyTweetToClipboard() {
    const text = DOM.tweetContent.value;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Tweet copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        DOM.tweetContent.select();
        document.execCommand('copy');
        showToast('Tweet copied to clipboard!');
    }
}

// Post Tweet direct action - opens Web Intent in popup window
function postTweetToTwitter() {
    const text = DOM.tweetContent.value;
    if (text.length > 280) return;
    
    const encoded = encodeURIComponent(text);
    const url = `https://twitter.com/intent/tweet?text=${encoded}`;
    
    // Open in a standard centered popup window
    const width = 550;
    const height = 420;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(url, 'twitter-share', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    closeTweetModal();
}

// Custom Toast popup notification
function showToast(msg) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.remove('hidden');
    
    setTimeout(() => {
        DOM.toast.classList.add('hidden');
    }, 2500);
}

// Utility functions for UI States switching
function showLoading(show) {
    if (show) {
        DOM.loadingState.classList.remove('hidden');
        DOM.errorState.classList.add('hidden');
        DOM.emptyState.classList.add('hidden');
    } else {
        DOM.loadingState.classList.add('hidden');
    }
}

function showError(show) {
    if (show) {
        DOM.errorState.classList.remove('hidden');
        DOM.loadingState.classList.add('hidden');
        DOM.emptyState.classList.add('hidden');
        DOM.feedGrid.classList.add('hidden');
    } else {
        DOM.errorState.classList.add('hidden');
    }
}

function showEmpty(show) {
    if (show) {
        DOM.emptyState.classList.remove('hidden');
    } else {
        DOM.emptyState.classList.add('hidden');
    }
}

// Export filtered release notes list to CSV
function exportToCSV() {
    if (state.filteredUpdates.length === 0) {
        showToast('No updates to export!');
        return;
    }
    
    let csvContent = "ID,Date,Type,Description\r\n";
    
    state.filteredUpdates.forEach(item => {
        const idVal = `"${item.id.replace(/"/g, '""')}"`;
        const dateVal = `"${item.date.replace(/"/g, '""')}"`;
        const typeVal = `"${item.type.replace(/"/g, '""')}"`;
        
        const cleanText = item.plain_text.replace(/\r?\n|\r/g, " ");
        const descVal = `"${cleanText.replace(/"/g, '""')}"`;
        
        csvContent += `${idVal},${dateVal},${typeVal},${descVal}\r\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const filterName = state.currentCategory !== 'all' ? `_${state.currentCategory}` : '';
    link.setAttribute("download", `bigquery_release_notes${filterName}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Exported CSV successfully!');
}

// Initialize light/dark theme toggle state
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    
    if (savedTheme === 'light' || (!savedTheme && systemPrefersLight)) {
        document.body.classList.add('light-theme');
        if (DOM.themeToggle) {
            DOM.themeToggle.checked = true;
        }
    } else {
        document.body.classList.remove('light-theme');
        if (DOM.themeToggle) {
            DOM.themeToggle.checked = false;
        }
    }
}

// Handle theme toggle switch toggling
function handleThemeChange(e) {
    if (e.target.checked) {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
    }
}
