import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function b64urlText(text){return b64url(new TextEncoder().encode(text));}
function unb64urlText(s){const pad="=".repeat((4-s.length%4)%4);const bin=atob(s.replace(/-/g,"+").replace(/_/g,"/")+pad);return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));}
async function sign(value,secret){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))));
}
async function makeToken(exp,secret){
  const payload=b64urlText(JSON.stringify({exp,nonce:crypto.randomUUID()}));
  return payload+"."+await sign(payload,secret);
}
async function verifyToken(token,secret){
  if(typeof token!=="string")return false;
  const parts=token.split(".");if(parts.length!==2)return false;
  const expected=await sign(parts[0],secret);
  if(expected!==parts[1])return false;
  try{const p=JSON.parse(unb64urlText(parts[0]));return Number.isFinite(p.exp)&&Date.now()<p.exp;}catch{return false;}
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return respond({success:false,error:"Method not allowed."},405);
  try{
    const body=await req.json();
    const action=body?.action;
    const sessionSecret=Deno.env.get("PUBLIC_QUESTION_SESSION_SECRET");
    if(!sessionSecret)return respond({success:false,error:"Question session service is not configured."},500);

    if(action==="start"){
      const expiresAt=Date.now()+10*60*1000;
      const session_token=await makeToken(expiresAt,sessionSecret);
      return respond({success:true,session_token,expires_at:expiresAt});
    }

    if(action!=="submit")return respond({success:false,error:"Invalid request."},400);
    if(!await verifyToken(body?.session_token,sessionSecret))return respond({success:false,error:"Your 10-minute session has expired. Please start a new session."},410);

    const name=typeof body?.name==="string"?body.name.trim():"";
    const phone=typeof body?.phone==="string"?body.phone.trim():"";
    const email=typeof body?.email==="string"?body.email.trim():"";
    const question=typeof body?.question==="string"?body.question.trim():"";
    if(!name||!phone||!email||!question)return respond({success:false,error:"Please complete all required fields."},400);
    if(name.length>120||phone.length>30||email.length>200||question.length>5000)return respond({success:false,error:"One or more fields are too long."},400);

    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRoleKey)throw new Error("Supabase server configuration is incomplete.");
    const admin=createClient(supabaseUrl,serviceRoleKey);

    const {data:saved,error:saveError}=await admin.from("public_questions").insert({
      name,phone,email,question,session_expires_at:new Date(Date.now()).toISOString(),status:"new"
    }).select("id,created_at").single();
    if(saveError)throw saveError;

    const text="🔔 NEW 10-MINUTE QUESTION\n\nCustomer: "+name+"\nMobile: "+phone+"\nEmail: "+email+"\n\nQuestion:\n"+question+"\n\nQuestion ID:\n"+saved.id;
    const whatsappToken=Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const adminNumber=Deno.env.get("WHATSAPP_ADMIN_NUMBER");
    const graphVersion=Deno.env.get("WHATSAPP_GRAPH_VERSION")||"v23.0";
    const resendKey=Deno.env.get("RESEND_API_KEY");
    const notificationEmail=Deno.env.get("NOTIFICATION_EMAIL");
    const fromEmail=Deno.env.get("NOTIFICATION_FROM_EMAIL")||"Know Your Hidden Secrets <onboarding@resend.dev>";

    let whatsappSent=false,emailSent=false,errors=[];
    if(whatsappToken&&phoneNumberId&&adminNumber){
      const wr=await fetch("https://graph.facebook.com/"+graphVersion+"/"+phoneNumberId+"/messages",{
        method:"POST",headers:{"Authorization":"Bearer "+whatsappToken,"Content-Type":"application/json"},
        body:JSON.stringify({messaging_product:"whatsapp",to:adminNumber,type:"text",text:{preview_url:false,body:text}})
      });
      const wj=await wr.json();if(wr.ok)whatsappSent=true;else errors.push("WhatsApp notification failed.");
    }else errors.push("WhatsApp secrets are not configured.");

    if(resendKey&&notificationEmail){
      const er=await fetch("https://api.resend.com/emails",{
        method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json"},
        body:JSON.stringify({from:fromEmail,to:[notificationEmail],subject:"New 10-Minute Question — "+name,html:"<h2>New 10-Minute Question</h2><p><strong>Customer:</strong> "+escapeHtml(name)+"</p><p><strong>Mobile:</strong> "+escapeHtml(phone)+"</p><p><strong>Email:</strong> "+escapeHtml(email)+"</p><hr><p><strong>Question:</strong></p><p style='white-space:pre-wrap'>"+escapeHtml(question)+"</p><p><strong>Question ID:</strong> "+escapeHtml(saved.id)+"</p>"})
      });
      if(er.ok)emailSent=true;else errors.push("Email notification failed.");
    }else errors.push("Email secrets are not configured.");

    await admin.from("public_questions").update({whatsapp_sent:whatsappSent,email_sent:emailSent}).eq("id",saved.id);
    if(!whatsappSent&&!emailSent)return respond({success:false,error:"Your question was saved, but notification delivery is not configured yet.",question_id:saved.id},502);
    return respond({success:true,message:"Your question has been received. Our team has been notified and will get back to you.",question_id:saved.id,whatsapp_sent:whatsappSent,email_sent:emailSent,notification_warning:errors.length?errors.join(" "):null});
  }catch(error){
    console.error("send-public-question error:",error);
    return respond({success:false,error:error instanceof Error?error.message:"Unable to process your question."},500);
  }
});

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
