import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invitationMailConfig,sendInvitationEmail } from '../src/core/invitation-email.js';
test('invitation email uses recipient-bound inbox link and provider idempotency, no bearer secret',async()=>{
 process.env.RESEND_API_KEY='re_test_only_value';process.env.INVITATION_EMAIL_FROM='invites@example.org';process.env.VOLUNTEER_APP_ORIGIN='https://app.example.org';
 const id='2c4bdbf7-aa1b-47e8-a4c3-23b28a1e599b';
 await sendInvitationEmail({id,recipient:'person@example.org',organization:'Example'},new AbortController().signal,(async(url,options)=>{
 assert.equal(url,'https://api.resend.com/emails');assert.equal(options?.redirect,'error');
 assert.equal((options?.headers as Record<string,string>)['Idempotency-Key'],'resq-invitation/'+id);
 const body=JSON.parse(String(options?.body));assert.ok(body.text.includes('/?invitation='+id));assert.ok(!body.text.includes('token='));
 return new Response(JSON.stringify({id:'provider-message'}),{status:200});}) as typeof fetch);
 assert.throws(()=>invitationMailConfig({...process.env,VOLUNTEER_APP_ORIGIN:'https://app.example.org/redirect?next=evil'}));
});
