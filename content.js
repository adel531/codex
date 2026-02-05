const SERP_SELECTORS = {
  resultItem: ".serp-item, [data-cid][data-fast-name]",
  title: "h2 a, .OrganicTitle-Link, a.Link",
  snippet:
    ".OrganicText, .text-container, .TextContainer, .text, .organic__subtitle",
  promoLabel:
    ".Label, .LabelText, .label, .serp-item__label, .OrganicLabel, .Label_type_promo, .label_type_promo",
  sitelinks: ".sitelinks, .Sitelinks, .LinksGroup",
  imageSnippet: ".serp-item__thumb, .Thumb-Image, img",
  videoSnippet: ".VideoSnippet, .video, .thumb-video, .OrganicVideo",
  faqSnippet: ".Faq, .FAQ, .OrganicFaq, .Answer"
};

const normalizeText = (value) => (value || "").replace(/\s+/g, " ").trim();

const stripUrlPrefix = (text) => {
  const cleaned = text
    .replace(/^[^\s]+›[^\s]+\s*/i, "")
    .replace(/^[\w.-]+\.[a-z]{2,}(?:\/[^\s]+)?\s*/i, "");
  return normalizeText(cleaned);
};

const getDomain = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
};

const isBlockedDomain = (url) => getDomain(url) === "yabs.yandex.ru";

const isPromoted = (item) => {
  const labels = Array.from(item.querySelectorAll(SERP_SELECTORS.promoLabel));
  return labels.some((label) => /промо/i.test(label.textContent || ""));
};

const detectSnippetTypes = (item) => {
  const types = [];
  if (item.querySelector(SERP_SELECTORS.sitelinks)) {
    types.push("sitelinks");
  }
  if (item.querySelector(SERP_SELECTORS.imageSnippet)) {
    types.push("image");
  }
  if (item.querySelector(SERP_SELECTORS.videoSnippet)) {
    types.push("video");
  }
  if (item.querySelector(SERP_SELECTORS.faqSnippet)) {
    types.push("faq");
  }
  return types;
};

const collectSerpResults = () => {
  const items = Array.from(document.querySelectorAll(SERP_SELECTORS.resultItem));
  const results = items
    .map((item) => {
      if (isPromoted(item)) {
        return null;
      }
      const titleEl = item.querySelector(SERP_SELECTORS.title);
      const url = titleEl?.getAttribute("href") || "";
      if (isBlockedDomain(url)) {
        return null;
      }
      const title = normalizeText(titleEl?.textContent);
      const snippetEl = item.querySelector(SERP_SELECTORS.snippet);
      const snippet = stripUrlPrefix(snippetEl?.textContent || "");
      if (!title || !url) {
        return null;
      }

      const domain = getDomain(url);
      const snippetTypes = detectSnippetTypes(item);

      return {
        title,
        url,
        domain,
        titleLength: title.length,
        snippet,
        snippetLength: snippet.length,
        snippetTypes
      };
    })
    .filter(Boolean);

  return {
    total: results.length,
    results,
    collectedAt: new Date().toISOString(),
    pageUrl: window.location.href
  };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "RUN_SERP_ANALYSIS") {
    const payload = collectSerpResults();
    chrome.runtime.sendMessage({ type: "SERP_ANALYSIS_RESULT", payload });
    sendResponse({ ok: true, payload });
  }
});
