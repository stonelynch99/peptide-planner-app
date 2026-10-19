export const RELEASE_INTERVAL=24*60*60*1000;
export type Release={sha:string;publishedAt:number};
export function validRelease(value:any):value is Release{return /^[a-f0-9]{40}$/.test(value?.sha)&&Number.isSafeInteger(value?.publishedAt)&&value.publishedAt>0;}
export function newerRelease(current:Release,next:Release){return validRelease(current)&&validRelease(next)&&next.sha!==current.sha&&next.publishedAt>current.publishedAt;}
export function checkDue(last:number|null,now:number){return last===null||!Number.isFinite(last)||now<last||now-last>=RELEASE_INTERVAL;}
export function safeToReload(s:{ready:boolean;draft:boolean;saving:boolean;uploading:boolean;syncing:boolean;unsynced:boolean;interacted:boolean;safeScreen:boolean}){return s.ready&&s.safeScreen&&!s.draft&&!s.saving&&!s.uploading&&!s.syncing&&!s.unsynced&&!s.interacted;}
