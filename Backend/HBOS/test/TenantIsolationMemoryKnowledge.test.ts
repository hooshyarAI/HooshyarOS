import { MemoryEngine } from '../Engines/MemoryEngine';
import { KnowledgeEngine } from '../Engines/KnowledgeEngine';
import { MemoryEvent } from '../Entities/MemoryEvent';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

describe('MemoryEngine and KnowledgeEngine tenant isolation', () => {

    describe('MemoryEngine', () => {

        test('same-tenant reads succeed', () => {
            const memory = new MemoryEngine();

            const eventA = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            const eventB = new MemoryEvent('PROJECT_CREATED', 'ProjectB', 'Test', TENANT_B);

            memory.store(eventA);
            memory.store(eventB);

            const aResults = memory.retrieve(TENANT_A);
            const bResults = memory.retrieve(TENANT_B);

            expect(aResults).toHaveLength(1);
            expect(aResults[0].data).toBe('ProjectA');

            expect(bResults).toHaveLength(1);
            expect(bResults[0].data).toBe('ProjectB');
        });

        test('cross-tenant queries return empty results', () => {
            const memory = new MemoryEngine();

            const eventA = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            memory.store(eventA);

            const bResults = memory.retrieve(TENANT_B);
            expect(bResults).toHaveLength(0);
        });

        test('global/system entries remain accessible without tenant filter', () => {
            const memory = new MemoryEngine();

            const systemEvent = new MemoryEvent('SYSTEM_READY', 'All systems go', 'HBOS');
            const tenantEvent = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);

            memory.store(systemEvent);
            memory.store(tenantEvent);

            const allResults = memory.retrieve();
            expect(allResults).toHaveLength(2);

            const systemOnly = allResults.find(e => e.type === 'SYSTEM_READY');
            expect(systemOnly).toBeDefined();
            expect(systemOnly!.tenantId).toBeUndefined();
        });

        test('tenant-scoped store sets tenantId on event', () => {
            const memory = new MemoryEngine();

            const event = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test');
            memory.store(event, TENANT_A);

            expect(event.tenantId).toBe(TENANT_A);
        });
    });

    describe('KnowledgeEngine', () => {

        test('same-tenant knowledge reads succeed', () => {
            const engine = new KnowledgeEngine();

            const eventA = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            const eventB = new MemoryEvent('PROJECT_CREATED', 'ProjectB', 'Test', TENANT_B);

            engine.learn(eventA);
            engine.learn(eventB);

            const aKnowledge = engine.getKnowledge(TENANT_A);
            const bKnowledge = engine.getKnowledge(TENANT_B);

            expect(aKnowledge).toHaveLength(1);
            expect(aKnowledge[0].title).toBe('PROJECT_CREATED');

            expect(bKnowledge).toHaveLength(1);
            expect(bKnowledge[0].title).toBe('PROJECT_CREATED');
        });

        test('cross-tenant knowledge queries return empty results', () => {
            const engine = new KnowledgeEngine();

            const eventA = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            engine.learn(eventA);

            const bKnowledge = engine.getKnowledge(TENANT_B);
            expect(bKnowledge).toHaveLength(0);
        });

        test('global/system knowledge remains accessible without tenant filter', () => {
            const engine = new KnowledgeEngine();

            const systemEvent = new MemoryEvent('SYSTEM_READY', 'All systems go', 'HBOS');
            const tenantEvent = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);

            engine.learn(systemEvent);
            engine.learn(tenantEvent);

            const allKnowledge = engine.getKnowledge();
            expect(allKnowledge).toHaveLength(2);

            const systemKnowledge = allKnowledge.find(k => k.title === 'SYSTEM_READY');
            expect(systemKnowledge).toBeDefined();
            expect(systemKnowledge!.tenantId).toBeUndefined();
        });

        test('learn resolves tenantId from event when explicit tenantId not provided', () => {
            const engine = new KnowledgeEngine();

            const event = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            const knowledge = engine.learn(event);

            expect(knowledge.tenantId).toBe(TENANT_A);
        });

        test('learn uses explicit tenantId over event tenantId', () => {
            const engine = new KnowledgeEngine();

            const event = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            const knowledge = engine.learn(event, TENANT_B);

            expect(knowledge.tenantId).toBe(TENANT_B);
        });

        test('toKnowledgeItems includes tenantId', () => {
            const engine = new KnowledgeEngine();

            const eventA = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            engine.learn(eventA);

            const items = engine.toKnowledgeItems();
            expect(items).toHaveLength(1);
            expect(items[0].tenantId).toBe(TENANT_A);
        });
    });

    describe('MemoryEngine -> KnowledgeEngine pipeline', () => {

        test('tenant isolation flows through pipeline', () => {
            const memory = new MemoryEngine();
            const knowledge = new KnowledgeEngine();

            memory.addListener(knowledge);

            const eventA = new MemoryEvent('PROJECT_CREATED', 'ProjectA', 'Test', TENANT_A);
            const eventB = new MemoryEvent('PROJECT_CREATED', 'ProjectB', 'Test', TENANT_B);

            memory.store(eventA);
            memory.store(eventB);

            const aMemory = memory.retrieve(TENANT_A);
            const bMemory = memory.retrieve(TENANT_B);
            const aKnowledge = knowledge.getKnowledge(TENANT_A);
            const bKnowledge = knowledge.getKnowledge(TENANT_B);

            expect(aMemory).toHaveLength(1);
            expect(bMemory).toHaveLength(1);
            expect(aKnowledge).toHaveLength(1);
            expect(bKnowledge).toHaveLength(1);
        });
    });
});
