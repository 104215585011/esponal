import type { LecturaStory } from "./types";
import { laTortugaYLaLiebre } from "./la-tortuga-y-la-liebre";
import { elLeonYElRaton } from "./el-leon-y-el-raton";
import { elFlautistaDeHamelin } from "./el-flautista-de-hamelin";
import { unDiaEnMadrid } from "./un-dia-en-madrid";
import { elCafeDeLasMananas } from "./el-cafe-de-las-mananas";
import { laSiesta } from "./la-siesta";
import { lasTapas } from "./las-tapas";
import { elFlamenco } from "./el-flamenco";
import { laSobremesa } from "./la-sobremesa";
import { lasUvasDeNochevieja } from "./las-uvas-de-nochevieja";
import { elDiaDeReyes } from "./el-dia-de-reyes";
import { laTomatina } from "./la-tomatina";
import { lasFallasDeValencia } from "./las-fallas-de-valencia";
import { sanFermin } from "./san-fermin";
import { elCaminoDeSantiago } from "./el-camino-de-santiago";
import { elDiaDeLosMuertos } from "./el-dia-de-los-muertos";
import { losMariachis } from "./los-mariachis";
import { laPinata } from "./la-pinata";
import { lasPosadas } from "./las-posadas";
import { laVirgenDeGuadalupe } from "./la-virgen-de-guadalupe";
import { laLuchaLibre } from "./la-lucha-libre";
import { laQuinceanera } from "./la-quinceanera";
import { elMate } from "./el-mate";
import { elTango } from "./el-tango";
import { elAsado } from "./el-asado";
import { lasEmpanadas } from "./las-empanadas";
import { laSalsaCubana } from "./la-salsa-cubana";
import { elCafeCubano } from "./el-cafe-cubano";
import { laBachataDominicana } from "./la-bachata-dominicana";
import { elCevichePeruano } from "./el-ceviche-peruano";
import { lasLlamasYLasAlpacas } from "./las-llamas-y-las-alpacas";
import { elIntiRaymi } from "./el-inti-raymi";
import { losDosApellidos } from "./los-dos-apellidos";
import { laHoraLatina } from "./la-hora-latina";
import { losApodosCarinosos } from "./los-apodos-carinosos";

export type { LecturaLevel, LecturaStory } from "./types";

export const lecturaStories: LecturaStory[] = [
  // Originales (5)
  laTortugaYLaLiebre,
  elLeonYElRaton,
  elFlautistaDeHamelin,
  unDiaEnMadrid,
  elCafeDeLasMananas,
  // España (10)
  laSiesta,
  lasTapas,
  elFlamenco,
  laSobremesa,
  lasUvasDeNochevieja,
  elDiaDeReyes,
  laTomatina,
  lasFallasDeValencia,
  sanFermin,
  elCaminoDeSantiago,
  // México (7)
  elDiaDeLosMuertos,
  losMariachis,
  laPinata,
  lasPosadas,
  laVirgenDeGuadalupe,
  laLuchaLibre,
  laQuinceanera,
  // Río de la Plata (4)
  elMate,
  elTango,
  elAsado,
  lasEmpanadas,
  // Caribe (3)
  laSalsaCubana,
  elCafeCubano,
  laBachataDominicana,
  // Andes (3)
  elCevichePeruano,
  lasLlamasYLasAlpacas,
  elIntiRaymi,
  // Pan-hispano (3)
  losDosApellidos,
  laHoraLatina,
  losApodosCarinosos
];

export function getLecturaStory(slug: string): LecturaStory | undefined {
  return lecturaStories.find((story) => story.slug === slug);
}
