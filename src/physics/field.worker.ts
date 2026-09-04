import { buildFieldGeometry, GeometryRequest } from './fieldGeometry';
self.onmessage = (event: MessageEvent<GeometryRequest>) => {
  try {
    const geometry = buildFieldGeometry(event.data);
    self.postMessage({ geometry }, { transfer: [geometry.positions.buffer, geometry.logs.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Field geometry failed' });
  }
};
