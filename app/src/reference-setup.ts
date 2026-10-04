import{calculate}from'./planning';import{syringeScale}from'./quantities';
export type SetupOrigin={sourceClass:'Common Research Setup';title:string;customized:boolean;original:{vialStrengthMg:number;diluentMl:number;concentrationMgMl:number;defaultTime:string;defaultSyringeCapacityUnits:30|50|100}};
// Explicitly supplied by Stone Lynch for this prototype. These values are not clinical-label or trial data.
export const referenceSetups:Record<string,{vialStrengthMg:number;diluentMl:number;defaultTime:string}>={
 'retatrutide':{vialStrengthMg:10,diluentMl:2,defaultTime:'09:00'},'tirzepatide':{vialStrengthMg:10,diluentMl:2,defaultTime:'09:00'},'semaglutide':{vialStrengthMg:10,diluentMl:2,defaultTime:'09:00'},'kpv':{vialStrengthMg:10,diluentMl:2,defaultTime:'09:00'},'ghk-cu':{vialStrengthMg:50,diluentMl:3,defaultTime:'09:00'},'glow-70':{vialStrengthMg:70,diluentMl:3,defaultTime:'09:00'}
};
export function setupOriginFor(compoundId:string,amountMg:string):SetupOrigin|null{
 const setup=referenceSetups[compoundId];if(!setup)return null;
 const result=calculate(String(setup.vialStrengthMg),String(setup.diluentMl),amountMg);
 return {sourceClass:'Common Research Setup',title:'Common Research Setup',customized:false,original:{...setup,concentrationMgMl:setup.vialStrengthMg/setup.diluentMl,defaultSyringeCapacityUnits:syringeScale(result?.units??null).capacity}};
}
