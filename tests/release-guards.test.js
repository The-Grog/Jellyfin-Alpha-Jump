const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const verify=require('../scripts/verify-release-assets');
test('release bytes must match both manifest and sidecar',()=>{
 const bytes=Buffer.from('release'); const hash=a=>crypto.createHash(a).update(bytes).digest('hex');
 const manifest=[{versions:[{version:'1.0.0.0',sourceUrl:'url',checksum:hash('md5')}]}];
 const side=hash('sha256')+'  artifacts/alpha-jump_1.0.0.0.zip';
 verify(manifest,'1.0.0.0','url',bytes,side);
 assert.throws(()=>verify(manifest,'1.0.0.0','url',Buffer.from('corrupt'),side));
 assert.throws(()=>verify(manifest,'1.0.0.0','url',bytes,'0'.repeat(64)+'  alpha-jump_1.0.0.0.zip'));
});
test('dashboard blocks failed-load submissions and duplicate saves',async()=>{
 const elements=new Map(); const element=id=>{if(!elements.has(id))elements.set(id,{disabled:true,checked:false,value:'prefix',addEventListener(n,fn){this[n]=fn;},replaceChildren(){}}); return elements.get(id);};
 let requests=[]; let pending;
 const code=fs.readFileSync('plugin/Jellyfin.Plugin.AlphaJump/Configuration/configPage.html','utf8').match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(code,{document:{querySelector:element},Dashboard:{showLoadingMsg(){},hideLoadingMsg(){}},ApiClient:{getUrl:x=>x,ajax:o=>{requests.push(o);return new Promise((resolve,reject)=>{pending={resolve,reject};});}}});
 const submit=()=>element('#AlphaJumpConfigForm').submit({preventDefault(){}});
 const load=()=>element('#AlphaJumpConfigPage').pageshow();
 submit(); assert.equal(requests.length,0);
 let loading=load(); submit(); assert.equal(requests.length,1); pending.reject(Error('offline'));await loading;
 submit(); assert.equal(requests.length,1);assert.equal(element('#AlphaJumpSave').disabled,true);
 loading=load();pending.resolve({Libraries:[],KeyboardJumpMode:'prefix'});await loading;
 assert.equal(element('#AlphaJumpSave').disabled,false);
 const saving=submit();submit();assert.equal(requests.length,3); pending.resolve({Libraries:[]}); await saving;
 assert.equal(element('#AlphaJumpSave').disabled,false);
});
