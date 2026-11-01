import {z} from 'zod';
const id=z.string().uuid(),version=z.number().int().positive();
export const trainingCommands=[
 z.object({action:z.literal('CREATE_COURSE'),title:z.string().trim().min(3).max(160),skill:z.string().trim().min(2).max(60),capacity:z.number().int().min(1).max(1000),prerequisites:z.array(id).max(10).default([]),lessons:z.array(z.object({title:z.string().trim().min(3).max(160),body:z.string().trim().min(20).max(10000),question:z.string().trim().min(10).max(500),choices:z.array(z.string().trim().min(1).max(500)).min(2).max(5),answer:z.number().int().min(0).max(4)}).strict().refine(l=>l.answer<l.choices.length)).min(1).max(20)}).strict(),
 z.object({action:z.literal('PUBLISH_COURSE'),id,expected_version:version}).strict(),
 z.object({action:z.literal('ENROLL_COURSE'),id}).strict(),
 z.object({action:z.literal('SUBMIT_LESSON'),id,expected_version:version,lesson:z.number().int().nonnegative().max(19),answer:z.number().int().nonnegative().max(4)}).strict(),
 z.object({action:z.literal('REVIEW_TRAINING'),id,expected_version:version,approved:z.boolean(),reason:z.string().trim().min(10).max(1500),valid_until:z.string().datetime()}).strict(),
 z.object({action:z.literal('REVOKE_CREDENTIAL'),id,expected_version:version,reason:z.string().trim().min(10).max(1500)}).strict(),
] as const;
