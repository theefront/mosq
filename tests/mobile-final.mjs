import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?demo=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__MOSQUITO__?.state().ready);
  await page.getByRole('button',{name:'Heat lure'}).tap();await page.touchscreen.tap(130,462);
  await page.waitForFunction(()=>window.__MOSQUITO__.state().trace?.motorAt!==null&&window.__MOSQUITO__.state().trace?.id.startsWith('manual'),null,{timeout:15000});
  const response=await page.evaluate(()=>{const s=window.__MOSQUITO__.state();return {event:s.latest,trace:s.trace,behavior:s.behavior,quality:s.effectiveQuality,reduced:s.reducedMotion,fps:s.fps,overflow:document.documentElement.scrollWidth>innerWidth};});console.log('TOUCH RESPONSE',response);expect(response.overflow).toBe(false);expect(response.reduced).toBe(true);
  await page.getByRole('button',{name:'Heat lure'}).tap();await page.screenshot({path:'test-results/mobile-final.png',timeout:30000});
  await page.getByRole('button',{name:'Open inspector and settings',exact:true}).tap();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Sensory · left'}).click();await page.getByRole('button',{name:'Close drawer'}).click();
  await page.getByRole('button',{name:'Body detail view',exact:true}).tap();await page.waitForTimeout(400);await page.getByRole('button',{name:'Full exhibit view',exact:true}).tap();
  console.log('MOBILE ERRORS',errors);expect(errors).toEqual([]);await page.close();
  const fallback=await browser.newPage({viewport:{width:1000,height:800}});await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.call(this,type,...args);};});
  await fallback.goto('http://127.0.0.1:5173/?demo=1',{waitUntil:'networkidle'});await expect(fallback.getByText('A little more graphics power, please.')).toBeVisible();await expect(fallback.getByRole('button',{name:'CO₂ puff'})).toBeEnabled();console.log('NO WEBGL FALLBACK PASSED');await fallback.close();
}finally{await browser.close();}
