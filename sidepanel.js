const runButton = document.getElementById("run-analysis");
const copyButton = document.getElementById("copy-table");
const exportButton = document.getElementById("export-csv");
const statusEl = document.getElementById("status");
const resultsBody = document.getElementById("results-body");
const tldFilter = document.getElementById("filter-tld");
const snippetFilter = document.getElementById("filter-snippet");

let latestPayload = null;
const selectedUrls = new Set();

const setStatus = (text) => {
  statusEl.textContent = text;
};

const calculateAverage = (values) => {
  if (!values.length) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const getTld = (domain) => {
  const parts = domain.split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts.at(-1);
};

const populateFilters = (results) => {
  const tlds = new Set();
  results.forEach((result) => {
    const tld = getTld(result.domain);
    if (tld) {
      tlds.add(tld);
    }
  });

  const current = tldFilter.value;
  tldFilter.innerHTML = '<option value="all">Все</option>';
  Array.from(tlds)
    .sort()
    .forEach((tld) => {
      const option = document.createElement("option");
      option.value = tld;
      option.textContent = `.${tld}`;
      tldFilter.appendChild(option);
    });
  tldFilter.value = current;
};

const matchesFilters = (result) => {
  const tldValue = tldFilter.value;
  const snippetValue = snippetFilter.value;

  if (tldValue !== "all" && getTld(result.domain) !== tldValue) {
    return false;
  }
  if (snippetValue !== "all" && !result.snippetTypes.includes(snippetValue)) {
    return false;
  }
  return true;
};

const renderResults = (payload) => {
  resultsBody.innerHTML = "";

  if (!payload?.results?.length) {
    setStatus("Нет результатов для отображения.");
    return;
  }

  const filtered = payload.results.filter(matchesFilters);
  filtered.forEach((result, index) => {
    const row = document.createElement("tr");
    const indexCell = document.createElement("td");
    indexCell.textContent = String(index + 1);

    const selectCell = document.createElement("td");
    selectCell.className = "select-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedUrls.has(result.url);
    checkbox.addEventListener("change", (event) => {
      if (event.target.checked) {
        selectedUrls.add(result.url);
      } else {
        selectedUrls.delete(result.url);
      }
    });
    selectCell.appendChild(checkbox);

    const titleCell = document.createElement("td");
    titleCell.textContent = result.title;

    const descriptionCell = document.createElement("td");
    descriptionCell.textContent = result.snippet || "—";

    const urlCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = result.url;
    urlCell.appendChild(link);

    const domainCell = document.createElement("td");
    domainCell.textContent = result.domain;

    const titleLengthCell = document.createElement("td");
    titleLengthCell.textContent = String(result.titleLength);

    const snippetLengthCell = document.createElement("td");
    snippetLengthCell.textContent = String(result.snippetLength);

    const snippetTypesCell = document.createElement("td");
    snippetTypesCell.innerHTML = result.snippetTypes
      .map((type) => `<span class="tag">${type}</span>`)
      .join("");

    row.append(
      indexCell,
      selectCell,
      titleCell,
      descriptionCell,
      urlCell,
      domainCell,
      titleLengthCell,
      snippetLengthCell,
      snippetTypesCell
    );
    resultsBody.appendChild(row);
  });

  setStatus(
    `Показано ${filtered.length} из ${payload.results.length}. Обновлено: ${new Date(
      payload.collectedAt
    ).toLocaleString()}`
  );
};

const updateSummary = (payload) => {
  const results = payload?.results || [];
  document.getElementById("summary-total").textContent = results.length || "—";
  document.getElementById("summary-title").textContent = results.length
    ? `${calculateAverage(results.map((r) => r.titleLength))} симв.`
    : "—";
  document.getElementById("summary-snippet").textContent = results.length
    ? `${calculateAverage(results.map((r) => r.snippetLength))} симв.`
    : "—";
};

const updateView = (payload) => {
  latestPayload = payload;
  populateFilters(payload?.results || []);
  updateSummary(payload);
  renderResults(payload);
};

const requestAnalysis = async () => {
  setStatus("Анализируем выдачу...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("Не удалось определить активную вкладку.");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "RUN_SERP_ANALYSIS" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Запустите анализ на странице выдачи Яндекса.");
      return;
    }
    if (response?.payload) {
      updateView(response.payload);
    }
  });
};

const exportCsv = () => {
  if (!latestPayload?.results?.length) {
    setStatus("Нет данных для экспорта.");
    return;
  }
  const headers = [
    "#",
    "Selected",
    "Title",
    "Description",
    "URL",
    "Domain",
    "Title length",
    "Snippet length",
    "Snippet types"
  ];
  const rows = latestPayload.results.map((result, index) => [
    index + 1,
    selectedUrls.has(result.url) ? "yes" : "no",
    result.title,
    result.snippet,
    result.url,
    result.domain,
    result.titleLength,
    result.snippetLength,
    result.snippetTypes.join("|")
  ]);
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "yandex-serp-analysis.csv";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("CSV экспортирован.");
};

const copyTable = async () => {
  if (!latestPayload?.results?.length) {
    setStatus("Нет данных для копирования.");
    return;
  }
  const rows = latestPayload.results.map(
    (result, index) =>
      `${index + 1}\t${selectedUrls.has(result.url) ? "yes" : "no"}\t${
        result.title
      }\t${result.snippet}\t${result.url}\t${result.domain}\t${
        result.titleLength
      }\t${result.snippetLength}\t${result.snippetTypes.join("|")}`
  );
  const header =
    "#\tSelected\tTitle\tDescription\tURL\tDomain\tTitle length\tSnippet length\tSnippet types";
  await navigator.clipboard.writeText([header, ...rows].join("\n"));
  setStatus("Таблица скопирована в буфер.");
};

runButton.addEventListener("click", requestAnalysis);
copyButton.addEventListener("click", copyTable);
exportButton.addEventListener("click", exportCsv);
tldFilter.addEventListener("change", () => renderResults(latestPayload));
snippetFilter.addEventListener("change", () => renderResults(latestPayload));

chrome.storage.local.get("lastSerpAnalysis", (data) => {
  if (data?.lastSerpAnalysis) {
    updateView(data.lastSerpAnalysis);
  } else {
    setStatus("Запустите анализ на странице выдачи Яндекса.");
  }
});
