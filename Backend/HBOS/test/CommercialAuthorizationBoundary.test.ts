import { CommercialAuthorizationBoundary } from "../Product/CommercialAuthorizationBoundary";
import { CommercialIdentityService } from "../Product/CommercialIdentityService";

describe("CommercialAuthorizationBoundary", () => {
    function createIdentity() {
        const identity = new CommercialIdentityService();
        identity.initialize();
        return identity;
    }

    test("rejects missing authentication", () => {
        const identity = createIdentity();
        const boundary = new CommercialAuthorizationBoundary(identity);

        expect(boundary.authorize({ organization: "سازمان تست", permission: "READ_DASHBOARD" })).toEqual({
            allowed: false,
            session: null,
            reason: "AUTHENTICATION_REQUIRED"
        });
    });

    test("enforces tenant and permission boundaries", () => {
        const identity = createIdentity();
        const boundary = new CommercialAuthorizationBoundary(identity);
        const session = identity.createSession("مدیر", "سازمان تست", "MANAGER");

        expect(boundary.authorize({
            token: session.token,
            organization: "سازمان دیگر",
            permission: "READ_DASHBOARD"
        }).allowed).toBe(false);

        expect(boundary.authorize({
            token: session.token,
            organization: "سازمان تست",
            permission: "MANAGE_USERS"
        }).allowed).toBe(false);

        expect(boundary.authorize({
            token: session.token,
            organization: "سازمان تست",
            permission: "CREATE_DECISION"
        })).toMatchObject({ allowed: true, session: { tenantId: session.tenantId } });
    });

    test("rejects revoked sessions", () => {
        const identity = createIdentity();
        const boundary = new CommercialAuthorizationBoundary(identity);
        const session = identity.createSession("مدیر", "سازمان تست", "OWNER");
        identity.logout(session.token);

        expect(boundary.authorize({
            token: session.token,
            organization: "سازمان تست",
            permission: "READ_DASHBOARD"
        }).allowed).toBe(false);
    });
});
