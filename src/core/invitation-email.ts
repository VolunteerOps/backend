import { z } from 'zod';
export function invitationMailConfig(env:NodeJS.ProcessEnv=process.env){
 const parsed=z.object({RESEND_API_KEY:z.string().min(10),INVITATION_EMAIL_FROM:z.string().email(),VOLUNTEER_APP_ORIGIN:z.string().url()}).parse(env);
 const origin=new URL(parsed.VOLUNTEER_APP_ORIGIN);
 if(origin.protocol!=='https:' || origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash) throw Error('INVALID_INVITATION_APP_ORIGIN');
 return {...parsed,VOLUNTEER_APP_ORIGIN:origin.origin};
}
export async function sendInvitationEmail(input:{id:string;recipient:string;organization:string},signal:AbortSignal,send:typeof fetch=fetch){
 const config=invitationMailConfig();
 const response=await send('https://api.resend.com/emails',{method:'POST',redirect:'error',signal,
 headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'resq-invitation/'+input.id},
 body:JSON.stringify({from:config.INVITATION_EMAIL_FROM,to:[input.recipient],subject:'Invitation to join '+input.organization.slice(0,160),
 text:'You have been invited to '+input.organization+'. Sign in with the verified email address that received this message, then explicitly accept from your invitation inbox.\n\n'+config.VOLUNTEER_APP_ORIGIN+'/?invitation='+encodeURIComponent(input.id)+'\n\nThis link does not grant access. If you did not expect this invitation, decline or block the organization from your inbox.'})});
 if(!response.ok) throw Error('EMAIL_PROVIDER_RETRY');
 const result=z.object({id:z.string().min(1).max(200)}).parse(await response.json());return result.id;
}
