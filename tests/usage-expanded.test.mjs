import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { Session, SessionId } from '../_upstream/deepseek-harness/packages/core/session/src/index.ts'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm'
const {deriveTurnTokenUsage: fold} = await import(pathToFileURL(resolve('_upstream/deepseek-harness/packages/llm/token-meter/src/turn-usage.ts')).href)
const usage={inputTokens:8,outputTokens:3,totalTokens:11}
const chunk=(seq)=>({type:'chunk',time:seq,chunk:{type:'usage',usage}})
const msg=(text)=>createAssistantMessage({content:[{type:'text',text}],source:{provider:'mock',model:'mock'}})
let id=0
const session=()=>Session.create(SessionId('usage-more-'+ ++id))
function start(s){s.append('turn/start',{turn:1});s.append('step/start',{turn:1,step:1})}
function fail(s){s.append('step/end',{turn:1,step:1});s.append('turn/end',{turn:1,reason:{kind:'error',error:{code:'MOCK',message:'synthetic'}}})}
function recover(s,attempt,text){
 s.append('assistant/message',{turn:1,step:1,message:msg(text),stream:[],
 recovery:{sourceAttemptSeq:attempt.seq,reason:'upstream-failure'}},{surfaceOp:'append'})
}
function attemptWithUsage(s,text,withUsage=true){
 return s.append('assistant/attempt',{turn:1,step:1,stream:[
 {type:'text-chunks',index:0,time0:0,dt:[0],texts:[text]},
 ...withUsage?[chunk(0)]:[]
 ]})
}
test('no Usage sample remains unavailable after Recovery',()=>{
 const s=session();start(s);const a=attemptWithUsage(s,'hello',false);fail(s)
 assert.equal(fold(s.snapshotEvents()),undefined)
 recover(s,a,'hello');assert.equal(fold(s.snapshotEvents()),undefined)
})
test('official Retry markers and later Recovery do not duplicate tokens',()=>{
 const s=session();start(s)
 const a=attemptWithUsage(s,'first')
 s.append('llm/retry',{turn:1,step:1})
 s.append('llm/retry-started',{turn:1,step:1})
 const b=attemptWithUsage(s,'second')
 fail(s)
 const base=fold(s.snapshotEvents())
 assert.equal(base?.totalTokens,22)
 recover(s,b,'second')
 assert.equal(fold(s.snapshotEvents())?.totalTokens,22)
 const loaded=Session.create(SessionId('usage-reload'),s.snapshotEvents())
 assert.equal(fold(loaded.snapshotEvents().filter(x=>x.type!=='session/end-seed'))?.totalTokens,22)
})
test('normal successful assistant messages retain model Usage semantics',()=>{
 const s=session();start(s)
 s.append('assistant/message',{turn:1,step:1,message:msg('done'),stream:[],usage},{surfaceOp:'append'})
 s.append('step/end',{turn:1,step:1})
 s.append('turn/end',{turn:1,reason:{kind:'completed'}})
 assert.equal(fold(s.snapshotEvents())?.totalTokens,11)
})
test('ordinary interrupted assistant stays counted once',()=>{
 const s=session();start(s)
 s.append('assistant/message',{turn:1,step:1,message:msg('partial'),stream:[],usage,interrupted:true},{surfaceOp:'append'})
 s.append('step/end',{turn:1,step:1})
 s.append('turn/end',{turn:1,reason:{kind:'error',error:{code:'MOCK',message:'synthetic'}}})
 assert.equal(fold(s.snapshotEvents())?.totalTokens,11)
})
