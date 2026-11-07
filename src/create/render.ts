import type { Ambience, Score } from "./types";
import { renderScore } from "./jungle";
import { renderAmbience } from "./ambience";

type RenderJob =
  | {
      kind: "score";
      score: Score;
      rate: number;
      voices: Array<Float32Array | null>;
      clips: Map<string, Float32Array>;
      samples: Map<string, Float32Array>;
    }
  | {
      kind: "ambience";
      ambience: Ambience;
      rate: number;
    };

type RenderRequest = {
  id: number;
  job: RenderJob;
};

type RenderResult = {
  id: number;
  sides: Array<Float32Array<ArrayBuffer>> | null;
};

function renderJob(job: RenderJob): Array<Float32Array<ArrayBuffer>> {
  return job.kind === "score"
    ? renderScore(job.score, job.rate, job.voices, job.clips, job.samples)
    : [renderAmbience(job.ambience, job.rate)];
}

export { renderJob };
export type { RenderJob, RenderRequest, RenderResult };
