/** A sync response may only affect the account that initiated the operation. */
export function requireSyncBinding(expectedUserId:string,current:{eligible:boolean;userId:string|null},mounted=true){
 if(!mounted||!current.eligible||current.userId!==expectedUserId)throw Error('Account changed. The previous sync response was discarded.');
}
