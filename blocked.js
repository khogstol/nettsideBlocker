// Shows the blocked site's name, today's count and the last visit time,
// taken from the page URL (blocked.html?site=youtube.com&count=3&lastSeen=14-05-30).
// Anyone can edit a URL, so every value is checked before it is shown,
// and only shown with textContent (not innerHTML), so it can never run as code.

// Turns "9-5-3" into "09:05:03".
function formatTime(time) {
  const parts = time.split("-");
  const hour = parts[0].padStart(2, "0");
  const min = parts[1].padStart(2, "0");
  const sec = parts[2].padStart(2, "0");
  return hour + ":" + min + ":" + sec;
}

const params = new URLSearchParams(window.location.search);
const site = params.get("site");
const count = params.get("count");
const lastSeen = params.get("lastSeen");

if (site) {
  document.getElementById("site").textContent = site;
}

// Only show the count if it is a whole number, like "3".
if (count !== null && /^\d+$/.test(count)) {
  document.getElementById("count").textContent = count;
}

// Only show the time if it looks like "14-05-30" or "9-5-3".
if (lastSeen !== null && /^\d{1,2}-\d{1,2}-\d{1,2}$/.test(lastSeen)) {
  document.getElementById("lastSeen").textContent = formatTime(lastSeen);
}
