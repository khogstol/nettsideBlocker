// Shared code for the list of tracked sites.
// Used by popup.js now, and can be used by background.js later.
// The list is saved in chrome.storage.local, so it stays on this computer.

// The sites we track until the user has saved their own list.
export const defaultTrackedSites = [
  "youtube.com",
  "reddit.com",
  "vg.no",
  "nrk.no",
  "instagram.com"
];

const storageKey = "trackedSites";

// Turns what the user typed (or a tab URL) into a clean domain, like "youtube.com".
// Returns null if it is not a normal website.
// Examples: "https://www.YouTube.com/watch?v=1" gives "youtube.com",
//           "chrome://extensions" gives null.
export function cleanDomain(input) {
  if (typeof input !== "string") {
    return null;
  }

  let text = input.trim().toLowerCase();
  if (text === "") {
    return null;
  }

  // Let the browser's URL parser do the hard work.
  // It needs a protocol, so add one if the user only typed "youtube.com".
  if (!text.includes("://")) {
    text = "https://" + text;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(text);
  } catch (error) {
    return null;
  }

  // Only normal web pages. Skips chrome://, file:// and so on.
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  let hostname = parsedUrl.hostname;

  // "www.youtube.com" and "youtube.com" are the same site for us.
  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }

  // 253 is the longest a domain name can be.
  if (hostname.length > 253) {
    return null;
  }

  // Only letters, digits and "-", in parts split by dots, with at least one dot.
  // Non-English domains are already turned into "xn--..." by the URL parser.
  const domainPattern = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  if (!domainPattern.test(hostname)) {
    return null;
  }

  return hostname;
}

// Returns the saved list of tracked sites, or the default list if nothing is saved yet.
// Saved data is checked again, because stored data should not be trusted blindly.
export async function loadTrackedSites() {
  const saved = await chrome.storage.local.get(storageKey);
  const savedList = saved[storageKey];

  if (!Array.isArray(savedList)) {
    return defaultTrackedSites.slice();
  }

  const cleanList = [];
  for (const item of savedList) {
    const domain = cleanDomain(item);
    if (domain !== null && !cleanList.includes(domain)) {
      cleanList.push(domain);
    }
  }
  return cleanList;
}

// Saves the list of tracked sites.
export async function saveTrackedSites(sites) {
  const newValue = {};
  newValue[storageKey] = sites;
  await chrome.storage.local.set(newValue);
}
