/* ==========================================================================
   Pickify Lab — Settings
   Exported from the admin dashboard on 21/07/2026, 14:11:37.
   Replace the deployed js/settings.js with this file and redeploy to
   publish these changes to every visitor.
   ========================================================================== */

const PICKIFY_SETTINGS = {
  "businessEmail": "pickifylab@gmail.com",
  "social": {
    "instagram": "https://instagram.com/pickifylab",
    "tiktok": "https://tiktok.com/@pickifylab",
    "youtube": "https://youtube.com/@pickifylab",
    "facebook": "https://facebook.com/pickifylab",
    "x": "https://x.com/pickifylab"
  },
  "disclosureText": "Pickify Lab is a participant in the Amazon Associates program. Some links on this site are affiliate links, meaning we may earn a small commission on qualifying purchases at no extra cost to you. This never influences which products we choose to review or how we rate them — our opinions remain independent."
};

if (typeof window !== "undefined") {
  window.PICKIFY_SETTINGS = PICKIFY_SETTINGS;
  window.PICKIFY_SETTINGS_STORAGE_KEY = "pickify-admin-settings";
  window.PICKIFY_SETTINGS_DEFAULT = PICKIFY_SETTINGS;

  try {
    const overlay = window.localStorage.getItem(window.PICKIFY_SETTINGS_STORAGE_KEY);
    if (overlay) {
      const parsed = JSON.parse(overlay);
      if (parsed && typeof parsed === "object") {
        window.PICKIFY_SETTINGS = { ...PICKIFY_SETTINGS, ...parsed, social: { ...PICKIFY_SETTINGS.social, ...(parsed.social || {}) } };
      }
    }
  } catch (err) {
    console.warn("Pickify Lab: ignoring corrupt local settings overlay.", err);
  }
}
