// Shows the blocked site's name, taken from the page URL (blocked.html?site=youtube.com).
const params = new URLSearchParams(window.location.search);
const site = params.get("site");

if (site) {
  // textContent (not innerHTML), so the text can never run as code.
  document.getElementById("site").textContent = site;
}
