import test from 'node:test';
import assert from 'node:assert/strict';
import { InferenceClient } from '../src/pose/inferenceClient.js';
import { PoseCamera } from '../src/pose/poseCamera.js';

test('worker RPC errors/timeouts reject every pending request and terminate the worker', async () => {
  const previous=globalThis.Worker;
  globalThis.Worker=class { postMessage(){} terminate(){this.terminated=true;} };
  try {
    const client=new InferenceClient('fixture');
    const one=client.request('detect',{},[],15);
    const two=client.request('pose',{},[],1000);
    const results=await Promise.allSettled([one,two]);
    assert.ok(results.every(r=>r.status==='rejected'));
    assert.equal(client.requests.size,0);assert.ok(client.worker.terminated);
    await assert.rejects(client.request('detect'),/closed/);
  } finally { globalThis.Worker=previous; }
});
test('camera uses backpressure and releases old frame after tracking reset without publishing it', async () => {
  const previous=globalThis.createImageBitmap;
  const bitmap={close(){this.closed=true;}};
  globalThis.createImageBitmap=async()=>bitmap;
  try {
    const camera=new PoseCamera({video:{videoWidth:640,videoHeight:480}});
    camera.running=true;
    let finish, calls=[];
    camera.inference={request(type,payload){
      calls.push({type,payload});
      return type==='detect'?new Promise(resolve=>finish=resolve):Promise.resolve();
    }};
    const pending=camera.processVideoFrame(performance.now());
    await Promise.resolve();
    await camera.processVideoFrame(performance.now()+1);
    assert.equal(calls.length,1,'a second capture must not queue behind inference');
    camera.resetTracking();
    finish({});await pending;
    assert.equal(calls[1].type,'pose');assert.equal(calls[1].payload.crop,null);
    assert.equal(camera.results,null);assert.equal(camera.inFlight,false);
    assert.equal(camera.getState().controlReady,false);
  } finally { globalThis.createImageBitmap=previous; }
});
test('capture discarded before transfer is closed after a reset', async () => {
  const previous=globalThis.createImageBitmap;
  let finish; const bitmap={closed:false,close(){this.closed=true;}};
  globalThis.createImageBitmap=()=>new Promise(resolve=>finish=resolve);
  try {
    const camera=new PoseCamera({video:{videoWidth:640,videoHeight:480}});
    camera.running=true;camera.inference={request(){assert.fail('stale bitmap was transferred');}};
    const pending=camera.processVideoFrame(performance.now());
    camera.resetTracking();finish(bitmap);await pending;
    assert.ok(bitmap.closed);assert.equal(camera.inFlight,false);
  } finally { globalThis.createImageBitmap=previous; }
});
