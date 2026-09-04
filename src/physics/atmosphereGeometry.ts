import { AtmosphericCloudConfig, EarthDipoleConfig } from '../types';
import { EARTH_RADIUS_KM } from './physicsCalibration';

export function cloudLayerBounds(earth: EarthDipoleConfig, cloud: AtmosphericCloudConfig) {
  const altitude = cloud.cloudAltitudeKm ?? 12;
  const halfWidth = cloud.cloudLayerHalfWidthKm ?? 1.5;
  return { min: earth.radius + Math.max(0, altitude-halfWidth)/EARTH_RADIUS_KM,
    max: earth.radius + (altitude+halfWidth)/EARTH_RADIUS_KM };
}
/** Prescribed atmospheric layer, not a simulated vertical-equilibrium force. */
export function confineCloudParticle(point: { x:number; y:number }, earth: EarthDipoleConfig, cloud: AtmosphericCloudConfig) {
  const dx=point.x-earth.x, dy=point.y-earth.y;
  const angle=Math.atan2(dy,dx), radius=Math.hypot(dx,dy);
  const bounds=cloudLayerBounds(earth,cloud);
  const r=Math.max(bounds.min,Math.min(bounds.max,radius));
  point.x=earth.x+r*Math.cos(angle); point.y=earth.y+r*Math.sin(angle);
}
/** This mapping is used only by renderers, never by magnetic/particle equations. */
export function displayCloudPosition(x:number,y:number,earth:EarthDipoleConfig,cloud:AtmosphericCloudConfig) {
  const angle=Math.atan2(y-earth.y,x-earth.x), r=Math.hypot(x-earth.x,y-earth.y);
  const displayRadius=earth.radius + Math.max(0,r-earth.radius)*(cloud.altitudeDisplayGain??1);
  return { x:earth.x+displayRadius*Math.cos(angle), y:earth.y+displayRadius*Math.sin(angle), z:0 };
}
