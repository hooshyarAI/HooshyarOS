/**
 * Compatibility alias for the canonical MemoryEngine.
 *
 * The single memory implementation is owned by `Core/MemoryEngine.ts`. This
 * module previously held a second, byte-identical copy; it is now a re-export
 * so there is exactly one memory owner and no duplicate retrieval engine.
 */
export {
    MemoryEngine,
    MEMORY_SYSTEM_SCOPE,
    MEMORY_INTERNAL_SCOPE,
    MemoryOwnershipRequiredError,
    MemoryTenantRequiredError,
    MemoryTenantConflictError,
} from '../Core/MemoryEngine';
