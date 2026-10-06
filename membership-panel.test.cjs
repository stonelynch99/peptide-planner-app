const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('./app/node_modules/typescript');
require('./register-tests.cjs');
const {membershipAccess}=require('./app/src/cloud/membership-access.ts');
const source=fs.readFileSync('./app/src/cloud/MembershipAccessPanel.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const access=(tier='free',basis='free')=>({status:'verified',tier,basis,betaExpiresAt:null,accessVersion:'v2',selectionRevision:2,selectedCompoundId:tier==='free'?'a':null,tracking:{limit:tier==='free'?1:null,requiresSelection:false},learning:tier==='free'?'introductory':'full',receipt:'12345678-1234-1234-1234-123456789abc',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+60000).toISOString(),preserveAllData:true});
function fixture({value=access(),viewUser='one',choice=null,readResult={planner:{revision:7}},failure=false}={}){
 const values=[value?{userId:viewUser,access:value}:null,false,'',choice],updates=[],calls=[];let index=0;
 const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:()=>{const i=index++;return[values[i],v=>updates.push([i,v])];},useRef:v=>({current:v}),useEffect:()=>{}};
 const gateway={status:async id=>{calls.push(['status',id]);if(failure)throw Error('unavailable');return access();},read:async id=>{calls.push(['read',id]);return readResult;},select:async(...args)=>calls.push(['select',...args])};
 const context=vm.createContext({exports:{},setTimeout,clearTimeout,require:name=>{
  if(name==='react')return{...React,default:React};
  if(name==='react-native')return{View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:v=>v}};
  if(name==='./client')return{membershipGateway:gateway};
  if(name==='./membership-access')return require('./app/src/cloud/membership-access.ts');
  throw Error(name);
 }});
 vm.runInContext(code,context);
 const root=context.exports.default({userId:'one',onClose:()=>calls.push(['close']),trackingChoices:[{id:'a',name:'Alpha'},{id:'a',name:'Alpha duplicate'},{id:'b',name:'Beta'}]}),nodes=[];
 function visit(n){if(!n||typeof n!=='object')return;nodes.push(n);n.children?.forEach(visit);}visit(root);
 const text=n=>typeof n==='string'||typeof n==='number'?String(n):n?.children?.map(text).join('')||'';
 return{allText:text(root),updates,calls,button:label=>nodes.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label)};
}
test('membership screen: Free shows selected peptide and deduplicated choices',()=>{const f=fixture();assert.match(f.allText,/Free membership/);assert.match(f.allText,/Selected peptide: Alpha/);assert.ok(f.button('Choose Beta'));assert.equal(f.button('Choose Alpha').props.disabled,true);assert.equal(f.button('Choose Alpha duplicate'),undefined);assert.deepEqual(f.calls,[]);});
test('membership screen: beta Pro is free indefinitely and has no payment action',()=>{const f=fixture({value:access('pro','existing_beta')});assert.match(f.allText,/permanent beta membership/);assert.match(f.allText,/free indefinitely/);assert.equal(f.button('Choose Beta'),undefined);assert.doesNotMatch(f.allText,/4.99|first 3 months|TEST checkout/);});
test('membership screen: paid Pro remains distinct from beta access',()=>{const f=fixture({value:access('pro','paid')});assert.match(f.allText,/Pro membership/);assert.doesNotMatch(f.allText,/permanent beta membership|free indefinitely/);});
test('membership screen: unavailable, expired and previous-account access never displays Pro',()=>{const expired={...access('pro','paid'),validUntil:new Date(Date.now()-1).toISOString()};for(const options of [{value:null},{value:expired},{value:access('pro','paid'),viewUser:'other'}]){const f=fixture(options);assert.match(f.allText,/Membership needs verification/);assert.doesNotMatch(f.allText,/Pro membership|Choose Beta/);}});
test('membership screen: choice requests confirmation before any provider call',()=>{const f=fixture();f.button('Choose Beta').props.onPress();assert.equal(f.updates.at(-1)[0],3);assert.equal(f.updates.at(-1)[1].id,'b');assert.deepEqual(f.calls,[]);});
test('membership screen: confirm selection freshly binds access and cloud revision',async()=>{const f=fixture({choice:{id:'b',name:'Beta'}});f.button('Confirm Beta').props.onPress();await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls.map(c=>c[0]),['status','read','select','status']);assert.equal(f.calls[2][1],'one');assert.equal(f.calls[2][2],'b');assert.equal(f.calls[2][3],7);assert.equal(membershipAccess(f.calls[2][4]).selectionRevision,2);assert.ok(f.updates.some(([i,v])=>i===3&&v===null));});
test('membership screen: missing cloud plan never issues selection or a planner write',async()=>{const f=fixture({choice:{id:'b',name:'Beta'},readResult:{planner:null}});f.button('Confirm Beta').props.onPress();await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls.map(c=>c[0]),['status','read']);assert.ok(f.updates.some(([i,v])=>i===2&&/Save a cloud copy/.test(v)));});
