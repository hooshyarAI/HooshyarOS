import { SystemStatus } from "../Types/SystemTypes";

import { MemoryEngine } from "../Memory/MemoryEngine";
import { DecisionEngine } from "../Decision/DecisionEngine";
import { ReviewEngine } from "../Review/ReviewEngine";

export class HBOS {

    private version = "1.0.0";

    private initialized = false;

    private memory = new MemoryEngine();

    private decision = new DecisionEngine();

    private review = new ReviewEngine();

    constructor() {}

    public initialize(): void {

        if (this.initialized) return;

        console.log("Initializing Hooshyar Build Operating System...");

        this.memory.initialize();

        this.decision.initialize();

        this.review.initialize();

        this.initialized = true;

        console.log("HBOS Ready.");

    }

    public status(): SystemStatus {

        return {

            version: this.version,

            initialized: this.initialized,

            timestamp: new Date()

        };

    }

    public engines() {

        return {

            memory: this.memory,

            decision: this.decision,

            review: this.review

        };

    }

}