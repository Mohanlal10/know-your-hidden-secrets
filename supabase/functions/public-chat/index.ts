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
async function sign(value,secret){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))));}
async function makeToken(exp,conversationId,secret){const payload=b64urlText(JSON.stringify({exp,conversationId,nonce:crypto.randomUUID()}));return payload+"."+await sign(payload,secret);}
async function verifyToken(token,secret){
  if(typeof token!=="string")return null;
  const parts=token.split(".");if(parts.length!==2)return null;
  if((await sign(parts[0],secret))!==parts[1])return null;
  try{const p=JSON.parse(unb64urlText(parts[0]));return Number.isFinite(p.exp)&&Date.now()<p.exp?p:null;}catch{return null;}
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"}[c]));}

async function notifyAdmin(name,phone,email,message,conversationId){
  const text="🔔 NEW DIRECT MESSAGE\n\nName: "+name+"\nMobile: "+phone+"\nEmail: "+email+"\n\nMessage:\n"+message+"\n\nConversation ID:\n"+conversationId;
  let whatsappSent=false,emailSent=false;
  const whatsappToken=Deno.env.get("WHATSAPP_ACCESS_TOKEN"),phoneNumberId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"),adminNumber=Deno.env.get("WHATSAPP_ADMIN_NUMBER");
  const graphVersion=Deno.env.get("WHATSAPP_GRAPH_VERSION")||"v23.0";
  if(whatsappToken&&phoneNumberId&&adminNumber){
    const r=await fetch("https://graph.facebook.com/"+graphVersion+"/"+phoneNumberId+"/messages",{method:"POST",headers:{"Authorization":"Bearer "+whatsappToken,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:adminNumber,type:"text",text:{preview_url:false,body:text}})});
    whatsappSent=r.ok;
  }
  const resendKey=Deno.env.get("RESEND_API_KEY"),notificationEmail=Deno.env.get("NOTIFICATION_EMAIL"),fromEmail=Deno.env.get("NOTIFICATION_FROM_EMAIL")||"Know Your Hidden Secrets <onboarding@resend.dev>";
  if(resendKey&&notificationEmail){
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json"},body:JSON.stringify({from:fromEmail,to:[notificationEmail],subject:"New Direct Message — "+name,html:"<h2>New Direct Message</h2><p><strong>Name:</strong> "+esc(name)+"</p><p><strong>Mobile:</strong> "+esc(phone)+"</p><p><strong>Email:</strong> "+esc(email)+"</p><p><strong>Message:</strong></p><p style='white-space:pre-wrap'>"+esc(message)+"</p><p><strong>Conversation ID:</strong> "+esc(conversationId)+"</p>"})});
    emailSent=r.ok;
  }
  return {whatsappSent,emailSent};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return respond({success:false,error:"Method not allowed."},405);
  try{
    const body=await req.json();
    const action=body?.action;
    const secret=Deno.env.get("PUBLIC_QUESTION_SESSION_SECRET");
    if(!secret)return respond({success:false,error:"Direct communication is not configured."},500);
    const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRoleKey)throw new Error("Supabase server configuration is incomplete.");
    const admin=createClient(supabaseUrl,serviceRoleKey);

    if(action==="start_chat"){
      const name=String(body?.name||"").trim(),phone=String(body?.phone||"").trim(),email=String(body?.email||"").trim(),message=String(body?.message||"").trim();
      if(name.split(/\s+/).length<2)return respond({success:false,error:"Please enter your complete name (first and last name)."},400);
      if(!phone||!email||!message)return respond({success:false,error:"Please complete your mobile number, email and question."},400);
      if(name.length>120||phone.length>30||email.length>200||message.length>5000)return respond({success:false,error:"One or more fields are too long."},400);
      const expiresAt=Date.now()+10*60*1000;
      const {data:conversation,error}=await admin.from("public_conversations").insert({visitor_name:name,phone,email,status:"waiting",session_expires_at:new Date(expiresAt).toISOString()}).select("id").single();
      if(error)throw error;
      const {error:msgError}=await admin.from("public_conversation_messages").insert({conversation_id:conversation.id,sender:"visitor",message});
      if(msgError)throw msgError;
      const notification=await notifyAdmin(name,phone,email,message,conversation.id);
      const session_token=await makeToken(expiresAt,conversation.id,secret);
      const {data:messages}=await admin.from("public_conversation_messages").select("id,sender,message,created_at").eq("conversation_id",conversation.id).order("created_at");
      return respond({success:true,session_token,expires_at:expiresAt,messages:messages||[],notification});
    }

    const payload=await verifyToken(body?.session_token,secret);
    if(!payload)return respond({success:false,error:"Your 10-minute conversation has expired. Please start a new conversation."},410);
    const {data:conversation}=await admin.from("public_conversations").select("id,visitor_name,phone,email,status,session_expires_at").eq("id",payload.conversationId).single();
    if(!conversation)return respond({success:false,error:"Conversation not found."},404);

    if(action==="get_chat"){
      const {data:messages,error}=await admin.from("public_conversation_messages").select("id,sender,message,created_at").eq("conversation_id",payload.conversationId).order("created_at");
      if(error)throw error;
      return respond({success:true,messages:messages||[],status:conversation.status});
    }

    if(action==="chat_message"){
      const message=String(body?.message||"").trim();
      if(!message)return respond({success:false,error:"Please enter a message."},400);
      if(message.length>5000)return respond({success:false,error:"Message is too long. Maximum 5000 characters."},400);
      const {error:insertError}=await admin.from("public_conversation_messages").insert({conversation_id:payload.conversationId,sender:"visitor",message});
      if(insertError)throw insertError;
      await admin.from("public_conversations").update({status:"waiting",updated_at:new Date().toISOString()}).eq("id",payload.conversationId);
      const notification=await notifyAdmin(conversation.visitor_name,conversation.phone,conversation.email,message,payload.conversationId);
      const {data:messages}=await admin.from("public_conversation_messages").select("id,sender,message,created_at").eq("conversation_id",payload.conversationId).order("created_at");
      return respond({success:true,message:"Message sent. Our team has been notified.",messages:messages||[],notification});
    }

    return respond({success:false,error:"Invalid request."},400);
  }catch(error){console.error("public-chat error:",error);return respond({success:false,error:error instanceof Error?error.message:"Unable to process the conversation."},500);}
});