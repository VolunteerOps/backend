import {runMetaAgent,configuredMetaKey,metaModels} from './meta-agent.js';
import {reserveUsage,finishUsage} from '../billing/usage.service.js';
import {featureCatalog} from '../billing/feature-catalog.js';
import { webcrypto as crypto } from 'node:crypto';
import { OperationsService } from '../operations/operations.service.js';
import {authorizeCapability} from '../billing/capabilities.js';
import { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { type Actor } from '../organizations/context.js';
import { withRegion } from './sentinel.context.js';
import { SentinelService } from './sentinel.service.js';
import { boundedJson } from './providers/http.js';

export const agentQuestionSchema = z.object({ question: z.string().trim().min(3).max(2000) }).strict();
const toolArguments = z.object({ view: z.enum(['summary', 'indicators']) }).strict();
type Part = { text?: string; functionCall?: { name: string; args?: unknown; id?: string }; [key: string]: unknown };
type Content = { role: string; parts: Part[] };
export type AgentGenerator = (contents: Content[], requireTool: boolean, signal: AbortSignal) => Promise<Content>;

export async function runEvidenceAgent(question: string, generate: AgentGenerator,
  evidence: (view: 'summary' | 'indicators') => Promise<unknown>, signal: AbortSignal) {
  const contents: Content[] = [{ role: 'user', parts: [{ text: question }] }];
  let calls = 0;
  for (let round = 0; round < 4; round++) {
    signal.throwIfAborted();
    const reply = await generate(contents, calls === 0, signal);
    if (reply.role !== 'model' || !Array.isArray(reply.parts) || reply.parts.length > 8) throw new Error('INVALID_AGENT_RESPONSE');
    const tools = reply.parts.filter(part => part.functionCall);
    if (!tools.length) {
      if (!calls) throw new Error('AGENT_EVIDENCE_REQUIRED');
      const answer = reply.parts.map(p => p.text ?? '').join('\n').trim();
      if (!answer || answer.length > 6000) throw new Error('INVALID_AGENT_ANSWER');
      return { answer, tool_calls: calls };
    }
    // Preserve returned parts intact, including provider thought signatures.
    contents.push(reply);
    const results: Part[] = [];
    for (const part of tools) {
      if (++calls > 3 || part.functionCall!.name !== 'read_sentinel_forecast') throw new Error('AGENT_TOOL_NOT_ALLOWED');
      const args = toolArguments.parse(part.functionCall!.args);
      results.push({ functionResponse: { name: 'read_sentinel_forecast',
        ...(part.functionCall!.id ? { id: part.functionCall!.id } : {}),
        response: { result: await evidence(args.view) } } });
    }
    contents.push({ role: 'user', parts: results });
  }
  throw new Error('AGENT_BUDGET_EXHAUSTED');
}

export async function askSentinel(actor: Actor, organizationId: string, regionId: string, input: { question: string }) {
  const { question } = agentQuestionSchema.parse(input);
  const {role}=await authorizeCapability(actor,organizationId,regionId,'agent.chat');
  configuredMetaKey();
  const reservation=await reserveUsage(actor,{key:crypto.randomUUID(),bucket:'agent.chat',limit:role==='VOLUNTEER'?featureCatalog.assistant.volunteer_daily_attempts:featureCatalog.assistant.ops_daily_attempts,fingerprint:JSON.stringify([organizationId,regionId,question])});
  const sources = new Map<string, unknown>();
  try {
    const generated = await runMetaAgent({model:metaModels.planning,question,signal:AbortSignal.timeout(60000),output:z.object({answer:z.string().min(1).max(6000)}).strict(),instruction:'Explain current scoped evidence and preparation options. Cite source IDs, source time, gaps and uncertainty. Do not invent disaster probabilities, safe routes, allocations or warning authority.',requiredTools:['read_sentinel_forecast'],tools:[{name:'read_sentinel_forecast',description:'Read the current authorized forecast and operational context.',arguments:toolArguments,execute:async arguments_ => {
      const {view}=toolArguments.parse(arguments_);
      await withRegion(actor, organizationId, regionId, false, async () => {});
      const latest = await SentinelService.latest(actor, organizationId, regionId);
      if (latest.run) sources.set(latest.run.id, latest.run);
      const operations=await OperationsService.assistantContext(actor,organizationId,regionId);
      return { operations, status: latest.status, source_id: latest.run?.id ?? null, source: latest.run,
        region: latest.region.name, validation: 'UNVALIDATED_INDICATORS',
        missing_values: latest.assessment?.missing_values ?? null,
        stale_cells: latest.assessment?.stale_cells ?? null,
        indicators: view === 'indicators' ? latest.assessment?.indicators.slice(0, 30) ?? [] :
          { count: latest.assessment?.indicators.length ?? 0 },
        limitation: 'No official warning, exposure assessment, safe route, or movement order is provided by this forecast tool.' };
    }}]});
    const result={...generated.result,model:generated.model,tool_calls:generated.tool_calls.length};
    await withRegion(actor, organizationId, regionId, false, async () => {});
    return { ...result, sources: [...sources.values()], actions_executed: [], requires_human_review: true };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'AGENT_UNAVAILABLE', 'The assistant could not complete a grounded response; try again');
  } finally {
    // A crash leaves RESERVED charged; provider failures cannot create free retry loops.
    await finishUsage(actor,reservation.entry.id,'FINALIZED');
  }
}
