import {ApiError} from '../../core/errors.js';
import type {HarnessState} from './meta-agent.js';

const messages:Record<string,string>={
 AGENT_REQUEST_DECLINED:'Muse declined this request, so no assessment was produced. Contact support if this was an ordinary weather or mission-planning question.',
 AGENT_STEP_LIMIT:'Sentinel reached its analysis limit before finishing. Try a more focused question or a shorter date range.',
 AGENT_TOOL_BUDGET:'Sentinel needed more data checks than this request allows. Try a smaller area or shorter date range.',
 AGENT_FINISH_REQUIRED:'Sentinel collected information but did not finish its answer. Please try again.',
 AGENT_UNSUPPORTED_ANSWER:'Sentinel could not verify its answer against the information retrieved. No assessment was published. Please try again.',
 AGENT_EVIDENCE_REQUIRED:'Sentinel did not complete the required information checks. No assessment was published. Please try again.',
 AGENT_OUTPUT_REQUIRED:'Sentinel returned no usable answer. Please try again.',
 AGENT_RESPONSE_INVALID:'Sentinel could not prepare a readable assessment. Please try again.',
 AGENT_TIMEOUT:'This analysis took too long to finish. Try a shorter date range or ask again shortly.',
 AGENT_TOOL_NOT_ALLOWED:'Sentinel requested an unsupported action, so the analysis was stopped. No changes were made.',
 ANALYSIS_FAILED:'Sentinel could not finish this assessment. Please try again; if it continues, share the assessment reference with support.',
};
/** Never store raw exception messages, prompts, provider envelopes, or connection strings as diagnostics. */
export function describeAgentFailure(error:unknown){
 const e=error as {name?:string;message?:string;agentRun?:{model:string;harness:HarnessState;phase:string}};
 const code=error instanceof ApiError?error.code:e?.name==='TimeoutError'||e?.name==='AbortError'?'AGENT_TIMEOUT':e?.name==='ZodError'||e?.name==='SyntaxError'?'AGENT_RESPONSE_INVALID':e?.message&&Object.hasOwn(messages,e.message)?e.message:'ANALYSIS_FAILED';
 const run=e?.agentRun;
 return {error_code:code,message:messages[code]??'The analysis could not finish. Check source availability and try again.',
   ...(run?{model:run.model,harness:run.harness}:{}),
   diagnostic:{code,phase:run?.phase??'setup_or_storage',rounds:run?.harness.rounds??0}};
}
