/** Worker entry. Only the default handler may be exported here; logic + docs live in ./harness.ts. */
import { handle, type Env, type WaitCtx } from './harness'

export default {
  fetch(req: Request, env: Env, ctx: WaitCtx): Promise<Response> {
    return handle(req, env, ctx)
  },
}
