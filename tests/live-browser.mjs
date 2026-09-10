import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__sockets=[];const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);window.__sockets.push(this);}};});
try{
  await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__MOSQUITO__?.state().feed.mode==='live',null,{timeout:30000});
  const live=await page.evaluate(()=>window.__MOSQUITO__.state().feed);expect(live.observedTrades).toBeGreaterThan(0);console.log('FRESH BROWSER TRADE',live);
  await page.waitForFunction(()=>!!window.__MOSQUITO__?.state().latest&&window.__MOSQUITO__.state().latest.source==='live',null,{timeout:45000});
  await page.waitForFunction(()=>window.__MOSQUITO__.state().trace?.id.startsWith('cb-')&&window.__MOSQUITO__.state().trace?.motorAt!=null,null,{timeout:15000});
  console.log('NORMALIZED LIVE EVENT',await page.evaluate(()=>({event:window.__MOSQUITO__.state().latest,trace:window.__MOSQUITO__.state().trace,behavior:window.__MOSQUITO__.state().behavior})));
  await page.evaluate(()=>window.__sockets.at(-1).close(4001,'Intentional reconnect test'));
  await page.waitForFunction(()=>window.__MOSQUITO__.state().feed.state==='RECONNECTING',null,{timeout:5000});console.log('INTERRUPTED',await page.evaluate(()=>window.__MOSQUITO__.state().feed));
  await page.waitForFunction(()=>window.__MOSQUITO__.state().feed.mode==='live',null,{timeout:30000});console.log('RECONNECTED',await page.evaluate(()=>window.__MOSQUITO__.state().feed));
  await page.getByLabel('Market product',{exact:true}).selectOption('ETH-USD');
  await page.waitForFunction(()=>window.__MOSQUITO__.state().feed.product==='ETH-USD'&&window.__MOSQUITO__.state().feed.mode==='live',null,{timeout:30000});console.log('PRODUCT CHANGED',await page.evaluate(()=>window.__MOSQUITO__.state().feed));
  await page.getByRole('button',{name:'Pause simulation',exact:true}).first().click();
  await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');window.__loss=gl.getExtension('WEBGL_lose_context');window.__loss.loseContext();});
  await expect(page.getByText(/graphics context was interrupted/)).toBeVisible();console.log('CONTEXT LOSS FALLBACK VISIBLE');
  await page.evaluate(()=>window.__loss.restoreContext());await expect(page.getByText(/graphics context was interrupted/)).not.toBeVisible({timeout:10000});console.log('CONTEXT RESTORED',errors);expect(errors).toEqual([]);
}finally{await browser.close();}
