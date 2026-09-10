import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{const s=window.__MOSQUITO__.state();return {ready:s.ready,paused:s.paused,behavior:s.behavior,time:s.simTime,latest:s.latest,trace:s.trace,motor:s.motor,view:s.view,tool:s.tool,feed:s.feed,fps:s.fps,quality:s.effectiveQuality};});
try {
  await page.goto('http://127.0.0.1:5173/?demo=1&quality=low',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__MOSQUITO__?.state().ready,{timeout:45000});
  await page.waitForTimeout(3500);
  console.log('Initial',await state());
  await page.getByRole('button',{name:'Pause simulation',exact:true}).first().click();
  const before=await state();await page.waitForTimeout(1400);const after=await state();expect(after.time).toBe(before.time);expect(after.paused).toBe(true);console.log('Pause freezes time',before.time,after.time);
  await page.getByRole('button',{name:'Brain detail view',exact:true}).click();expect((await state()).view).toBe('brain');
  await page.getByRole('button',{name:'Full exhibit view',exact:true}).click();
  await page.getByRole('button',{name:'Resume simulation',exact:true}).first().click();
  await page.getByRole('button',{name:'Heat lure'}).click();expect((await state()).tool).toBe('lure');
  await page.mouse.move(630,495);await page.waitForTimeout(1000);const lure=await state();expect(lure.latest.source).toBe('manual');expect(lure.latest.kind).toBe('attraction');
  await page.waitForFunction(()=>['approaching','feeding'].includes(window.__MOSQUITO__.state().behavior),null,{timeout:10000});console.log('Lure response',await state());
  await page.getByRole('button',{name:'Heat lure'}).click();
  await page.getByRole('button',{name:'Passing shadow'}).click();
  await page.waitForFunction(()=>window.__MOSQUITO__.state().behavior==='startled',null,{timeout:10000});console.log('Shadow response',await state());
  await page.getByRole('button',{name:'Pause simulation',exact:true}).first().click();await page.screenshot({path:'test-results/desktop-final.png',timeout:30000});
  await page.getByRole('button',{name:'Open inspector and settings',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();console.log('Inspector',await page.getByRole('dialog').innerText());await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:/Cinema/}).first().click();await expect(page.locator('.interface')).toHaveClass(/cinema/);await page.getByRole('button',{name:/Exit cinema/}).last().click();
  await page.getByRole('button',{name:'Enable sound'}).click();await expect(page.getByRole('button',{name:'Mute sound'})).toBeVisible();await page.getByRole('button',{name:'Mute sound'}).click();
  console.log('Browser errors',errors);expect(errors).toEqual([]);
}finally{await browser.close();}
