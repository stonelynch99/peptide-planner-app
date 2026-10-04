import type {Stage} from './engine';
export type StageDuration={value:string;unit:'days'|'weeks'};
// Read legacy weeks/durationWeeks as Weeks without rewriting saved history or edit fingerprints.
export function stageDuration(stage:Pick<Stage,'weeks'|'duration'|'durationWeeks'>):StageDuration{
 return stage.duration??{value:String(stage.weeks??stage.durationWeeks??''),unit:'weeks'};
}
export function durationError(stage:Stage){const d=stageDuration(stage),max=d.unit==='days'?728:104;return !['days','weeks'].includes(d.unit)||!/^\d+$/.test(d.value)||Number(d.value)<1||Number(d.value)>max?'choose 1–'+max+' '+d.unit+'.':null;}
export function stageDays(stage:Stage){const d=stageDuration(stage);return durationError(stage)?NaN:Number(d.value)*(d.unit==='weeks'?7:1);}
export function durationPatch(value:string,unit:'days'|'weeks'):Partial<Stage>{return {duration:{value,unit},weeks:unit==='weeks'?value:''};}
export function durationLabel(stage:Stage){const d=stageDuration(stage);return durationError(stage)?'Choose duration':d.value+' '+(Number(d.value)===1?d.unit.slice(0,-1):d.unit);}
export const planDays=(stages:Stage[])=>stages.reduce((n,s)=>n+stageDays(s),0);
export function planDurationLabel(stages:Stage[]){const days=planDays(stages);return !Number.isFinite(days)?'Choose duration':stages.every(s=>stageDuration(s).unit==='weeks')?days/7+' '+(days===7?'week':'weeks'):days+' '+(days===1?'day':'days');}
