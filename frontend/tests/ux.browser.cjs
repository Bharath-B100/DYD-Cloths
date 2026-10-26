const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const product = { _id: '123456789012345678901234', name: 'UX test shirt', price: 500, stock: 10, sizes: ['M'], colors: ['Black'], mainImage: '/images/LOGO_DYD.png', images: [], category: 'plain' };
(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 try {
  const p = await browser.newPage({viewport: {width:390,height:844}, reducedMotion:'reduce'});
  p.setDefaultTimeout(15000); const errors=[];p.on('pageerror',e=>errors.push(e.message));
  let admin=false;
  const user={_id:'012345678901234567890123',name:'Test admin',email:'admin@example.test',role:'admin'};
  await p.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/auth/login') return route.fulfill({status:401,json:{success:false,error:'Incorrect email or password'}});
   if(path==='/api/products') return route.fulfill({json:{success:true,data:[product],currentPage:1,totalPages:1,total:1}});
   const data=path===`/api/products/${product._id}`?product:path==='/api/auth/me'?{user:admin?user:null}:path==='/api/auth/wishlist'?{wishlist:[]}:path==='/api/user/cart'?{cart:[]}:path.includes('/reviews')?[]:{};
   return route.fulfill({json:{success:true,data}});
  });
  await p.goto(base+'/shop');await p.locator('.product-card').waitFor();
  assert.equal(await p.locator('#pre-splash').count(),0);
  assert.equal(await p.locator('.splash-screen').count(),0);
  assert.ok((await p.locator('.product-card').boundingBox()).y<844);
  await p.getByRole('button',{name:/Show filters/}).click();await p.getByLabel('Under ₹500',{exact:true}).click();
  await p.getByRole('button',{name:/Hide filters/}).click();
  assert.equal(await p.locator('.filters-sidebar').isVisible(),false);
  assert.equal(await p.getByRole('button',{name:/Open cart, /}).isVisible(),true);
  await p.getByRole('button',{name:'Search products',exact:true}).click();
  assert.equal(await p.getByRole('searchbox').evaluate(e=>e===document.activeElement),true);
  await p.keyboard.press('Escape');
  assert.equal(await p.getByRole('searchbox').isVisible(),false);
  for(const label of ['Shipping Policy','Returns & Exchanges','FAQ']) assert.equal(await p.locator('footer').getByRole('link',{name:label,exact:true}).count(),1);
  await p.goto(base+'/shared-wishlist');await p.getByRole('heading',{name:'Shared Wishlist'}).waitFor();
  assert.ok((await p.locator('h1').boundingBox()).y>=(await p.locator('.navbar').boundingBox()).height);
  await p.goto(base+`/product/${product._id}`);await p.getByRole('heading',{name:product.name,exact:true}).waitFor();
  const guide=p.locator('.size-guide-btn');await guide.click();
  const dialog=p.getByRole('dialog',{name:'Interactive Size Guide'});
  assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);
  await p.getByRole('button',{name:'Recommend Size'}).focus();await p.keyboard.press('Tab');
  assert.equal(await p.getByRole('button',{name:'Close size guide'}).evaluate(e=>e===document.activeElement),true);
  await p.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await guide.evaluate(e=>e===document.activeElement),true);
  const enlarge=p.getByRole('button',{name:'Enlarge product image'});await enlarge.focus();await p.keyboard.press('Enter');
  await p.getByRole('dialog',{name:'Product image viewer'}).waitFor();await p.keyboard.press('Escape');
  assert.equal(await enlarge.evaluate(e=>e===document.activeElement),true);
  assert.equal(await p.evaluate(()=>document.body.style.overflow),'');
  await p.goto(base+'/login');await p.getByRole('link',{name:'Back to shopping',exact:false}).waitFor();
  await p.getByLabel('Email Address').fill('customer@example.test');await p.getByLabel('Password',{exact:true}).fill('wrong-password');await p.getByRole('button',{name:'Login',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'Incorrect email'}).waitFor();
  await p.evaluate(()=>window.Utils.showToast('Persistent test error','error'));await p.waitForTimeout(4200);
  assert.equal(await p.getByRole('alert').filter({hasText:'Persistent test error'}).count(),1);
  await p.getByRole('button',{name:'Dismiss notification'}).click();
  assert.equal(await p.getByRole('button',{name:'Login',exact:true}).evaluate(e=>getComputedStyle(e).color),'rgb(23, 19, 0)');
  admin=true;await p.evaluate(user=>{localStorage.setItem('token','test-token');localStorage.setItem('user',JSON.stringify(user));},user);
  await p.setViewportSize({width:1440,height:900});await p.goto(base+'/admin');
  await p.locator('button.nav-link').filter({hasText:'Products'}).click();
  const add=p.getByRole('button',{name:'Add Product',exact:false});await add.click();
  const productDialog=p.getByRole('dialog',{name:'Product details'});await productDialog.waitFor();
  assert.equal(await productDialog.getByLabel('Product Name',{exact:true}).count(),1);
  assert.equal(await productDialog.evaluate(e=>e.contains(document.activeElement)),true);
  await p.keyboard.press('Escape');assert.equal(await productDialog.count(),0);assert.equal(await add.evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log('PASS UX: mobile filters/search/cart, footer, heading, dialog keyboard/focus, login feedback, contrast, splash and admin labels');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});





