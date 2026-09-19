const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const lab=fs.readFileSync('./app/src/MultiPlanLab.tsx','utf8');
const basics=fs.readFileSync('./app/src/SchoolBasicsReview.tsx','utf8');
const school=fs.readFileSync('./app/src/school-basics.ts','utf8');
const app=fs.readFileSync('./app/AppV04.tsx','utf8');
const customer=fs.readFileSync('./app/App.tsx','utf8');

test('calendar is deliberately density-first for multi-plan load',()=>{assert.match(lab,/Calendar shows density first/);assert.match(lab,/selectedEvents\.slice\(0,8\)/);assert.match(lab,/more events/);});
test('six-plan real-world acceptance set stays first in stress ordering',()=>{for(const id of ['retatrutide','ghk-cu','5-amino-1mq','ss-31','nad-plus','mots-c'])assert.match(lab,new RegExp(id));});
test('inventory removes kit ambiguity',()=>{assert.match(lab,/Enter individual vials, not kits/);assert.match(lab,/1 kit containing 10 vials = 10 individual vials/);assert.match(lab,/VIALS \/ KIT/);});
test('quick start teaches terminology before arithmetic',()=>{assert.match(school,/Lyophilized means freeze-dried/);assert.match(school,/Reconstitution means adding a specified liquid/);assert.match(school,/Bacteriostatic Water for Injection, USP/);assert.match(basics,/THE MATH AT A GLANCE/);assert.match(basics,/10 mg \+ 1 mL/);assert.match(basics,/0\.1 mg/);});
test('quick start does not claim universal diluent compatibility',()=>{assert.match(school,/correct diluent is product-specific/);assert.match(school,/do not assume every vial uses the same liquid/);assert.match(basics,/correct diluent and setup depend on the specific product\/reference/);});
test('0.4 customer entry uses established app instead of engineering review shell',()=>{assert.match(app,/export \{default\} from '\.\/App'/);assert.doesNotMatch(app,/MultiPlanLab.*from/);assert.match(customer,/Pep School/);assert.match(customer,/Guide/);assert.match(customer,/My Peptides/);assert.match(customer,/Tracker/);assert.match(customer,/More/);});
