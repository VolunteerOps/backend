import {createHmac,randomBytes} from 'node:crypto';
import {ApiError} from '../../core/errors.js';

/** Snapshot the route once per agent run. Never transmit the Meta credential to the gateway. */
export function metaTransport(env:NodeJS.ProcessEnv=process.env, keyOverride?:string) {
  const gateway=env.META_GATEWAY_URL?.trim(), secret=env.META_GATEWAY_SECRET?.trim();
  if (gateway || secret) {
    let url:URL;
    try { url=new URL(gateway??''); } catch { throw unavailable(); }
    if (!secret || secret.length<43 || url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw unavailable();
    const endpoint=new URL('/v1/chat/completions',url).href;
    return {endpoint,streaming:false,headers:(body:string):Record<string,string>=>{
      const timestamp=String(Date.now()),nonce=randomBytes(16).toString('hex');
      const signature=createHmac('sha256',secret).update(`POST\n/v1/chat/completions\n${timestamp}\n${nonce}\n`).update(body).digest('hex');
      return {'Content-Type':'application/json','x-resq-timestamp':timestamp,'x-resq-nonce':nonce,'x-resq-signature':signature};
    }};
  }
  const key=keyOverride??(env.META_MODEL_API_KEY?.trim()||env.MODEL_API_KEY?.trim());
  if (!key) throw new ApiError(503,'META_NOT_CONFIGURED','The assistant connection has not been set up. Contact your workspace administrator.');
  return {endpoint:'https://api.meta.ai/v1/chat/completions',streaming:true,headers:(_body:string):Record<string,string>=>({'Content-Type':'application/json',Authorization:'Bearer '+key})};
}
function unavailable(){return new ApiError(503,'META_NOT_CONFIGURED','The assistant connection needs attention. Contact your workspace administrator.');}
