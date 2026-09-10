import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:name==='mobile',hasTouch:name==='mobile'});
    page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE ERROR',m.text());});page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
    await page.goto('http://127.0.0.1:5173/?demo=1&quality=low',{waitUntil:'networkidle',timeout:45000});
    await page.waitForFunction(async()=>{return window.__MOSQUITO__?.state().simTime>2;},null,{timeout:45000});
    await page.evaluate(async()=>{window.__MOSQUITO__.state().patch({paused:true});});
    await page.waitForTimeout(600);
    await page.screenshot({path:`test-results/${name}-refined.png`,timeout:30000});
    console.log(name,await page.evaluate(async()=>{const s=window.__MOSQUITO__.state();return {ready:s.ready,time:s.simTime,behavior:s.behavior,fps:s.fps,quality:s.effectiveQuality,neurons:s.graph?.count,edges:s.graph?.edgeCount,overflow:document.documentElement.scrollWidth>innerWidth};}));
    if(name==='desktop'){await page.getByRole('button',{name:'Body detail view',exact:true}).click();await page.evaluate(async()=>{window.__MOSQUITO__.state().patch({paused:false});});await page.waitForTimeout(1600);await page.evaluate(async()=>{window.__MOSQUITO__.state().patch({paused:true});});await page.screenshot({path:'test-results/body-refined.png',timeout:30000});}
    await page.close();
  }
}finally{await browser.close();}
