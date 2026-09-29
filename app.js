document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");document.querySelectorAll("form").forEach(f=>f.classList.add("hidden"));document.getElementById(t.dataset.target).classList.remove("hidden")});
document.getElementById("customer")?.addEventListener("submit",e=>{e.preventDefault();location.href="dashboard.html"});
document.getElementById("admin")?.addEventListener("submit",e=>{e.preventDefault();location.href="admin.html"});
document.getElementById("sendMessage")?.addEventListener("click",()=>{const s=document.getElementById("messageStatus");if(s)s.textContent="Demo message queued. Configure an email/SMS/WhatsApp provider before production."});

const READY_WELCOME="Welcome to our channel, know your hidden secrets and about future with clarity.";
const AI_FALLBACK="Thank you for your question. Our AI Astrology Guide can provide an introductory interpretation, while a detailed personal reading should be prepared from your birth details and consultation information.";

function showAiAnswer(answer){const box=document.getElementById("aiWelcome");if(box)box.textContent=answer;}

document.getElementById("askAi")?.addEventListener("click",()=>showAiAnswer("Welcome back. "+READY_WELCOME+" Ask a question below and we will guide you toward a clearer understanding of your reading."));
document.getElementById("sendAi")?.addEventListener("click",async()=>{const input=document.getElementById("aiQuestion");const question=input?.value.trim();if(!question)return;showAiAnswer("AI Guide: "+AI_FALLBACK);input.value="";});
document.getElementById("aiQuestion")?.addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("sendAi")?.click();});