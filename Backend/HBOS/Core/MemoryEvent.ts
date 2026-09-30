/**
 * Canonical MemoryEvent owner.
 *
 * The event type is defined once in `Entities/MemoryEvent`; this module keeps the
 * historical `Core/MemoryEvent` import path working without a second definition.
 */
export { MemoryEvent } from "../Entities/MemoryEvent";
export type { MemoryEventProvenance, MemoryValidity } from "../Entities/MemoryEvent";
