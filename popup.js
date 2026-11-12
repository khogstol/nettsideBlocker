import { cleanDomain, loadTrackedSites, saveTrackedSites } from "./sites.js";

const addCurrentButton = document.getElementById("add-current");
const addForm = document.getElementById("add-form");
const siteInput = document.getElementById("site-input");
const message = document.getElementById("message");
const siteList = document.getElementById("site-list");


// ---------- Showing things ----------

function showMessage(text) {
  message.textContent = text;
}

// Draws the list of sites, each with a Remove button.
// Uses textContent, never innerHTML, so a site name can't become HTML.
function showSites(sites) {
  siteList.replaceChildren();

  if (sites.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No sites yet.";
    siteList.append(emptyItem);
    return;
  }

  for (const site of sites) {
    const item = document.createElement("li");

    const name = document.createElement("span");
    name.textContent = site;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", function () {
      removeSite(site);
    });

    item.append(name, removeButton);
    siteList.append(item);
  }
}


// ---------- Changing the list ----------

async function addSite(input) {
  const domain = cleanDomain(input);
  if (domain === null) {
    showMessage("That doesn't look like a website.");
    return;
  }

  const sites = await loadTrackedSites();
  if (sites.includes(domain)) {
    showMessage(domain + " is already on the list.");
    return;
  }

  sites.push(domain);
  await saveTrackedSites(sites);
  showSites(sites);
  showMessage("Added " + domain + ".");
}

async function removeSite(domain) {
  const sites = await loadTrackedSites();

  const newSites = [];
  for (const site of sites) {
    if (site !== domain) {
      newSites.push(site);
    }
  }

  await saveTrackedSites(newSites);
  showSites(newSites);
  showMessage("Removed " + domain + ".");
}


// ---------- The "Add this site" button ----------

// Returns the URL of the tab you are looking at, or null.
async function getCurrentTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0 || !tabs[0].url) {
    return null;
  }
  return tabs[0].url;
}

// Shows the current site on the button, or disables it on pages
// that can't be added (like chrome:// pages or the blocked page).
async function setUpAddCurrentButton() {
  const url = await getCurrentTabUrl();

  let domain = null;
  if (url !== null) {
    domain = cleanDomain(url);
  }

  if (domain === null) {
    addCurrentButton.textContent = "This page can't be added";
    addCurrentButton.disabled = true;
    return;
  }

  addCurrentButton.textContent = "Add " + domain;
  addCurrentButton.disabled = false;
  addCurrentButton.addEventListener("click", function () {
    addSite(domain);
  });
}


// ---------- Start ----------

addForm.addEventListener("submit", async function (event) {
  // Stop the form from reloading the popup.
  event.preventDefault();
  await addSite(siteInput.value);
  siteInput.value = "";
});

async function start() {
  const sites = await loadTrackedSites();
  showSites(sites);
  await setUpAddCurrentButton();
}

start();
