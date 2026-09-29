// Supabase connection settings.
// Replace these two placeholders with the URL and PUBLISHABLE key from your Supabase project.
// Never put a secret/service_role key in this file.
window.SUPABASE_URL = "https://mobputkjholqeinxkfdb.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6tgDXbhHTml_yZS6uiSAqQ_cxGqQHQf";
window.supabaseClient = null;
if (window.SUPABASE_URL.startsWith("http") && !window.SUPABASE_URL.includes("YOUR_") &&
    window.SUPABASE_PUBLISHABLE_KEY && !window.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_") &&
    window.supabase) {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
}
