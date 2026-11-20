import * as THREE from 'three';
import { CONFIG } from '../config.js';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const _infoScratch = {
  t: 0,
  phase: 'day',
  label: '☀ Day',
  isNight: false,
  hungerMultiplier: 1.0,
};

export function getTimeOfDayInfo(elapsedSec, dayDuration = CONFIG.dayDuration, out = _infoScratch) {
  const dur = dayDuration > 0 ? dayDuration : 240;
  const wrapped = ((elapsedSec % dur) + dur) % dur;
  const t = wrapped / dur;

  out.t = t;
  if (t < 0.15) {
    out.phase = 'dawn';
    out.label = '🌅 Dawn';
    out.isNight = false;
    out.hungerMultiplier = 1.0;
  } else if (t < 0.7) {
    out.phase = 'day';
    out.label = '☀ Day';
    out.isNight = false;
    out.hungerMultiplier = 1.0;
  } else if (t < 0.85) {
    out.phase = 'dusk';
    out.label = '🌇 Dusk';
    out.isNight = false;
    out.hungerMultiplier = 1.0;
  } else {
    out.phase = 'night';
    out.label = '🌙 Night';
    out.isNight = true;
    out.hungerMultiplier = CONFIG.nightHungerMultiplier;
  }
  return out;
}

export function createEnvironmentController({ scene, hemi, sun, config = CONFIG }) {
  const moon = new THREE.PointLight(0xdce8ff, 0, 240);
  scene.add(moon);

  const dawnSky = new THREE.Color('#1a0a2e');
  const duskSky = new THREE.Color('#c86038');
  const nightSky = new THREE.Color('#0a0510');
  const nightHemiSky = new THREE.Color('#222e4f');
  const nightHemiGround = new THREE.Color('#090814');
  const duskSunColor = new THREE.Color('#ff8444');
  const dawnSunColor = new THREE.Color('#ff9d66');

  const scratchSky = new THREE.Color();
  const scratchHemiSky = new THREE.Color();
  const scratchHemiGround = new THREE.Color();
  const scratchSun = new THREE.Color();

  const state = {
    t: 0.35,
    phase: 'day',
    label: '☀ Day',
    isNight: false,
    hungerMultiplier: 1.0,
    sunElevation: 45,
  };

  const baseHemiIntensity = config.lighting.hemiIntensity;
  const baseSunIntensity = config.lighting.sunIntensity;

  function update(elapsedSec, biomeAtmosphere, anchorX, anchorY, anchorZ) {
    getTimeOfDayInfo(elapsedSec, config.dayDuration, state);
    const t = state.t;

    let fogNear = biomeAtmosphere.fogNear;
    let fogFar = biomeAtmosphere.fogFar;
    let hemiIntensity = baseHemiIntensity;
    let sunIntensity = baseSunIntensity;
    let moonIntensity = 0;

    scratchSky.copy(biomeAtmosphere.sky);
    scratchHemiSky.copy(biomeAtmosphere.hemiSky);
    scratchHemiGround.copy(biomeAtmosphere.hemiGround);
    scratchSun.copy(biomeAtmosphere.sun);

    if (t < 0.15) {
      // Dawn: #1a0a2e -> biome sky
      const k = smoothstep(0.0, 0.15, t);
      scratchSky.copy(dawnSky).lerp(biomeAtmosphere.sky, k);
      scratchHemiSky.copy(nightHemiSky).lerp(biomeAtmosphere.hemiSky, k);
      scratchHemiGround.copy(nightHemiGround).lerp(biomeAtmosphere.hemiGround, k);
      scratchSun.copy(dawnSunColor).lerp(biomeAtmosphere.sun, k);
      fogNear = lerp(14, biomeAtmosphere.fogNear, k);
      fogFar = lerp(65, biomeAtmosphere.fogFar, k);
      hemiIntensity = lerp(0.42, baseHemiIntensity, k);
      sunIntensity = lerp(0.45, baseSunIntensity, k);
      moonIntensity = lerp(0.32, 0, k);
    } else if (t < 0.7) {
      // Full Day
      moonIntensity = 0;
    } else if (t < 0.85) {
      // Dusk: biome sky -> #c86038, warming sun and tightening fog toward twilight
      const k = smoothstep(0.7, 0.85, t);
      scratchSky.copy(biomeAtmosphere.sky).lerp(duskSky, k);
      scratchHemiSky.copy(biomeAtmosphere.hemiSky).lerp(duskSky, k * 0.55);
      scratchHemiGround.copy(biomeAtmosphere.hemiGround).lerp(nightHemiGround, k * 0.45);
      scratchSun.copy(biomeAtmosphere.sun).lerp(duskSunColor, k);
      fogNear = lerp(biomeAtmosphere.fogNear, 24, k);
      fogFar = lerp(biomeAtmosphere.fogFar, 95, k);
      hemiIntensity = lerp(baseHemiIntensity, 0.72, k);
      sunIntensity = lerp(baseSunIntensity, 1.05, k);
      moonIntensity = lerp(0, 0.18, k);
    } else {
      // Night: #c86038 -> #0a0510 quickly, fog near 10, far 50, hemi intensity 0.3, moon 0.4
      const enterNight = smoothstep(0.85, 0.89, t);
      const preDawn = smoothstep(0.96, 1.0, t);
      scratchSky.copy(duskSky).lerp(nightSky, enterNight);
      if (preDawn > 0) scratchSky.lerp(dawnSky, preDawn);
      scratchHemiSky.copy(duskSky).lerp(nightHemiSky, enterNight);
      scratchHemiGround.copy(biomeAtmosphere.hemiGround).lerp(nightHemiGround, enterNight);
      scratchSun.copy(duskSunColor).lerp(nightHemiSky, enterNight);
      fogNear = lerp(24, 10, enterNight);
      fogFar = lerp(95, 50, enterNight);
      hemiIntensity = lerp(0.72, 0.3, enterNight);
      sunIntensity = lerp(1.05, 0.12, enterNight);
      moonIntensity = lerp(0.18, 0.4, enterNight);
    }

    scene.background.copy(scratchSky);
    scene.fog.color.copy(scratchSky);
    scene.fog.near = fogNear;
    scene.fog.far = fogFar;

    hemi.color.copy(scratchHemiSky);
    hemi.groundColor.copy(scratchHemiGround);
    hemi.intensity = hemiIntensity;

    // Sun arc: elevation = sin(t * PI) * 60
    const sunElev = Math.sin(t * Math.PI) * 60;
    state.sunElevation = sunElev;
    const sunAzimuth = (t - 0.45) * Math.PI;
    const sunOffX = Math.sin(sunAzimuth) * 52;
    const sunOffZ = 22;
    const sunOffY = Math.max(5, sunElev);

    sun.color.copy(scratchSun);
    sun.intensity = sunIntensity;
    sun.position.set(anchorX + sunOffX, anchorY + sunOffY, anchorZ + sunOffZ);
    sun.target.position.set(anchorX, anchorY, anchorZ);

    // Moon opposite the sun at night
    moon.intensity = moonIntensity;
    moon.position.set(anchorX - sunOffX, anchorY + 34, anchorZ - sunOffZ);

    return state;
  }

  return {
    moon,
    state,
    update,
  };
}
