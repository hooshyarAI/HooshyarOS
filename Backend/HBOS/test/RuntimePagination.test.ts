import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialIngestionService } from "../Product/FinancialIngestionService";
import { parsePagination, slicePage, toPageMeta, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../Autonomous/Runtime/QueryPagination";

const DECISION_BODY = {
    problem: "choose expansion plan",
    alternatives: ["Alpha", "Beta"],
    criteria: [
        { name: "profit", weight: 0.6, direction: "benefit" },
        { name: "risk", weight: 0.4, direction: "cost" },
    ],
    scores: [
        [8, 4],
        [6, 3],
    ],
};

const csvFor = (index: number) => [
    "date,account,debit,credit,currency",
    `2026-08-0${index},Cash,${100 * index},0,IRR`,
    `2026-08-0${index},Sales,0,${100 * index},IRR`,
].join("\n");

const request = async (server: Server, path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const cookieFrom = (response: Response): string => {
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
};

describe("standardization.pagination — query contract", () => {
    test("applies the safe default and accepts explicit bounds", () => {
        const def = parsePagination(new URLSearchParams(""));
        expect(def).toEqual({ ok: true, page: { limit: DEFAULT_PAGE_LIMIT, offset: 0 } });

        const explicit = parsePagination(new URLSearchParams("limit=25&offset=50"));
        expect(explicit).toEqual({ ok: true, page: { limit: 25, offset: 50 } });

        const max = parsePagination(new URLSearchParams(`limit=${MAX_PAGE_LIMIT}`));
        expect(max).toEqual({ ok: true, page: { limit: MAX_PAGE_LIMIT, offset: 0 } });

        // Blank values fall back to the default rather than erroring.
        const blank = parsePagination(new URLSearchParams("limit=&offset="));
        expect(blank).toEqual({ ok: true, page: { limit: DEFAULT_PAGE_LIMIT, offset: 0 } });
    });

    test("fails closed on invalid limit and offset values", () => {
        for (const bad of ["0", "-1", "1.5", "abc", "1e3", "٣"]) {
            expect(parsePagination(new URLSearchParams(`limit=${bad}`))).toEqual({ ok: false, error: "PAGINATION_LIMIT_INVALID" });
        }
        expect(parsePagination(new URLSearchParams(`limit=${MAX_PAGE_LIMIT + 1}`))).toEqual({ ok: false, error: "PAGINATION_LIMIT_EXCEEDED" });
        for (const bad of ["-1", "1.5", "abc"]) {
            expect(parsePagination(new URLSearchParams(`offset=${bad}`))).toEqual({ ok: false, error: "PAGINATION_OFFSET_INVALID" });
        }
    });

    test("reports correct continuation metadata", () => {
        const items = [1, 2, 3, 4, 5];
        const page1 = slicePage(items, { limit: 2, offset: 0 });
        expect(page1).toEqual({ items: [1, 2], total: 5 });
        expect(toPageMeta({ limit: 2, offset: 0 }, page1)).toEqual({ limit: 2, offset: 0, total: 5, returned: 2, hasMore: true, nextOffset: 2 });

        const page3 = slicePage(items, { limit: 2, offset: 4 });
        expect(toPageMeta({ limit: 2, offset: 4 }, page3)).toEqual({ limit: 2, offset: 4, total: 5, returned: 1, hasMore: false, nextOffset: null });
    });
});

describe("standardization.pagination — canonical list owners", () => {
    test("listSourcesPage is tenant-filtered and walks a deterministic, gap-free order", async () => {
        const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        const service = new FinancialIngestionService(persistence);
        for (let i = 1; i <= 5; i += 1) {
            await service.ingest("tenant-a", { sourceName: `ledger-${i}.csv`, format: "CSV", content: csvFor(i) });
        }
        await service.ingest("tenant-b", { sourceName: "other.csv", format: "CSV", content: csvFor(9) });

        const all = await service.listSourcesPage("tenant-a", 100, 0);
        expect(all.total).toBe(5);
        expect(all.items).toHaveLength(5);

        const collected: string[] = [];
        for (let offset = 0; offset < 5; offset += 2) {
            const page = await service.listSourcesPage("tenant-a", 2, offset);
            expect(page.total).toBe(5);
            collected.push(...page.items.map((item) => item.sha256));
        }
        expect(collected).toHaveLength(5);
        expect(new Set(collected).size).toBe(5);
        expect([...collected].sort()).toEqual([...all.items.map((item) => item.sha256)].sort());

        const other = await service.listSourcesPage("tenant-b", 100, 0);
        expect(other.total).toBe(1);
        expect(other.items[0].sha256).not.toBe(all.items[0].sha256);

        persistence.close();
    });
});

describe("standardization.pagination — runtime list routes", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({ databasePath: ":memory:", now: () => clock });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const tick = () => { clock += 1000; };

    const register = (username: string, organization: string) =>
        request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });

    const jsonPost = (path: string, cookie: string, body: unknown) => {
        tick();
        return request(server, path, {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify(body),
        });
    };

    const list = (path: string, cookie: string) => request(server, path, { headers: { cookie } });

    const seedSources = async (cookie: string, count: number) => {
        for (let i = 1; i <= count; i += 1) {
            const response = await jsonPost("/api/ingest", cookie, { sourceName: `ledger-${i}.csv`, format: "CSV", content: csvFor(i) });
            expect(response.status).toBe(201);
        }
    };

    const seedWorkItems = async (cookie: string, count: number) => {
        const decision = await jsonPost("/api/decision/workbench", cookie, DECISION_BODY);
        expect(decision.status).toBe(200);
        for (let i = 1; i <= count; i += 1) {
            const response = await jsonPost("/api/execution/work-items", cookie, { title: `work item ${i}` });
            expect(response.status).toBe(200);
        }
    };

    const seedArtifacts = async (cookie: string, formats: string[]) => {
        const analysis = await jsonPost("/api/analyze", cookie, { csv: csvFor(1), sourceName: "ledger.csv", assets: 10000, liabilities: 2500 });
        expect(analysis.status).toBe(200);
        for (const format of formats) {
            const response = await request(server, "/api/report/export", {
                method: "POST",
                headers: { "content-type": "application/json", cookie },
                body: JSON.stringify({ format }),
            });
            expect(response.status).toBe(201);
        }
    };

    test("GET /api/sources paginates with strict validation and stable ordering", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedSources(cookie, 5);

        const defaults = await list("/api/sources", cookie);
        expect(defaults.status).toBe(200);
        const defaultsBody = await defaults.json();
        expect(defaultsBody.pagination).toEqual({ limit: DEFAULT_PAGE_LIMIT, offset: 0, total: 5, returned: 5, hasMore: false, nextOffset: null });

        const collected: string[] = [];
        for (let offset = 0; offset < 5; offset += 2) {
            const response = await list(`/api/sources?limit=2&offset=${offset}`, cookie);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.sources.length).toBeLessThanOrEqual(2);
            expect(body.pagination.total).toBe(5);
            collected.push(...body.sources.map((source: { sha256: string }) => source.sha256));
        }
        expect(collected).toHaveLength(5);
        expect(new Set(collected).size).toBe(5);

        const first = await list("/api/sources?limit=2&offset=0", cookie);
        const second = await list("/api/sources?limit=2&offset=0", cookie);
        expect(await first.json()).toEqual(await second.json());

        for (const bad of ["limit=0", "limit=abc", `limit=${MAX_PAGE_LIMIT + 1}`, "offset=-1", "offset=abc"]) {
            const response = await list(`/api/sources?${bad}`, cookie);
            expect(response.status).toBe(400);
        }
    });

    test("GET /api/execution/work-items paginates without duplicates or gaps", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedWorkItems(cookie, 3);

        const collected: string[] = [];
        for (let offset = 0; offset < 3; offset += 2) {
            const response = await list(`/api/execution/work-items?limit=2&offset=${offset}`, cookie);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.pagination.total).toBe(3);
            collected.push(...body.workItems.map((item: { workItemId: string }) => item.workItemId));
        }
        expect(collected).toHaveLength(3);
        expect(new Set(collected).size).toBe(3);

        const invalid = await list("/api/execution/work-items?limit=0", cookie);
        expect(invalid.status).toBe(400);
        expect((await invalid.json()).error).toBe("PAGINATION_LIMIT_INVALID");
    });

    test("GET /api/report/artifacts paginates without duplicates or gaps", async () => {
        const cookie = cookieFrom(await register("owner", "Acme"));
        await seedArtifacts(cookie, ["TXT", "CSV", "JSON"]);

        const collected: string[] = [];
        for (let offset = 0; offset < 3; offset += 2) {
            const response = await list(`/api/report/artifacts?limit=2&offset=${offset}`, cookie);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.pagination.total).toBe(3);
            collected.push(...body.artifacts.map((artifact: { artifactId: string }) => artifact.artifactId));
        }
        expect(collected).toHaveLength(3);
        expect(new Set(collected).size).toBe(3);

        const exceeded = await list(`/api/report/artifacts?limit=${MAX_PAGE_LIMIT + 1}`, cookie);
        expect(exceeded.status).toBe(400);
        expect((await exceeded.json()).error).toBe("PAGINATION_LIMIT_EXCEEDED");
    });

    test("list routes require authentication and never disclose another tenant", async () => {
        const acme = cookieFrom(await register("owner", "Acme"));
        const beta = cookieFrom(await register("other", "Beta"));
        await seedSources(acme, 2);
        await seedWorkItems(acme, 2);
        await seedArtifacts(acme, ["TXT"]);

        for (const path of ["/api/sources", "/api/execution/work-items", "/api/report/artifacts"]) {
            const anonymous = await request(server, path);
            expect(anonymous.status).toBe(401);

            const response = await list(path, beta);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.pagination.total).toBe(0);
        }
    });
});
