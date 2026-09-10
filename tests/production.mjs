import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?demo=1&quality=medium',{waitUntil:'networkidle'});await expect(page.locator('.loading-label')).toHaveCount(0);await expect(page.locator('canvas')).toBeVisible();
 await page.getByRole('button',{name:'Heat lure'}).click();await expect(page.locator('.telemetry h2')).toHaveText(/Approaching|Feeding/,{timeout:20000});
 await page.getByRole('button',{name:'Heat lure'}).click();await page.getByRole('button',{name:'Passing shadow'}).click();await expect(page.locator('.telemetry h2')).toHaveText(/Startled|Recovering/,{timeout:15000});
 await page.getByRole('button',{name:'Pause simulation',exact:true}).first().click();await page.screenshot({path:'test-results/production-desktop.png',timeout:30000});
 console.log('PRODUCTION WORKER + RENDER + INTERACTIONS PASS',await page.evaluate(()=>({debugHook:typeof window.__MOSQUITO__,renderer:(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return gl.getParameter(gl.VERSION);})(),disclosure:document.querySelector('.truth-note').textContent})));
 console.log('PRODUCTION CONSOLE ERRORS',errors);expect(errors).toEqual([]);
}finally{await browser.close();}
