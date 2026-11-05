// Only one captured frame may be in flight. No queued camera frames or main-thread fallback.
export class InferenceClient {
  constructor(url) {
    this.worker = new Worker(url);
    this.requests = new Map();
    this.sequence = 0;
    this.closed = false;
    this.worker.onmessage = ({ data }) => {
      const pending = this.requests.get(data.id);
      if (!pending) return;
      this.requests.delete(data.id); clearTimeout(pending.timer);
      if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result);
    };
    this.worker.onerror = event => this.close(new Error(event.message || 'Inference worker failed'));
  }
  request(type, payload = {}, transfer = [], timeout = 3000) {
    if (this.closed) return Promise.reject(new Error('Inference worker closed'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(new Error(`Inference ${type} timed out`)), timeout);
      this.requests.set(id, { resolve, reject, timer });
      try { this.worker.postMessage({ id, type, payload }, transfer); }
      catch (error) { this.close(error); }
    });
  }
  close(error = new Error('Inference worker disposed')) {
    if (this.closed) return;
    this.closed = true; this.worker.terminate();
    for (const p of this.requests.values()) { clearTimeout(p.timer); p.reject(error); }
    this.requests.clear();
  }
}
