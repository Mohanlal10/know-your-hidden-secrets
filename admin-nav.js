window.showAdminSection=function(name){document.querySelectorAll(".admin-section").forEach(function(section){section.classList.toggle("active",section.id===name);});document.querySelectorAll(".admin-nav").forEach(function(item){item.classList.toggle("active",item.dataset.section===name);});if(history.replaceState){history.replaceState(null,"","#"+name);}if(window.loadAdminData){window.loadAdminData(name);}};
document.addEventListener("DOMContentLoaded",function(){
  var sidebar=document.querySelector(".admin-sidebar");
  if(sidebar && !sidebar.querySelector('[data-section="whatsapp"]')){
    var b=document.createElement("button");
    b.className="admin-nav";
    b.dataset.section="whatsapp";
    b.type="button";
    b.textContent="📱 WhatsApp Questions";
    b.addEventListener("click",function(){window.location.href="whatsapp-inbox.html";});
    var home=sidebar.querySelector(".admin-home");
    sidebar.insertBefore(b,home||null);
  }
  document.querySelectorAll(".admin-nav").forEach(function(item){
    item.addEventListener("click",function(e){
      if(item.dataset.section==="whatsapp"){return;}
      e.preventDefault();
      window.showAdminSection(item.dataset.section);
    });
  });
  var initial=location.hash.substring(1);
  window.showAdminSection(document.getElementById(initial)?initial:"overview");
});