import { openDB } from "./lib/idb.js";

console.log("Domain Blocker loaded");

// The sites we count visits for.
// Subdomains count too, so "m.youtube.com" counts as "youtube.com".
const trackedSites = [
  "youtube.com",
  "reddit.com",
  "vg.no",
  "nrk.no",
  "instagram.com"
];

// How many times a site can be opened per day before the wait time starts.
const limitPerDay = 10;
// How long to wait between visits after the limit is reached. Format "hh-mm-ss".
const timeBetween = "00-10-00";


// ---------- Database ----------

let databasePromise = null;

// Opens the database the first time, and reuses it after that.
function getDatabase() {
  if (databasePromise === null) {
    databasePromise = openDB("nettsideBlocker", 1, {
      upgrade(db) {
        // One record per site per day: { domain: "x.com", day: "2026-11-09", count: 3, lastSeen: "14-05-30" }
        db.createObjectStore("dailyVisits", { keyPath: ["domain", "day"] });
      }
    });
  }
  return databasePromise;
}

// Adds 1 to today's count for the site, and saves the time of the visit.
async function addVisit(domain) {
  const db = await getDatabase();
  const day = getToday();
  const time = getTime();

  // Read and write in the same transaction,
  // so two visits at the same time can't overwrite each other.
  const transaction = db.transaction("dailyVisits", "readwrite");
  const record = await transaction.store.get([domain, day]);

  if (record) {
    record.count = record.count + 1;
    record.lastSeen = time;

    await transaction.store.put(record);
  } else {
    await transaction.store.put({ domain: domain, day: day, count: 1, lastSeen: time});
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

// Returns the time the site was last opened today, like "14-05-30",
// or null if there is no saved time.
async function getLastSeen(domain) {
  const db = await getDatabase();
  const record = await db.get("dailyVisits", [domain, getToday()]);

  // Records saved before lastSeen was added don't have it.
  if (record && record.lastSeen) {
    return record.lastSeen;
  }
  return null;
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

// Returns the current local time as text, like "14-05-30".
function getTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  return hours + "-" + minutes + "-" + seconds;
}

// Turns "hh-mm-ss" into three numbers: [hour, min, sec].
function timeParser(time) {
  const timeSplit = time.split("-");
  const hour = Number(timeSplit[0]);
  const min = Number(timeSplit[1]);
  const sec = Number(timeSplit[2]);
  return [hour, min, sec];
}

// Turns "hh-mm-ss" into a number of seconds. "01-30-00" gives 5400.
function timeToSeconds(time) {
  const [hour, min, sec] = timeParser(time);
  return hour * 3600 + min * 60 + sec;
}

// Returns how many seconds have passed from lastSeen to currentTime.
// Both times are "hh-mm-ss" text from the same day.
function timeDiffrence(lastSeen, currentTime) {
  return timeToSeconds(currentTime) - timeToSeconds(lastSeen);
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


// ---------- Blocking after the daily limit ----------

// A site is blocked if it has been opened limitPerDay times today,
// or if less than timeBetween has passed since the last visit.
// It is never blocked if the tab is already on that site (the visit is still going on).
async function shouldBlock(site, previousSite) {
  if (site === previousSite) {
    return false;
  }

  const count = await getTodayCount(site);
  if (count >= limitPerDay) {
    return true;
  }

  // No saved time means no visit yet today (or an old record), so no wait time.
  const lastSeen = await getLastSeen(site);
  if (lastSeen === null) {
    return false;
  }

  const secondsSinceLastSeen = timeDiffrence(lastSeen, getTime());
  const secondsBetweenLimit = timeToSeconds(timeBetween);

  return secondsSinceLastSeen < secondsBetweenLimit;
}

// Sends the tab to blocked.html, with the site, today's count and the
// last visit time in the URL, like blocked.html?site=x.com&count=3&lastSeen=14-05-30
async function showBlockedPage(tabId, site) {
  const count = await getTodayCount(site);
  const lastSeen = await getLastSeen(site);

  // URLSearchParams encodes the values safely for a URL.
  const params = new URLSearchParams();
  params.set("site", site);
  params.set("count", String(count));
  if (lastSeen !== null) {
    params.set("lastSeen", lastSeen);
  }

  const blockedPageUrl = chrome.runtime.getURL("blocked.html") + "?" + params.toString();
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
    await showBlockedPage(details.tabId, site);
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
    await showBlockedPage(details.tabId, site);
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
