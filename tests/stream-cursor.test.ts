import assert from 'node:assert/strict';
import {test} from 'node:test';
import {encodeCursor,decodeCursor} from '../src/modules/operations/stream-cursor.js';
test('opaque replay cursors bind user and scope, reject tampering, rotation and expiration',()=>{
 process.env.OPERATIONS_CURSOR_KEY='ab'.repeat(32);
 const scope={userId:12,organizationId:'org-a',regionId:'region-a'},now=1790870000000;
 const token=encodeCursor(42,scope,now);
 assert.equal(decodeCursor(token,scope,now),42);
 assert.notEqual(token,encodeCursor(42,scope,now));
 for(const wrong of [{...scope,userId:13},{...scope,organizationId:'org-b'},{...scope,regionId:'region-b'}])assert.throws(()=>decodeCursor(token,wrong,now),{code:'STREAM_RESNAPSHOT_REQUIRED'});
 for(const invalid of ['42',token.slice(0,-4)+'AAAA','a'.repeat(513)])assert.throws(()=>decodeCursor(invalid,scope,now),{code:'STREAM_RESNAPSHOT_REQUIRED'});
 assert.throws(()=>decodeCursor(token,scope,now+86400000),{code:'STREAM_RESNAPSHOT_REQUIRED'});
 process.env.OPERATIONS_CURSOR_KEY='cd'.repeat(32);
 assert.throws(()=>decodeCursor(token,scope,now),{code:'STREAM_RESNAPSHOT_REQUIRED'});
 delete process.env.OPERATIONS_CURSOR_KEY;
 assert.throws(()=>encodeCursor(1,scope),{code:'STREAM_NOT_CONFIGURED'});
});
