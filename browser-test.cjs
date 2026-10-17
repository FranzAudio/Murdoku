const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(process.env.TEST_URL||'http://localhost:8000');await page.screenshot({path:'/tmp/murdoku-empty.png',fullPage:true});
 assert.equal(await page.locator('.cell').count(),36);assert.ok(await page.locator('#undo').isDisabled());
 await page.locator('#start').click();await page.waitForFunction(()=>!!game&&!loading);
 assert.equal(await page.locator('.person').count(),6);assert.ok(await page.locator('.clue').count()>8);
 await page.screenshot({path:'/tmp/murdoku-desktop.png',fullPage:true});
 await page.locator('[data-cell="0"]').click();assert.equal(await page.evaluate(()=>game.positions[0]),0);
 await page.locator('.person').nth(1).click();await page.locator('[data-cell="1"]').click();assert.ok(await page.locator('.cell.conflict').count()>0);
 await page.locator('#check').click();assert.match(await page.locator('#feedback').textContent(),/posizionamenti errati/);
 await page.locator('#undo').click();assert.equal(await page.evaluate(()=>game.positions[1]),-1);
 await page.locator('#mark').click();await page.locator('[data-cell="8"]').click();assert.deepEqual(await page.evaluate(()=>game.marks),[8]);
 await page.locator('#reset').click();assert.ok(await page.locator('#reset-confirm').isVisible());await page.locator('#confirm-reset').click();assert.deepEqual(await page.evaluate(()=>game.positions),[-1,-1,-1,-1,-1,-1]);
 await page.locator('.clue').first().click();assert.equal(await page.locator('.clue').first().getAttribute('aria-pressed'),'true');
 await page.locator('#language').selectOption('en');assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#check').textContent(),'Check Solution');
 // Solve through the actual keyboard and cell handlers, using engine answer only as test data.
 const solution=await page.evaluate(()=>game.puzzle.solution);
 if(await page.locator('#mark').getAttribute('aria-pressed')==='true')await page.locator('#mark').click();
 for(let p=0;p<6;p++){const cell=page.locator(`[data-cell="${solution[p]}"]`);await cell.focus();await cell.press(String(p+1));}
 await page.locator('#check').click();assert.ok(await page.locator('#modal').isVisible());assert.equal(await page.locator('#modal-title').textContent(),'CASE SOLVED!');assert.match(await page.locator('#modal-body').textContent(),/The murderer is/);
 await page.screenshot({path:'/tmp/murdoku-victory.png',fullPage:true});await page.locator('#modal-close').click();
 // Arrow navigation, removal, undo shortcut, X shortcut.
 await page.locator('[data-cell="0"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('data-cell'),'1');
 await page.locator(`[data-cell="${solution[0]}"]`).focus();await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>game.positions[0]),-1);await page.keyboard.press('Meta+z');assert.equal(await page.evaluate(()=>game.positions[0]),solution[0]);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/murdoku-mobile.png',fullPage:true});
 assert.ok(await page.locator('#board-panel').isVisible());assert.ok(!(await page.locator('#dossier').isVisible()));await page.locator('#clues-tab').click();assert.ok(await page.locator('#dossier').isVisible());
 await page.screenshot({path:'/tmp/murdoku-mobile-clues.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Forced generator exhaustion exercises retry UI, without changing production source.
 await page.evaluate(()=>{window.savedGenerate=MurdokuEngine.generate;MurdokuEngine.generate=()=>{throw new Error('expected test failure')}});
 await page.locator('#new').click();await page.waitForFunction(()=>!loading);assert.equal(await page.locator('#modal-primary').textContent(),'Retry Generation');
 await page.evaluate(()=>MurdokuEngine.generate=window.savedGenerate);await page.locator('#modal-primary').click();await page.waitForFunction(()=>!!game&&!loading&&!document.querySelector('#modal').open);
 assert.ok(await page.locator('#board-panel').isVisible());assert.equal(await page.locator('#board-tab').getAttribute('aria-pressed'),'true');
 assert.ok(await page.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)));
 assert.equal(errors.length,0,errors.join('\n'));assert.ok(requests.every(url=>url.startsWith(new URL(process.env.TEST_URL||'http://localhost:8000').origin+'/')));
 const offline=await browser.newPage();await offline.route('**/*',route=>route.request().url().startsWith('file:')?route.continue():route.abort());
 await offline.goto(require('node:url').pathToFileURL(require('node:path').resolve('index.html')).href);await offline.locator('#start').click();await offline.waitForFunction(()=>!!game&&!loading);assert.equal(await offline.locator('.cell').count(),36);
 console.log('PASS: Chrome UI interactions, keyboard, conflicts, reset confirmation, clue scratchpad, localisation, victory, generator failure/retry, 390px layout, local assets, file:// offline.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
