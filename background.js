import { openDB } from "./lib/idb.js";

console.log("Domain Blocker loaded");

// The sites we count visits for.
// Subdomains count too, so "m.youtube.com" counts as "youtube.com".
const trackedSites = [
  "youtube.com",
  "reddit.com"
];


// ---------- Database ----------

let databasePromise = null;

// Opens the database the first time, and reuses it after that.
function getDatabase() {
  if (databasePromise === null) {
    databasePromise = openDB("nettsideBlocker", 1, {
      upgrade(db) {
        // One record per site per day: { domain: "x.com", day: "2026-11-09", count: 3 }
        db.createObjectStore("dailyVisits", { keyPath: ["domain", "day"] });
      }
    });
  }
  return databasePromise;
}

// Adds 1 to today's count for the site.
async function addVisit(domain) {
  const db = await getDatabase();
  const day = getToday();

  // Read and write in the same transaction,
  // so two visits at the same time can't overwrite each other.
  const transaction = db.transaction("dailyVisits", "readwrite");
  const record = await transaction.store.get([domain, day]);

  if (record) {
    record.count = record.count + 1;
    await transaction.store.put(record);
  } else {
    await transaction.store.put({ domain: domain, day: day, count: 1 });
  }

  await transaction.done;
}

// Returns how many times the site has been opened today.
async function getTodayCount(domain) {
  const db = await getDatabase();
  const record = await db.get("dailyVisits", [domain, getToday()]);

  if (record) {
    return record.count;
  }
  return 0;
}


// ---------- Helpers ----------

// Returns today's local date as text, like "2026-11-09".
function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + date;
}

// Returns the tracked site for a URL, or null if the URL is not tracked.
function findTrackedSite(url) {
  const parsedUrl = new URL(url);

  // Only normal web pages. Skips chrome://, file:// and so on.
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const hostname = parsedUrl.hostname;

  for (const site of trackedSites) {
    // Check for "." before the site, so "notyoutube.com" does not count as "youtube.com".
    if (hostname === site || hostname.endsWith("." + site)) {
      return site;
    }
  }

  return null;
}

// Returns which tracked site the tab was on before, or undefined.
async function getPreviousSite(tabId) {
  const tabKey = "tab-" + tabId;
  const saved = await chrome.storage.session.get(tabKey);
  return saved[tabKey];
}


// ---------- Blocking after one visit per day ----------

// A site is blocked if it was already opened today,
// unless the tab is already on that site (the first visit is still going on).
async function shouldBlock(site, previousSite) {
  if (site === previousSite) {
    return false;
  }

  const count = await getTodayCount(site);
  return count >= 1;
}

function showBlockedPage(tabId, site) {
  const blockedPageUrl = chrome.runtime.getURL("blocked.html") + "?site=" + encodeURIComponent(site);
  chrome.tabs.update(tabId, { url: blockedPageUrl });
}

// Check before the page starts loading, so the site barely shows.
chrome.webNavigation.onBeforeNavigate.addListener(async function (details) {
  if (details.frameId !== 0) {
    return;
  }

  const site = findTrackedSite(details.url);
  if (site === null) {
    return;
  }

  const previousSite = await getPreviousSite(details.tabId);

  if (await shouldBlock(site, previousSite)) {
    showBlockedPage(details.tabId, site);
  }
});


// ---------- Counting visits ----------

// We remember which tracked site each tab is on, so moving between
// pages on the same site does not count as a new visit.
// chrome.storage.session is used because the service worker can stop
// and lose normal variables. It is cleared when the browser closes.

chrome.webNavigation.onCommitted.addListener(async function (details) {
  // Only the main page in the tab, not iframes inside it.
  if (details.frameId !== 0) {
    return;
  }

  const site = findTrackedSite(details.url);
  const tabKey = "tab-" + details.tabId;
  const previousSite = await getPreviousSite(details.tabId);

  if (site === null) {
    // Left the tracked site, so coming back later counts as a new visit.
    await chrome.storage.session.remove(tabKey);
    return;
  }

  // Backup check, in case the page loaded before the check above finished.
  // A blocked visit is not counted.
  if (await shouldBlock(site, previousSite)) {
    showBlockedPage(details.tabId, site);
    return;
  }

  const newValue = {};
  newValue[tabKey] = site;
  await chrome.storage.session.set(newValue);

  if (site !== previousSite) {
    await addVisit(site);
  }
});

// Forget the tab when it is closed.
chrome.tabs.onRemoved.addListener(function (tabId) {
  chrome.storage.session.remove("tab-" + tabId);
});
