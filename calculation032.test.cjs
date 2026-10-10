require('./register-tests.cjs');const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('./app/node_modules/typescript');const Q=require('./app/src/quantities.ts'),E=require('./app/src/engine.ts'),{calculate}=require('./app/src/planning.ts');
test('mg/mcg quantities are equivalent through conversion, editing and calculation',()=>{for(const [mcg,mg]of [[200,.2],[500,.5],[1000,1]]){assert.equal(Q.toMg({value:mcg,unit:'mcg'}),mg);assert.deepEqual(calculate('10','2',String(Q.toMg({value:mcg,unit:'mcg'}))),calculate('10','2',String(Q.toMg({value:mg,unit:'mg'}))));assert.equal(E.storedAmount(String(mcg),'mcg'),String(mg));assert.equal(Q.quantityLabel(Q.quantityFromMg(mg,'mcg')),mcg+' mcg')}assert.throws(()=>Q.toMg({value:2,unit:'g'}));});
test('syringe automatic scales and markers map exactly to selected capacities',()=>{for(const [draw,capacity,x]of [[4,30,66],[25,30,255],[40,50,246],[75,100,232.5]]){const s=Q.syringeScale(draw);assert.equal(s.capacity,capacity);assert.equal(s.x,x);assert.equal(s.exceeds,false)}assert.equal(Q.syringeScale(4,100).x,40.8);assert.equal(Q.syringeScale(40,30).x,300);assert.equal(Q.syringeScale(40,30).exceeds,true);assert.equal(Q.syringeScale(101).exceeds,true);assert.equal(Q.syringeScale(NaN).x,30);});
test('installed SVG parser reproduces the old warning and accepts every repaired gradient stop',()=>{
 const source=fs.readFileSync('./app/node_modules/react-native-svg/src/lib/extract/extractGradient.ts','utf8');const part=source.slice(source.indexOf('const percentReg'),source.indexOf('const offsetComparator'));const code=ts.transpileModule(part,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const warnings=[];const parse=vm.runInNewContext(code+';percentToFloat',{console:{warn:m=>warnings.push(m)}});
 assert.equal(parse('.5'),0);assert.match(warnings[0],/not a valid number or percentage/);warnings.length=0;
 const svg=fs.readFileSync('./app/src/Syringe.tsx','utf8');const stops=[...svg.matchAll(/offset=(?:"([^"]+)"|\{([^}]+)\})/g)].map(m=>m[1]??Number(m[2]));assert.equal(stops.length,7);assert.deepEqual(stops.map(parse),[0,.3,.8,1,0,.5,1]);assert.deepEqual(warnings,[]);assert.ok(!/="\.[0-9]/.test(svg));
});
test('legacy saved stage/event units are upgraded without changing mg values or event status',()=>{const c=require('./app/src/content.ts').compounds.find(c=>c.id==='kpv'),d=E.importReference(c);Object.assign(d,{reviewed:true,startDate:'2026-09-07',breakWeeks:'0'});const plan=E.activate(d);delete plan.events[0].amountUnit;delete plan.stages[1].amountUnit;const read=E.decodeStore(JSON.stringify({...E.blankStore(),active:plan}));assert.equal(read.active.events[0].amountUnit,'mcg');assert.equal(read.active.events[0].amountMg,.2);assert.equal(read.active.stages[1].amountUnit,'mg');assert.equal(read.active.stages[1].amountMg,'0.3');});

// Actual input, calculation and persistence acceptance; all plan data is synthetic.
function decimalUiModule(path,dependencies){
 const source=fs.readFileSync(path,'utf8'),exports={};
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,require:id=>{if(Object.hasOwn(dependencies,id))return dependencies[id];if(id.endsWith('.webp'))return id;throw Error('Unexpected UI dependency '+id);}});
 return exports;
}
function decimalUiFixture(){
 const react={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat()}}),useState:v=>[v,()=>{}]};
 const native={Text:'Text',View:'View',Pressable:'Pressable',TextInput:'TextInput',Modal:'Modal',Image:'Image',StyleSheet:{create:x=>x}};
 const ui=decimalUiModule('./app/src/ui.tsx',{'react':react,'react-native':native,'./research-practice':{RESEARCH_PRACTICE_NOTICE:'Synthetic notice'}});
 const vial=decimalUiModule('./app/src/VialSetup.tsx',{'react':react,'react-native':native,'./ui':ui,'./SetupSummary':()=>null});
 const nodes=(tree)=>!tree?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
 return {ui,VialSetup:vial.default,nodes};
}
test('decimal input: actual numeric Field forwards partial and decimal text without rounding',()=>{
 const {ui,nodes}=decimalUiFixture(),values=[],tree=ui.Field({label:'Synthetic water',value:'3.4',numeric:true,onChange:x=>values.push(x)}),input=nodes(tree).find(x=>x.type==='TextInput');
 assert.equal(input.props.keyboardType,'decimal-pad');assert.equal(input.props.value,'3.4');
 for(const raw of ['','3.','3.4','3.45'])input.props.onChangeText(raw);
 assert.deepEqual(values,['','3.','3.4','3.45']);
});
test('decimal input: actual VialSetup forwards3.4mL and Custom selection does not edit the draft',()=>{
 const {ui,VialSetup,nodes}=decimalUiFixture(),draft={vialMg:'100',waterMl:'3.4',compoundId:'synthetic',origin:null},before=JSON.stringify(draft),changes=[];
 const tree=VialSetup({draft,change:(...args)=>changes.push(args),showErrors:true}),all=nodes(tree),field=all.find(x=>x.type===ui.Field&&x.props.label==='Diluent volume (mL)');
 assert.equal(field.props.numeric,true);assert.equal(field.props.error,undefined);field.props.onChange('3.4');field.props.onChange('3.45');
 assert.deepEqual(JSON.parse(JSON.stringify(changes)),[[{waterMl:'3.4'},false],[{waterMl:'3.45'},false]]);
 all.find(x=>x.type==='Pressable'&&x.props.accessibilityLabel==='Custom BAC water').props.onPress();
 assert.equal(changes.length,2);assert.equal(JSON.stringify(draft),before);
});
test('decimal calculation: tenths and hundredths remain precise through unit conversion',()=>{
 for(const water of ['0.1','1.2','3.4','3.45']){
  const r=calculate('100',water,'3');assert.ok(r);const values=Object.values(r).filter(x=>typeof x==='number');assert.ok(values.every(Number.isFinite));
  assert.deepEqual(r,calculate('100',water,E.storedAmount('3000','mcg')));
 }
 const r=calculate('100','3.4','3');assert.ok(Object.values(r).some(x=>typeof x==='number'&&Math.abs(x-10.2)<1e-9));
});
test('decimal save: activated events and export-reload preserve water, dose and logged history',()=>{
 const P=require('./app/src/persistence-v04.ts'),{compounds}=require('./app/src/content.ts');
 const d={...E.newDraft(compounds[0]),indefinite:false,startDate:'2026-10-04',breakWeeks:'0',vialMg:'100',waterMl:'3.4',initialVials:'1',inventoryTracking:true,reviewed:true,stages:[{id:'synthetic-decimal-stage',amountMg:'3',amountUnit:'mg',weeks:'2',override:null}],defaultSchedule:{kind:'daily',days:[],times:['10:00'],interval:null}};
 assert.deepEqual(E.validateDraft(d),[]);const p=E.activate(d,new Date('2026-10-04T12:00:00Z'));assert.equal(p.waterMl,'3.4');assert.equal(p.events[0].amountMg,3);assert.deepEqual(p.events[0].calculation,calculate('100','3.4','3'));
 const logged=E.logEvent(p,p.events[0].id,'completed',new Date(p.events[0].scheduledAt)),store={...E.blankStore(),active:logged,activePlans:[logged]},raw=P.encodePlannerStore(store),loaded=P.decodePlannerStore(raw);
 assert.equal(loaded.activePlans[0].waterMl,'3.4');assert.equal(loaded.activePlans[0].events[0].status,'completed');assert.deepEqual(loaded.activePlans[0].events[0].calculation,p.events[0].calculation);
});
