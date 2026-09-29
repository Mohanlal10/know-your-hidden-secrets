// Supabase connection settings.
// Replace these two placeholders with the URL and PUBLISHABLE key from your Supabase project.
// Never put a secret/service_role key in this file.
window.SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
window.SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
window.supabaseClient = null;
if (window.SUPABASE_URL.startsWith("http") && !window.SUPABASE_URL.includes("YOUR_") &&
    window.SUPABASE_PUBLISHABLE_KEY && !window.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_") &&
    window.supabase) {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
}
