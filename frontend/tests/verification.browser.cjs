const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const p = await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(15000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));let verificationCalls=0;
  await p.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/auth/register') return route.fulfill({json:{success:true,verificationRequired:true,message:'Check your inbox'}});
   if(path==='/api/auth/verify-email') {verificationCalls++;return route.fulfill({json:{success:true,message:'Email verified. You can now log in.'}});}
   if(path==='/api/auth/resend-verification') return route.fulfill({json:{success:true,message:'If this email belongs to an active, unverified account, a verification link will arrive shortly.'}});
   return route.fulfill({json:{success:true,data:{}}});
  });
  const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5176';
  await p.goto(base+'/register?redirect=%2Fcheckout');
  await p.getByLabel('Full Name').fill('Test Person');await p.getByLabel('Email Address',{exact:true}).fill('test@example.test');await p.getByLabel('Phone Number').fill('9876543210');await p.getByLabel('Password',{exact:true}).fill('TestPassword123!');await p.getByLabel('Confirm Password').fill('TestPassword123!');
  await p.locator('form button[type=submit]').click();await p.waitForURL('**/verify-email?**');
  assert.equal(await p.evaluate(()=>localStorage.getItem('token')),null);
  assert.equal(await p.getByLabel('Email address',{exact:true}).inputValue(),'test@example.test');
  await p.getByRole('button',{name:'Resend verification email',exact:true}).click();await p.getByRole('status').waitFor();
  await p.goto(base+'/verify-email/'+'a'.repeat(64));await p.getByRole('button',{name:'Verify my email',exact:true}).waitFor();
  assert.equal(verificationCalls,0,'Opening the link must not activate it via email scanners');
  await p.getByRole('button',{name:'Verify my email',exact:true}).click();await p.getByRole('heading',{name:'Email verified',exact:true}).waitFor();
  assert.equal(verificationCalls,1);assert.equal(await p.evaluate(()=>localStorage.getItem('token')),null);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS signup stays logged out, resend, explicit verification and mobile layout');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
