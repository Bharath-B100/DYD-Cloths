const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGmailDelivery } = require('../services/gmailDelivery');
const env = { GMAIL_CLIENT_ID: 'test-client', GMAIL_CLIENT_SECRET: 'test-secret', GMAIL_REFRESH_TOKEN: 'test-refresh', GMAIL_SENDER: 'sender@example.test' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
test('Gmail builds HTML and text MIME and reuses its refreshed access token', async () => {
 let refreshes = 0; const messages = [];
 const gmail = createGmailDelivery({ env, fetchImpl: async (url, options) => {
  if (url.includes('oauth2')) { refreshes++; return ok({access_token:'test-access',expires_in:3600}); }
  assert.equal(options.headers.Authorization, 'Bearer test-access');
  messages.push(Buffer.from(JSON.parse(options.body).raw, 'base64url').toString());
  return ok({id:'accepted'});
 }});
 await Promise.all([gmail.send('customer@example.test',{subject:'Verify',text:'Plain version',html:'<b>HTML version</b>'}),gmail.send('second@example.test',{subject:'Reset',text:'Reset link'})]);
 assert.equal(refreshes,1);assert.equal(messages.length,2);
 const mime=messages.find(m=>m.includes('customer@example.test'));
 assert.match(mime,/multipart\/alternative/);assert.match(mime,/text\/html/);assert.match(mime,/text\/plain/);assert.match(mime,/sender@example.test/);
});
test('Gmail refreshes once on 401 and does not retry quota errors', async () => {
 let tokens=0;let sends=0;
 const gmail=createGmailDelivery({env,fetchImpl:async url=>{
  if(url.includes('oauth2')) return ok({access_token:'token'+(++tokens),expires_in:3600});
  sends++;return sends===1?{ok:false,status:401}:ok({id:'accepted'});
 }});
 await gmail.send('test@example.test',{text:'Hello'});assert.equal(tokens,2);assert.equal(sends,2);
 let quotaCalls=0;
 const quota=createGmailDelivery({env,fetchImpl:async url=>url.includes('oauth2')?ok({access_token:'x'}):(quotaCalls++,{ok:false,status:429})});
 await assert.rejects(quota.send('test@example.test',{text:'Hello'}),/HTTP 429/);assert.equal(quotaCalls,1);
});
test('missing configuration and revoked authorization fail without exposing secrets', async () => {
 const missing=createGmailDelivery({env:{}});assert.equal(missing.configured(),false);
 await assert.rejects(missing.send('test@example.test',{text:'Hello'}),/not configured/);
 const revoked=createGmailDelivery({env,fetchImpl:async()=>({ok:false,status:400,json:async()=>({error:'invalid_grant',error_description:'test-secret'})})});
 await assert.rejects(revoked.send('test@example.test',{text:'Hello'}),e=>e.message.includes('HTTP 400')&&!e.message.includes('test-secret'));
});
