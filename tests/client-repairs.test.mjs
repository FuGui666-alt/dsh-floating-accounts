import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import vm from 'node:vm';
const source=readFileSync('src/client.js','utf8');
const css=readFileSync('src/style.css','utf8');
function deadline(){const start=source.indexOf('async function rpcWithDeadline'),end=source.indexOf('\nfunction apply',start);const context={setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(source.slice(start,end),context);return context.rpcWithDeadline;}
test('R2 write timeout reports result unknown, never retries, ignores late response',async()=>{
 let calls=0,finish;const call=()=>{calls++;return new Promise(r=>finish=r);};
 for(const method of ['save','remove','saveSite','removeSite','saveAccount','removeAccount','saveCredential','removeCredential','selectBalanceCredential','migrate']){calls=0;await assert.rejects(deadline()(call,method,{apiKey:'fixture'},5),e=>e.code==='RESULT_UNKNOWN'&&e.message.includes('不会自动重试'));assert.equal(calls,1);finish({ok:true});await new Promise(r=>setImmediate(r));assert.equal(calls,1);}
});
test('R2 read timeout is distinct; immediate transport rejection keeps its own error',async()=>{
 await assert.rejects(deadline()(()=>new Promise(()=>{}),'list',{},5),e=>e.code==='RPC_UNAVAILABLE');
 await assert.rejects(deadline()(()=>Promise.reject(Error('private transport detail')),'save',{},5),/private transport detail/);
 let calls=0;await assert.rejects(deadline()(()=>{calls++;throw Error('sync transport');},'remove',{},5),/sync transport/);assert.equal(calls,1);
});
test('R1 floating ball remains above panel stacking layer so panel cannot block ball hit testing',()=>{
 const css=readFileSync('src/style.css','utf8');
 const ball=Number(css.match(/\.dfa-ball\{[^}]*z-index:(\d+)/)[1]);
 const panel=Number(css.match(/\.dfa-panel\{[^}]*z-index:(\d+)/)[1]);
 assert.ok(ball>panel);assert.ok(css.includes('touch-action:none'));
});

// ── batch A: host design-token adoption (backlog §8.2) ─────────────────────────────────────
test('A1 focus rings, state colors and the brand color are taken from host tokens',()=>{
 for(const token of['--dsw-focus-ring-color','--dsw-focus-ring-width','--dsw-alias-state-error-primary','--dsw-alias-state-success-primary','--dsw-alias-state-warn-primary','--dsw-alias-state-warn-secondary','--dsw-alias-state-business-primary'])assert.ok(css.includes(token),`missing token ${token}`);
 assert.ok(css.includes('var(--dsw-focus-ring-color'));
 assert.ok(css.includes('var(--dsw-focus-ring-width'));
});
test('A2 elevation, menu surface and backdrop filter come from host tokens',()=>{
 for(const token of['--dsw-elevation-prominent','--dsw-elevation-soft','--dsw-specific-menu','--dsw-menu-backdrop-filter'])assert.ok(css.includes(token),`missing token ${token}`);
 assert.ok(css.includes('var(--dsw-elevation-prominent'));
 assert.ok(css.includes('var(--dsw-menu-backdrop-filter'));
});
test('A3 scrollbars use the host scrollbar tokens and reserve a stable gutter',()=>{
 assert.ok(css.includes('--dsh-scrollbar-thumb'));
 assert.ok(css.includes('--dsh-scrollbar-thumb-hover'));
 assert.ok(css.includes('scrollbar-gutter:stable'));
});
test('A4 every host token reference keeps an explicit fallback so plain web rendering never regresses',()=>{
 const bare=css.match(/var\(--dsw-[a-z0-9-]+\)/g)||[];
 assert.deepEqual(bare,[],`tokens without fallback: ${[...new Set(bare)].join(', ')}`);
 const bareScroll=css.match(/var\(--dsh-scrollbar[a-z-]*\)/g)||[];
 assert.deepEqual(bareScroll,[],`scrollbar tokens without fallback: ${[...new Set(bareScroll)].join(', ')}`);
});
test('A5 the semantic palette is token driven; remaining literal hexes sit only in fallback slots',()=>{
 // A host token reference may be followed by a fallback literal; that literal is the only
 // legitimate place for a hex color. Anything else would be a hard-coded theme value.
 const spans=[];let i=0;for(;;){const j=css.indexOf('var(',i);if(j<0)break;let depth=0,k=j;for(;k<css.length;k++){if(css[k]==='(')depth++;else if(css[k]===')'){depth--;if(depth===0)break;}}spans.push([j,k+1]);i=k+1;}
 const insideFallback=pos=>spans.some(pair=>pair[0]<=pos&&pos<pair[1]);
 const literal=[];const re=/#[0-9a-fA-F]{6}\b/g;let m;while((m=re.exec(css)))if(!insideFallback(m.index))literal.push(m[0]);
 assert.ok(literal.length<=6,`expected at most a handful of non-token literals, found ${literal.length}`);
 const semantic=['#b73131','#19764b','#b08a1e','#8a6d1a','#6b82f5','#93a7ff'];
 for(const hex of semantic)assert.equal(css.indexOf(hex+';'),-1,`${hex} must not be used as a standalone literal value`);
});
test('A15 no view container duplicates a live region with an inner status role',()=>{
 // One region carries one live semantic: the container must not add aria-live on top of an
 // inner role=status / role=alert, otherwise the same message is announced twice.
 assert.ok(!/dfa-balance[^}]*aria-live/.test(source),'the balance container must not declare aria-live');
 assert.ok(!/dfa-migration', 'aria-label': '协议检测结果'[^}]*aria-live/.test(source),'the detection container must not declare aria-live');
 const alerts=source.match(/role: 'alert'/g)||[];
 assert.ok(alerts.length<=1,`at most one role=alert may exist in the source, found ${alerts.length}`);
});
test('A6 card hierarchy no longer paints the account card with the panel background',()=>{
 assert.ok(/\.dfa-account\{[^}]*background:transparent/.test(css),'the account card must inherit the panel surface');
 assert.ok(/\.dfa-site\{[^}]*var\(--dsw-alias-border-l2/.test(css),'the site card must use the stronger border level');
 assert.ok(css.includes('var(--dsw-elevation-soft'));
});
test('A7 reduced transparency removes the backdrop blur and falls back to an opaque surface',()=>{
 assert.ok(css.includes('prefers-reduced-transparency'));
 const block=css.slice(css.indexOf('prefers-reduced-transparency'));
 assert.ok(/prefers-reduced-transparency:reduce\)\{[^}]*backdrop-filter:none/.test(block),'the reduced-transparency branch must drop the blur');
 assert.ok(/prefers-reduced-transparency:reduce\)\{[^}]*background:var\(--dsw-alias-bg-layer-2/.test(block),'the reduced-transparency branch must use an opaque background');
});
test('A8 long lists are clipped with content-visibility and a reserved intrinsic size',()=>{
 assert.ok(css.includes('content-visibility:auto'));
 assert.ok(css.includes('contain-intrinsic-size'));
 assert.ok(/\.dfa-site\{[^}]*contain-intrinsic-size/.test(css));
 assert.ok(/\.dfa-account\{[^}]*contain-intrinsic-size/.test(css));
});
test('A9 breakpoints use a container query and keep the media query as a fallback',()=>{
 assert.ok(css.includes('container-type:inline-size'));
 assert.ok(css.includes('container-name:dfa-panel'));
 assert.ok(css.includes('@container dfa-panel'));
 assert.ok(css.includes('max-width:480px'),'the original media query must stay as a fallback');
});
test('A10 touch targets reach 44px on coarse pointers and narrow viewports',()=>{
 assert.ok(css.includes('@media(pointer:coarse)'));
 assert.ok(css.includes('@media(max-width:640px)'));
 const coarse=css.slice(css.indexOf('@media(pointer:coarse)'));
 assert.ok(/min-height:44px/.test(coarse),'coarse pointers need 44px targets');
 assert.ok(/height:44px/.test(coarse),'coarse pointers need 44px inputs');
});
test('A11 every new animation stays inside a prefers-reduced-motion no-preference block',()=>{
 const reduced=css.indexOf('@media (prefers-reduced-motion: no-preference)');
 assert.ok(reduced>0,'the reduced-motion guard must exist');
 const guarded=css.slice(reduced);
 assert.ok(guarded.includes('animation:dfa-ball-breathe'));
 assert.ok(guarded.includes('animation:dfa-panel-in'));
 const outside=css.slice(0,reduced);
 assert.ok(!/animation:/.test(outside),'no animation may live outside the reduced-motion guard');
});
test('A12 the ball open state is expressed through a data-open attribute selector',()=>{
 assert.ok(css.includes('[data-open="true"]'));
 assert.ok(css.includes('[data-open="false"]'));
});
test('A13 the conflict fieldset carries no browser default border and keeps a visible legend',()=>{
 assert.ok(/\.dfa-import-conflict-fieldset\{[^}]*border:0/.test(css));
 assert.ok(/\.dfa-import-conflict-fieldset legend\{/.test(css));
});
test('A14 the stylesheet stays free of host-internal selectors and keeps the plugin scope',()=>{
 assert.ok(css.includes('.dfa-panel,.dfa-panel *'));
 assert.ok(!/--dsh-frame-top-clearance|--dsh-frame-leading-clearance/.test(css),'only the chrome-top token may be used from the frame family');
 assert.ok(css.includes('--dsh-frame-chrome-top'));
});
