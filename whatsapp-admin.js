document.addEventListener("DOMContentLoaded", async function () {
  const root = document.getElementById("whatsappQuestionsAdmin");
  const sb = window.supabaseClient;
  if (!root || !sb) return;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => new Date(s).toLocaleString();
  async function load() {
    const { data, error } = await sb.from("whatsapp_consultations")
      .select("id,visitor_name,visitor_phone,initial_question,status,created_at,updated_at")
      .order("updated_at", { ascending:false }).limit(100);
    if (error) { root.textContent = error.message; return; }
    if (!data || !data.length) { root.innerHTML = "<p class='muted'>No WhatsApp questions have been received yet.</p>"; return; }
    const ids = data.map(x => x.id);
    const { data: msgs } = await sb.from("whatsapp_messages")
      .select("consultation_id,direction,message_text,message_type,created_at")
      .in("consultation_id", ids).order("created_at", { ascending:true });
    root.innerHTML = data.map(x => {
      const transcript = (msgs || []).filter(m => m.consultation_id === x.id).map(m =>
        "<p><strong>" + esc(m.direction === "inbound" ? "Visitor" : "You") + ":</strong> " +
        esc(m.message_text || "[" + m.message_type + "]") + "<br><small>" + esc(fmt(m.created_at)) + "</small></p>"
      ).join("");
      return "<article class='request-admin'><div style='display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap'><strong>" +
        esc(x.visitor_name || "WhatsApp Visitor") + "</strong><span class='status pending-status'>" + esc(x.status) +
        "</span></div><div class='request-meta'><span>Mobile: " + esc(x.visitor_phone) +
        "</span><span>Received: " + esc(fmt(x.created_at)) + "</span></div><div class='request-question'><strong>Question:</strong> " +
        esc(x.initial_question || "") + "</div><div class='request-question'>" + (transcript || "<span class='muted'>No transcript yet.</span>") +
        "</div><button class='btn' data-wa-close='" + x.id + "'>" + (x.status === "closed" ? "Reopen" : "Mark Closed") +
        "</button></article>";
    }).join("");
    root.querySelectorAll("[data-wa-close]").forEach(btn => btn.addEventListener("click", async () => {
      const item = data.find(x => x.id === btn.dataset.waClose);
      btn.disabled = true;
      const { error } = await sb.from("whatsapp_consultations")
        .update({ status: item.status === "closed" ? "active" : "closed", updated_at:new Date().toISOString() })
        .eq("id", item.id);
      if (error) alert(error.message); else load();
      btn.disabled = false;
    }));
  }
  load();
});