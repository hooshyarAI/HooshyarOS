import { CommercialAuthenticationAuthorizationBoundary } from "../Auth/CommercialAuthenticationAuthorizationBoundary";

describe("CommercialAuthenticationAuthorizationBoundary", () => {
    test("provides tenant-scoped authentication and authorization", () => {
        const boundary = new CommercialAuthenticationAuthorizationBoundary();
        boundary.initialize();

        const session = boundary.createSession(
            "????????",
            "?????? ???",
            "OWNER"
        );

        expect(session.active).toBe(true);
        expect(boundary.getSession(session.token)?.tenantId).toBe(session.tenantId);

        expect(
            boundary.authorize(
                session.token,
                "?????? ???",
                "INGEST_DATA"
            ).tenantId
        ).toBe(session.tenantId);

        expect(() =>
            boundary.authorize(
                session.token,
                "?????? ????",
                "INGEST_DATA"
            )
        ).toThrow("AUTHORIZATION_DENIED");
    });

    test("enforces role permissions and session invalidation", () => {
        const boundary = new CommercialAuthenticationAuthorizationBoundary();
        boundary.initialize();

        const session = boundary.createSession(
            "?????????",
            "?????? ???",
            "VIEWER"
        );

        expect(
            boundary.authorize(
                session.token,
                "?????? ???",
                "READ_DASHBOARD"
            ).role
        ).toBe("VIEWER");

        expect(() =>
            boundary.authorize(
                session.token,
                "?????? ???",
                "INGEST_DATA"
            )
        ).toThrow("AUTHORIZATION_DENIED");

        expect(boundary.logout(session.token)).toBe(true);
        expect(boundary.getSession(session.token)).toBeNull();

        expect(
            boundary.auditTrail().map(event => event.type)
        ).toEqual(
            expect.arrayContaining([
                "SESSION_CREATED",
                "AUTHORIZATION_ALLOWED",
                "AUTHORIZATION_DENIED",
                "SESSION_REVOKED"
            ])
        );
    });
});
