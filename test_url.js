const base = "http://goatedcodoer:8056".replace(/\/+$/, "");
const path = "/items/holiday_calendar";
try {
  const url = new URL(base + path);
  console.log("URL:", url.toString());
} catch (e) {
  console.error("Error:", e.message);
}
