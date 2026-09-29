// Shared login tabs
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.querySelectorAll("form").forEach(f=>f.classList.add("hidden"));
  document.getElementById(t.dataset.target)?.classList.remove("hidden");
}));

document.getElementById("customer")?.addEventListener("submit",e=>{
  e.preventDefault();
  sessionStorage.setItem("customerLoggedIn","true");
  location.href="dashboard.html";
});

document.getElementById("admin")?.addEventListener("submit",e=>{
  e.preventDefault();
  sessionStorage.setItem("adminLoggedIn","true");
  location.href="admin.html";
});

// Administrator board
const adminSections=document.querySelectorAll(".admin-section");
const adminNav=document.querySelectorAll(".admin-nav");
function openAdminSection(name){
  adminSections.forEach(s=>s.classList.toggle("active",s.id===name));
  adminNav.forEach(n=>n.classList.toggle("active",n.dataset.section===name));
  history.replaceState(null,"","#"+name);
}
adminNav.forEach(n=>n.addEventListener("click",()=>openAdminSection(n.dataset.section)));
document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openAdminSection(b.dataset.open)));
if(adminSections.length){
  const initial=location.hash.slice(1);
  openAdminSection([...document.querySelectorAll(".admin-section")].some(s=>s.id===initial)?initial:"overview");
  document.getElementById("adminLogout")?.addEventListener("click",()=>{
    sessionStorage.removeItem("adminLoggedIn");
    location.href="login.html";
  });
}

// Messaging: local demo queue until a real provider/backend is connected.
function renderMessageHistory(){
  const box=document.getElementById("messageHistory");
  if(!box)return;
  const items=JSON.parse(localStorage.getItem("adminMessages")||"[]");
  box.innerHTML=items.length?items.slice().reverse().map(m=>`<div class="history-item"><strong>${m.channel}</strong><span>${m.recipient}</span><small>${m.message}</small></div>`).join(""):'<p class="muted">No messages sent in this browser session.</p>';
  const count=document.getElementById("sentCount"); if(count)count.textContent=items.length;
}
document.getElementById("sendMessage")?.addEventListener("click",()=>{
  const recipient=document.getElementById("adminRecipient")?.value.trim();
  const channel=document.getElementById("adminChannel")?.value;
  const message=document.getElementById("adminMessage")?.value.trim();
  const status=document.getElementById("messageStatus");
  if(!recipient||!message){if(status)status.textContent="Please enter a customer contact and message.";return;}
  const items=JSON.parse(localStorage.getItem("adminMessages")||"[]");
  items.push({recipient,channel,message,time:new Date().toLocaleString()});
  localStorage.setItem("adminMessages",JSON.stringify(items));
  if(status)status.textContent=`Demo message queued for ${channel}. Connect a provider to deliver it to the customer.`;
  document.getElementById("adminMessage").value="";
  renderMessageHistory();
});
renderMessageHistory();

document.getElementById("saveSettings")?.addEventListener("click",()=>{
  localStorage.setItem("adminSettings",JSON.stringify({
    siteName:document.getElementById("siteName")?.value||"",
    adminEmail:document.getElementById("adminEmail")?.value||"",
    demoMode:document.getElementById("demoMode")?.checked
  }));
  const s=document.getElementById("settingsStatus");if(s)s.textContent="Settings saved on this browser.";
});
(function loadSettings(){
  const s=JSON.parse(localStorage.getItem("adminSettings")||"null");if(!s)return;
  if(document.getElementById("siteName"))document.getElementById("siteName").value=s.siteName||"";
  if(document.getElementById("adminEmail"))document.getElementById("adminEmail").value=s.adminEmail||"";
  if(document.getElementById("demoMode"))document.getElementById("demoMode").checked=s.demoMode!==false;
})();

// Customer dashboard AI
const READY_WELCOME="Welcome to our channel, know your hidden secrets and about future with clarity.";
const AI_FALLBACK="Thank you for your question. Our AI Astrology Guide can provide an introductory interpretation, while a detailed personal reading should be prepared from your birth details and consultation information.";
function showAiAnswer(answer){const box=document.getElementById("aiWelcome");if(box)box.textContent=answer;}
document.getElementById("askAi")?.addEventListener("click",()=>showAiAnswer("Welcome back. "+READY_WELCOME+" Ask a question below and we will guide you toward a clearer understanding of your reading."));
document.getElementById("sendAi")?.addEventListener("click",async()=>{
  const input=document.getElementById("aiQuestion"),question=input?.value.trim();if(!question)return;
  showAiAnswer("AI Guide: "+AI_FALLBACK);input.value="";
});
document.getElementById("aiQuestion")?.addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("sendAi")?.click();});