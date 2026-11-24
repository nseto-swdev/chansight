export class WorkerEntrypoint<Env = unknown> {
  protected env!: Env;
  protected ctx!: ExecutionContext;
}
