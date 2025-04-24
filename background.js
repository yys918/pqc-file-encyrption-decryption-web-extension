// Service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Post-Quantum File Encryptor extension installed');
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DOWNLOAD_FILE') {
        chrome.downloads.download({
            url: message.url,
            filename: message.filename,
            saveAs: true
        });
    }
}); 