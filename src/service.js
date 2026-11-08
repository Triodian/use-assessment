// The AI Use Assessment app's service for the other Triodian apps (development plan task 3.7).
// The AI Risk Appetite app binds to this entrypoint with a Cloudflare service binding:
//   "services": [{ "binding": "ASSESSMENT", "service": "use-assessment", "entrypoint": "AssessmentService" }]
// A binding reaches the Worker directly inside the Cloudflare account. It has no public URL and needs no secret.
// It offers one thing only: the in-use feed (register extract v2) as last issued.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { feedbackForService } from './worker.js';

export class AssessmentService extends WorkerEntrypoint {
  /** The in-use feed: { status, body }, as GET /api/appetite-feedback answers it. */
  async feedback() { return feedbackForService(this.env); }
}
