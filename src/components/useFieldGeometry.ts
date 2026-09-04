import { useEffect, useRef, useState } from 'react';
import { FieldGeometry, GeometryRequest } from '../physics/fieldGeometry';

export function useFieldGeometry(request: GeometryRequest) {
  const [geometry, setGeometry] = useState<FieldGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(request);
  latest.current = request;
  const key = JSON.stringify({ ...request, context: { ...request.context,
    moon: request.context.moon?.hypothesisDipoleEnabled ? request.context.moon : undefined } });
  const signature = useRef(key);
  signature.current = key;
  useEffect(() => {
    let worker: Worker;
    try { worker = new Worker(new URL('../physics/field.worker.ts', import.meta.url), { type: 'module' }); }
    catch (cause) { console.error('Field worker startup failed', cause); setError('자기력선 계산 작업자를 시작하지 못했습니다. 새로고침하세요.'); return; }
    let busy = false, sent = '', disposed = false;
    const dispatch = () => {
      if (disposed || busy || sent === signature.current || document.hidden) return;
      busy = true; sent = signature.current;
      worker.postMessage(latest.current);
    };
    worker.onmessage = event => {
      busy = false;
      if (event.data.error) { console.error('Field worker calculation failed', event.data.error); setError('자기력선 계산 실패. 입력을 확인하세요.'); }
      else { setGeometry(event.data.geometry); setError(null); }
    };
    worker.onerror = event => { busy = false; console.error('Field worker failed', event.message); setError('자기력선 작업자 오류. 새로고침하세요.'); };
    dispatch();
    // One in-flight job and one latest snapshot: no unbounded queue during orbit/drag.
    const timer = window.setInterval(dispatch, 250);
    return () => { disposed = true; clearInterval(timer); worker.terminate(); };
  }, []);
  return { geometry, error };
}
