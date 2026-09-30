export const ATTACHMENT_BUCKET='beta-feedback-private';
export const MAX_SCREENSHOTS=3, MAX_SCREENSHOT_BYTES=5*1024*1024;
export type Screenshot={id:string;file:File;preview:string};
export function validateScreenshot(file:{type:string;size:number},count:number){
  if(count>=MAX_SCREENSHOTS)throw Error('Attach up to three screenshots.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>MAX_SCREENSHOT_BYTES)throw Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
}
export function screenshotPath(user:string,report:string,id:string,type:string){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![user,report,id].every(x=>uuid.test(x)))throw Error('Invalid attachment identity.');
  const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[type];
  if(!ext)throw Error('Unsupported screenshot.');
  return `${user}/${report}/${id}.${ext}`;
}
// The same report ID, paths and bytes are reused after any ambiguous response.
export async function uploadFeedback(port:{upload:(path:string,file:File)=>Promise<void>;complete:(paths:string[])=>Promise<void>},user:string,report:string,shots:Screenshot[]){
  if(shots.length>MAX_SCREENSHOTS)throw Error('Too many screenshots.');
  const paths:string[]=[];
  for(const [index,shot] of shots.entries()){
    validateScreenshot(shot.file,index);
    const path=screenshotPath(user,report,shot.id,shot.file.type);
    await port.upload(path,shot.file);paths.push(path);
  }
  await port.complete(paths);
}
