import {assistantAnswer} from './assistant-contract.js';
import {runMetaAgent,metaModels,type ControlledTool,type AgentEvent} from './meta-agent.js';

/** Forecast tools do the numerical work. Wonder explains their returned evidence and explicit gaps. */
export function runWeatherExplanation(options:{
 instruction:string;question:string;signal:AbortSignal;tools:ControlledTool[];requiredTools:string[];
 sourceIds:()=>string[];stream?:boolean;onEvent?:(event:AgentEvent)=>void;fetcher?:typeof fetch;key?:string;
}){
 const {sourceIds,...agent}=options;
 return runMetaAgent({...agent,model:metaModels.weather,maxTokens:1600,output:assistantAnswer,
  harness:{bookkeeping:false,finishAfterEvidence:true,verify:answer=>{
   const valid=new Set(sourceIds());
   return answer.source_ids.some(id=>!valid.has(id))?['A citation was not returned by an evidence tool. Use only retrieved source_id values; if none were retrieved, source_ids must be empty.']:[];
  }},
 });
}
