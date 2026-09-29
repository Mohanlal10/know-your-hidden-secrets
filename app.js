// Shared login tabs
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  document.querySelectorAll("form").forEach(f=>f.classList.add("hidden"));
  document.getElementById(t.dataset.target)?.classList.remove("hidden");
}));

// Secure Supabase authentication
const sb=window.supabaseClient||null;
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
document.getElementById("customer")?.addEventListener("submit",async e=>{e.preventDefault();const s=document.getElementById("customerStatus");if(!sb){s.textContent="Connect the Supabase project first.";return;}const {error}=await sb.auth.signInWithPassword({email:customerEmail.value.trim(),password:customerPassword.value});if(error){s.textContent=error.message;return;}location.href="dashboard.html";});
document.getElementById("customerSignup")?.addEventListener("click",async e=>{e.preventDefault();const s=document.getElementById("customerStatus"),email=customerEmail.value.trim(),password=customerPassword.value;if(!sb){s.textContent="Connect the Supabase project first.";return;}const {error}=await sb.auth.signUp({email,password,options:{data:{full_name:email.split("@")[0]}}});s.textContent=error?error.message:"Account created. Check your email if confirmation is enabled, then log in.";});
document.getElementById("admin")?.addEventListener("submit",async e=>{e.preventDefault();const s=document.getElementById("adminStatus");if(!sb){s.textContent="Connect the Supabase project first.";return;}const {error}=await sb.auth.signInWithPassword({email:adminEmailLogin.value.trim(),password:adminPassword.value});if(error){s.textContent=error.message;return;}const {data:u}=await sb.auth.getUser();const {data:p}=await sb.from("profiles").select("role").eq("id",u.user.id).single();if(p?.role!=="admin"){await sb.auth.signOut();s.textContent="This account is not authorized as an administrator.";return;}location.href="admin.html";});
async function requireAdmin(){if(!sb){location.href="login.html";return null;}const {data:{user}}=await sb.auth.getUser();if(!user){location.href="login.html";return null;}const {data:profile}=await sb.from("profiles").select("id,full_name,email,phone,role").eq("id",user.id).single();if(!profile||profile.role!=="admin"){await sb.auth.signOut();location.href="login.html";return null;}return {user,profile};}

// Administrator board
const adminSections=document.querySelectorAll(".admin-section");
const adminNav=document.querySelectorAll(".admin-nav").forEach(n=>n.addEventListener("click",()=>openAdminSection(n.dataset.section)));document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openAdminSection(b.dataset.open)));if(adminSections.length){const initial=location.hash.slice(1);openAdminSection([...adminSections].some(s=>s.id===initial)?initial:"overview");}

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
// Real admin data
async function loadAdminData(section){if(!adminSections.length)return;const a=await requireAdmin();if(!a)return;
if(section==="overview"){const [{count:c},{count:r},{count:p},{count:m}]=await Promise.all([sb.from("profiles").select("*",{count:"exact",head:true}).eq("role","customer"),sb.from("readings").select("*",{count:"exact",head:true}),sb.from("appointments").select("*",{count:"exact",head:true}).eq("status","pending"),sb.from("messages").select("*",{count:"exact",head:true})]);const n=document.querySelectorAll(".admin-stats b");if(n.length){n[0].textContent=c??0;n[1].textContent=r??0;n[2].textContent=p??0;n[3].textContent=m??0;}}
if(section==="customers")loadCustomers();if(section==="readings")loadReadings();if(section==="messages")loadMessages();}
async function loadCustomers(){const b=document.querySelector("#customers tbody");if(!b)return;const {data,error}=await sb.from("profiles").select("full_name,email,phone,created_at").eq("role","customer").order("created_at",{ascending:false});b.innerHTML=error?"<tr><td colspan='4'>"+esc(error.message)+"</td></tr>":(data||[]).map(x=>"<tr><td>"+esc(x.full_name)+"</td><td>"+esc(x.email||x.phone||"—")+"</td><td><span class='status active-status'>Active</span></td><td>"+new Date(x.created_at).toLocaleDateString()+"</td></tr>").join("")||"<tr><td colspan='4'>No customers yet.</td></tr>";}
async function loadReadings(){const b=document.querySelector("#readings .reading-list");if(!b)return;const {data,error}=await sb.from("readings").select("title,service,status,created_at,profiles(full_name)").order("created_at",{ascending:false});b.innerHTML=error?"<article class='admin-card'>"+esc(error.message)+"</article>":(data||[]).map(x=>"<article class='admin-card reading-row'><div><strong>"+esc(x.title)+"</strong><small>"+esc(x.profiles?.full_name||"Customer")+" • "+new Date(x.created_at).toLocaleDateString()+"</small></div><span class='status pending-status'>"+esc(x.status)+"</span></article>").join("")||"<article class='admin-card'>No readings yet.</article>";}
async function loadMessages(){const b=document.getElementById("messageHistory");if(!b)return;const {data,error}=await sb.from("messages").select("channel,message,status,created_at,profiles(full_name,email)").order("created_at",{ascending:false}).limit(50);b.innerHTML=error?esc(error.message):(data||[]).map(x=>"<div class='history-item'><strong>"+esc(x.channel)+"</strong><span>"+esc(x.profiles?.full_name||x.profiles?.email||"Customer")+"</span><small>"+esc(x.message)+" • "+new Date(x.created_at).toLocaleString()+"</small></div>").join("")||"<p class='muted'>No messages yet.</p>";}
document.getElementById("sendMessage")?.addEventListener("click",async()=>{const r=document.getElementById("adminRecipient")?.value.trim(),ch=document.getElementById("adminChannel")?.value.toLowerCase(),msg=document.getElementById("adminMessage")?.value.trim(),s=document.getElementById("messageStatus");if(!r||!msg){s.textContent="Enter a customer contact and message.";return;}const a=await requireAdmin();if(!a)return;const {data:c}=await sb.from("profiles").select("id").or("email.eq."+r+",phone.eq."+r).eq("role","customer").limit(1).maybeSingle();if(!c){s.textContent="Customer not found.";return;}const {error}=await sb.from("messages").insert({customer_id:c.id,sender_id:a.user.id,channel:ch,message:msg,status:"queued"});s.textContent=error?error.message:"Message recorded. External delivery needs an Email/SMS/WhatsApp provider.";if(!error){document.getElementById("adminMessage").value="";loadMessages();}});
