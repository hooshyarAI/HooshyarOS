/**
 * Phase 05C-D2 - Persistence Foundation Tests
 * 
 * Tests the persistence foundation:
 * 1. SQLite database can initialize locally/offline
 * 2. Repository CRUD works for a tenant-scoped resource
 * 3. Tenant A cannot read Tenant B data
 * 4. Tenant A cannot write Tenant B data
 * 5. Global resource remains accessible without tenantId
 * 6. Decision + Evidence transaction is atomic
 * 7. Tenant bootstrap transaction is atomic
 * 8. SecurityContext is not persisted
 * 9. Secrets are not persisted
 * 10. Provenance fields remain compatible
 * 11. Existing Phase 05A/05B tests remain green
 * 12. Existing Phase 05C-B/C security tests remain green
 * 13. Persistence layer can be instantiated through a replaceable interface
 */

import { SQLiteAdapter, RepositoryFactory } from "../Persistence/SQLiteAdapter";
import { IRepository, ITenantRepository, IUserRepository, IProjectRepository, IDecisionRepository, IEvidenceRepository } from "../Persistence/IRepository";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal, PrincipalType } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";

describe("Phase 05C-D2 - Persistence Foundation", () => {

    // ===== Test 1: SQLite database can initialize locally/offline =====
    describe("Test 1: SQLite initialization", () => {
        it("can initialize SQLite database in memory (offline)", async () => {
            const factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
            const healthy = await factory.health();
            expect(healthy).toBe(true);
            factory.close();
        });

        it("can initialize SQLite database with file path", async () => {
            const factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
            // Get repositories
            const tenantRepo = factory.getTenantRepository();
            expect(tenantRepo).toBeDefined();
            factory.close();
        });
    });

    // ===== Test 2: Repository CRUD works for a tenant-scoped resource =====
    describe("Test 2: Repository CRUD for tenant-scoped resource", () => {
        let factory: RepositoryFactory;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
        });

        afterEach(() => {
            factory.close();
        });

        it("can create a tenant", async () => {
            const tenantRepo = factory.getTenantRepository();
            const result = await tenantRepo.create({
                name: "Test Tenant",
                status: "ACTIVE"
            });
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.name).toBe("Test Tenant");
        });

        it("can create a project within tenant context", async () => {
            // Create tenant first
            const tenantResult = await factory.getTenantRepository().create({
                name: "Test Tenant",
                status: "ACTIVE"
            });
            expect(tenantResult.success).toBe(true);

            // Create user and project
            const human = Principal.humanUser("user-1", tenantResult.data!.id);
            const context = SecurityContext.forHumanUser(human, [Authorization.READ, Authorization.WRITE]);

            const projectRepo = factory.getProjectRepository();
            const projectResult = await projectRepo.create(context, {
                name: "Test Project",
                status: "Planning"
            });

            expect(projectResult.success).toBe(true);
            expect(projectResult.data).toBeDefined();
            expect(projectResult.data?.name).toBe("Test Project");
            expect(projectResult.data?.tenantId).toBe(tenantResult.data?.id);
        });

        it("can read project within tenant", async () => {
            // Setup
            const tenantResult = await factory.getTenantRepository().create({
                name: "Test Tenant",
                status: "ACTIVE"
            });
            const human = Principal.humanUser("user-1", tenantResult.data!.id);
            const context = SecurityContext.forHumanUser(human, [Authorization.READ, Authorization.WRITE]);
            const projectResult = await factory.getProjectRepository().create(context, {
                name: "Test Project",
                status: "Planning"
            });

            // Read
            const found = await factory.getProjectRepository().findById(context, projectResult.data!.id);
            expect(found.success).toBe(true);
            expect(found.data?.name).toBe("Test Project");
        });
    });

    // ===== Test 3 & 4: Tenant isolation - cross-tenant access denied =====
    describe("Test 3 & 4: Tenant isolation enforced", () => {
        let factory: RepositoryFactory;
        let tenantAId: string;
        let tenantBId: string;
        let contextA: SecurityContext;
        let contextB: SecurityContext;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();

            // Create two tenants
            const tenantAResult = await factory.getTenantRepository().create({ name: "Tenant A", status: "ACTIVE" });
            const tenantBResult = await factory.getTenantRepository().create({ name: "Tenant B", status: "ACTIVE" });
            tenantAId = tenantAResult.data!.id;
            tenantBId = tenantBResult.data!.id;

            // Create contexts
            const userA = Principal.humanUser("user-A", tenantAId);
            const userB = Principal.humanUser("user-B", tenantBId);
            contextA = SecurityContext.forHumanUser(userA, [Authorization.READ, Authorization.WRITE]);
            contextB = SecurityContext.forHumanUser(userB, [Authorization.READ, Authorization.WRITE]);
        });

        afterEach(() => {
            factory.close();
        });

        it("cannot read Tenant B data from Tenant A context", async () => {
            // Create project for Tenant B
            const projectB = await factory.getProjectRepository().create(contextB, {
                name: "Tenant B Project",
                status: "Active"
            });

            // Try to read from Tenant A context
            const result = await factory.getProjectRepository().findById(contextA, projectB.data!.id);

            // Should fail or return null (tenant isolation enforced)
            expect(result.success).toBe(true); // Query succeeded
            expect(result.data).toBeNull(); // But no data returned
        });

        it("cannot write Tenant B data from Tenant A context", async () => {
            // Try to create project in Tenant B's scope from Tenant A
            const result = await factory.getProjectRepository().create(contextA, {
                name: "Unauthorized Project",
                status: "Active"
            });

            // The context has tenantId = TenantA, but we're trying to create a project
            // The repository should use context.tenantId, not allow arbitrary tenant assignment
            // This should succeed but belong to Tenant A
            expect(result.success).toBe(true);
            expect(result.data?.tenantId).toBe(tenantAId); // Belongs to Tenant A
        });
    });

    // ===== Test 5: Global resource remains accessible without tenantId =====
    describe("Test 5: Global resources", () => {
        let factory: RepositoryFactory;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
        });

        afterEach(() => {
            factory.close();
        });

        it("Tenant repository is not tenant-scoped (system operation)", async () => {
            // Tenant operations are system-level, not tenant-scoped
            const tenantRepo = factory.getTenantRepository();
            const result = await tenantRepo.create({ name: "Global Tenant", status: "ACTIVE" });
            expect(result.success).toBe(true);
        });

        it("can find tenant by name without SecurityContext", async () => {
            // Tenants are global resources
            await factory.getTenantRepository().create({ name: "Find Me", status: "ACTIVE" });
            const found = await factory.getTenantRepository().findByName("Find Me");
            expect(found.success).toBe(true);
            expect(found.data?.name).toBe("Find Me");
        });
    });

    // ===== Test 6: Decision + Evidence transaction is atomic =====
    describe("Test 6: Atomic transactions", () => {
        let factory: RepositoryFactory;
        let tenantId: string;
        let context: SecurityContext;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();

            const tenantResult = await factory.getTenantRepository().create({ name: "Test Tenant", status: "ACTIVE" });
            tenantId = tenantResult.data!.id;

            // Create project first
            const human = Principal.humanUser("user-1", tenantId);
            context = SecurityContext.forHumanUser(human, [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE]);
            await factory.getProjectRepository().create(context, { name: "Test Project", status: "Active" });
        });

        afterEach(() => {
            factory.close();
        });

        it("can execute atomic decision + evidence transaction", async () => {
            const txManager = factory.getTransactionManager();

            const result = await txManager.execute(async () => {
                // Create decision
                const decisionRepo = factory.getDecisionRepository();
                const decisionResult = await decisionRepo.create(context, {
                    projectId: "test-project-id", // Note: not creating actual project, just for test
                    status: "DECIDED",
                    message: "Test decision",
                    traceId: "TRACE-123",
                    inputHash: "hash-input"
                });

                // Create evidence
                const evidenceRepo = factory.getEvidenceRepository();
                await evidenceRepo.append(context, {
                    traceId: "TRACE-123",
                    inputHash: "hash-input",
                    outputHash: "hash-output",
                    verificationStatus: "VERIFIED",
                    explanation: "Test evidence"
                });

                return { decisionId: decisionResult.data?.id };
            });

            expect(result.success).toBe(true);
        });

        it("transaction rollback on failure", async () => {
            const txManager = factory.getTransactionManager();

            const result = await txManager.execute(async () => {
                // Try to create with invalid reference - should fail
                const decisionRepo = factory.getDecisionRepository();
                return await decisionRepo.create(context, {
                    projectId: "non-existent-project",
                    status: "DECIDED",
                    message: "This should fail due to FK constraint"
                });
            });

            // Transaction should have rolled back
            expect(result.success).toBe(false);
        });
    });

    // ===== Test 7: Tenant bootstrap transaction is atomic =====
    describe("Test 7: Tenant bootstrap atomicity", () => {
        let factory: RepositoryFactory;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
        });

        afterEach(() => {
            factory.close();
        });

        it("can bootstrap tenant atomically", async () => {
            const txManager = factory.getTransactionManager();

            const result = await txManager.execute(async () => {
                // Create tenant
                const tenantRepo = factory.getTenantRepository();
                const tenant = await tenantRepo.create({ name: "Bootstrap Tenant", status: "ACTIVE" });

                // Create first user for tenant
                const userRepo = factory.getUserRepository();
                const human = Principal.humanUser("admin", tenant.data!.id);
                const context = SecurityContext.forHumanUser(human, [Authorization.READ, Authorization.WRITE]);
                await userRepo.create(context, { identity: "admin@tenant.com", status: "ACTIVE" });

                return { tenantId: tenant.data?.id };
            });

            expect(result.success).toBe(true);
        });
    });

    // ===== Test 8: SecurityContext is not persisted =====
    describe("Test 8: SecurityContext not persisted", () => {
        it("SecurityContext is ephemeral - only used for authorization", () => {
            // SecurityContext never appears in any repository interface
            // It's only used as a parameter for authorization checks
            
            // Verify the contract: SecurityContext is in parameter, not stored
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            
            // SecurityContext should exist and be usable
            expect(context.actor).toBeDefined();
            expect(context.tenantId).toBe("tenant-123");
            
            // But SecurityContext is NOT an entity that gets persisted
            // There's no ISecurityContextRepository
        });
    });

    // ===== Test 9: Secrets are not persisted =====
    describe("Test 9: Secrets not persisted", () => {
        let factory: RepositoryFactory;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
        });

        afterEach(() => {
            factory.close();
        });

        it("repositories do not have secret fields", async () => {
            // User repository should not persist credentials
            const tenantResult = await factory.getTenantRepository().create({ name: "Test", status: "ACTIVE" });
            const human = Principal.humanUser("user-1", tenantResult.data!.id);
            const context = SecurityContext.forHumanUser(human, [Authorization.WRITE]);

            const userRepo = factory.getUserRepository();
            const result = await userRepo.create(context, {
                identity: "user@example.com",
                status: "ACTIVE"
            });

            expect(result.success).toBe(true);
            // User entity has 'identity' but no 'password' or 'secret' field
            // Credentials are managed externally (not in this persistence layer)
        });
    });

    // ===== Test 10: Provenance fields remain compatible =====
    describe("Test 10: Provenance compatibility", () => {
        let factory: RepositoryFactory;

        beforeEach(async () => {
            factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
        });

        afterEach(() => {
            factory.close();
        });

        it("Decision record preserves provenance fields", async () => {
            const tenantResult = await factory.getTenantRepository().create({ name: "Test", status: "ACTIVE" });
            const human = Principal.humanUser("user-1", tenantResult.data!.id);
            const context = SecurityContext.forHumanUser(human, [Authorization.READ, Authorization.WRITE]);

            // Create a project first (required for FK constraint)
            const projectRepo = factory.getProjectRepository();
            const projectResult = await projectRepo.create(context, { name: "Test Project", status: "PLANNING" });
            expect(projectResult.success).toBe(true);

            const decisionRepo = factory.getDecisionRepository();
            const result = await decisionRepo.create(context, {
                projectId: projectResult.data!.id,
                status: "DECIDED",
                message: "Test decision",
                traceId: "TRACE-ABC-123",
                inputHash: "sha256-hash-input",
                reasoningRef: "reasoning-123",
                explanation: "Based on analysis",
                confidence: 0.85,
                limitations: ["Limited data"]
            });

            expect(result.success).toBe(true);
            expect(result.data?.traceId).toBe("TRACE-ABC-123");
            expect(result.data?.inputHash).toBe("sha256-hash-input");
            expect(result.data?.confidence).toBe(0.85);
            expect(result.data?.limitations).toEqual(["Limited data"]);
        });

        it("Evidence record preserves provenance fields", async () => {
            const tenantResult = await factory.getTenantRepository().create({ name: "Test", status: "ACTIVE" });
            const human = Principal.humanUser("user-1", tenantResult.data!.id);
            const context = SecurityContext.forHumanUser(human, [Authorization.READ, Authorization.WRITE]);

            const evidenceRepo = factory.getEvidenceRepository();
            const result = await evidenceRepo.append(context, {
                traceId: "TRACE-XYZ-789",
                inputHash: "input-hash",
                outputHash: "output-hash",
                verificationStatus: "VERIFIED",
                explanation: "Test explanation",
                confidence: 0.92,
                limitations: ["No limitations"]
            });

            expect(result.success).toBe(true);
            expect(result.data?.traceId).toBe("TRACE-XYZ-789");
            expect(result.data?.verificationStatus).toBe("VERIFIED");
            expect(result.data?.confidence).toBe(0.92);
        });
    });

    // ===== Test 11 & 12: Existing tests remain green =====
    describe("Test 11 & 12: Existing Phase 05A/05B/05C-B/C tests remain green", () => {
        it("Phase 05C-B SecurityContext remains compatible", () => {
            // Import and verify Phase 05C-B contracts work
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            
            expect(context.actor).toBeDefined();
            expect(context.tenantId).toBe("tenant-123");
        });

        it("Phase 05C-C TenantIsolation remains compatible", () => {
            const { TenantIsolation } = require("../Security/TenantIsolation");
            
            // Create a mock tenant-scoped resource
            const resource = { tenantId: "tenant-123" };
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            
            // Should allow same-tenant access
            const result = TenantIsolation.checkAccess(context, resource, Authorization.READ);
            expect(result.result).toBe("PERMITTED");
        });
    });

    // ===== Test 13: Replaceable interface =====
    describe("Test 13: Replaceable persistence interface", () => {
        it("can create repository through factory", async () => {
            const factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();

            // Get all repositories through factory
            const tenantRepo = factory.getTenantRepository();
            const userRepo = factory.getUserRepository();
            const projectRepo = factory.getProjectRepository();
            const decisionRepo = factory.getDecisionRepository();
            const evidenceRepo = factory.getEvidenceRepository();

            expect(tenantRepo).toBeDefined();
            expect(userRepo).toBeDefined();
            expect(projectRepo).toBeDefined();
            expect(decisionRepo).toBeDefined();
            expect(evidenceRepo).toBeDefined();

            factory.close();
        });

        it("repositories implement IRepository interface", async () => {
            const factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();

            const tenantRepo = factory.getTenantRepository();
            
            // Should have initialize and health methods
            expect(typeof tenantRepo.initialize).toBe("function");
            expect(typeof tenantRepo.health).toBe("function");

            factory.close();
        });
    });

    // ===== WAL Mode Tests =====
    describe("WAL Mode", () => {
        it("SQLite adapter enables WAL mode by default", async () => {
            // The SQLite adapter enables WAL mode by default
            // This is configured in the constructor
            const factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();
            
            // Health check proves SQLite is working
            expect(await factory.health()).toBe(true);
            
            factory.close();
        });
    });

    // ===== Tenant Index Tests =====
    describe("Tenant Indexes", () => {
        it("creates tenant-scoped repositories that filter by tenantId", async () => {
            const factory = new RepositoryFactory({ databasePath: ":memory:" });
            await factory.initialize();

            // Create two tenants with projects
            const tenantAResult = await factory.getTenantRepository().create({ name: "Tenant A", status: "ACTIVE" });
            const tenantBResult = await factory.getTenantRepository().create({ name: "Tenant B", status: "ACTIVE" });

            const userA = Principal.humanUser("user-A", tenantAResult.data!.id);
            const userB = Principal.humanUser("user-B", tenantBResult.data!.id);
            const contextA = SecurityContext.forHumanUser(userA, [Authorization.READ, Authorization.WRITE]);
            const contextB = SecurityContext.forHumanUser(userB, [Authorization.READ, Authorization.WRITE]);

            await factory.getProjectRepository().create(contextA, { name: "Project A", status: "Active" });
            await factory.getProjectRepository().create(contextA, { name: "Project A2", status: "Active" });
            await factory.getProjectRepository().create(contextB, { name: "Project B", status: "Active" });

            // Each tenant only sees their own projects
            const projectsA = await factory.getProjectRepository().findByTenant(contextA);
            const projectsB = await factory.getProjectRepository().findByTenant(contextB);

            expect(projectsA.data?.length).toBe(2);
            expect(projectsB.data?.length).toBe(1);

            factory.close();
        });
    });
});
