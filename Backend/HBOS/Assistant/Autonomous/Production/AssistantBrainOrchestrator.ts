import { PersistentStorageAdapter } from "./PersistentStorageAdapter";
import { VectorMemoryEngine } from "./VectorMemoryEngine";
import { MemoryRetrievalEngine } from "./MemoryRetrievalEngine";
import { LLMProviderRouter } from "./LLMProviderRouter";
import { AuditTrailEngine } from "./AuditTrailEngine";
import { AutonomousBuilderAgent } from "./AutonomousBuilderAgent";

export class AssistantBrainOrchestrator {
    storage = new PersistentStorageAdapter();
    memory = new VectorMemoryEngine();
    retrieval = new MemoryRetrievalEngine();
    router = new LLMProviderRouter();
    audit = new AuditTrailEngine();
    builder = new AutonomousBuilderAgent();

    async execute(goal: string) {
        const context = this.retrieval.retrieve(goal);
        const provider = this.router.route("python");
        const build = this.builder.build(goal);

        const result = { goal, context, provider, build };

        this.storage.save(result);
        this.memory.index(result);
        this.audit.record(result);

        return result;
    }
}
