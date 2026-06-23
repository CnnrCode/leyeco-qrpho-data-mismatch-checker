chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    sendResponse({ success: true });
  }
});
