chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SERP_ANALYSIS_RESULT") {
    chrome.storage.local.set({ lastSerpAnalysis: message.payload }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});
