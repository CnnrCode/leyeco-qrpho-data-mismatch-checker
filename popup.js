document.getElementById("launchBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "open_dashboard" }, (response) => {
    window.close(); // Close the popup window
  });
});
