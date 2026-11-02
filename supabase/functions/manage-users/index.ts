import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const modernSecretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers});
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
 try {
  if (!modernSecretKey?.startsWith('sb_secret_')) return reply({error:'Credencial do servidor não configurada'},503);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,modernSecretKey,{auth:{persistSession:false}});
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,'');
  if (!token || token.split('.').length !== 3) return reply({error:'Autenticação necessária'},401);
  // Validate with Auth so both legacy and rotated asymmetric session signatures work.
  const {data:{user:caller},error}=await client.auth.getUser(token);
  if(error || !caller) return reply({error:'Autenticação necessária'},401);
  if(caller.app_metadata?.role!=='ADMIN' || caller.app_metadata?.active===false) return reply({error:'Acesso administrativo necessário'},403);
  const body=await req.json();
  const profile=(u:any)=>({id:u.id,email:u.email,name:u.user_metadata?.name||u.email,role:u.app_metadata?.role||'CLIENT',active:u.app_metadata?.active!==false,createdAt:u.created_at,lastLoginAt:u.last_sign_in_at,...Object.fromEntries(['subscriptionStatus','subscriptionPlan','subscriptionExpiresAt','monthlyPrice','whatsapp'].map(k=>[k,u.app_metadata?.[k]]))});
  if(body.action==='list') {
   const users=[]; let page=1;
   for(;;page++){const {data,error}=await client.auth.admin.listUsers({page,perPage:100});if(error)throw error;users.push(...data.users.map(profile));if(data.users.length<100)break;}
   return reply({users});
  }
  if(body.action==='delete') {
   if(body.id===caller.id) return reply({error:'Não é permitido excluir a própria conta administrativa'},400);
   const {error}=await client.auth.admin.deleteUser(body.id);if(error)throw error;
   return reply({success:true});
  }
  if(body.action!=='upsert') return reply({error:'Ação inválida'},400);
  const input=body.user;
  if(!input?.email || !input?.name) return reply({error:'Nome e e-mail obrigatórios'},400);
  const app_metadata:any={role:input.role==='ADMIN'?'ADMIN':'CLIENT',active:input.active!==false};
  for(const k of ['subscriptionStatus','subscriptionPlan','subscriptionExpiresAt','monthlyPrice','whatsapp']) if(input[k]!==undefined) app_metadata[k]=input[k];
  if(input.id===caller.id && (app_metadata.role!=='ADMIN'||!app_metadata.active)) return reply({error:'Não é permitido remover seu próprio acesso administrativo'},400);
  const fields:any={email:input.email.trim().toLowerCase(),user_metadata:{name:input.name},app_metadata};
  if(input.password) fields.password=input.password;
  let result;
  if(input.id) result=await client.auth.admin.updateUserById(input.id,fields);
  else {
   if(!input.password || input.password.length<8) return reply({error:'Informe uma senha de pelo menos 8 caracteres'},400);
   result=await client.auth.admin.createUser({...fields,email_confirm:true});
  }
  if(result.error) throw result.error;
  return reply({user:profile(result.data.user),success:true});
 } catch(e) {return reply({error:e instanceof Error?e.message:'Falha no gerenciamento'},400);}
});
