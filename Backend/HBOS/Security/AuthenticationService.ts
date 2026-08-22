import { UserCredentialStore } from "./UserCredentialStore";
import { DurableSessionStore, DurableSession } from "./DurableSessionStore";

export interface AuthenticationResult {
    userId: string;
    token: string;
    expiresAt: string;
}

export class AuthenticationService {
    constructor(
        private readonly credentials: UserCredentialStore,
        private readonly sessions: DurableSessionStore,
        private readonly sessionTtlMs = 8 * 60 * 60 * 1000
    ) {}

    login(username: string, password: string): AuthenticationResult | null {
        const user = this.credentials.authenticate(username, password);
        if (!user) return null;
        const token = this.sessions.create(user.userId, this.sessionTtlMs);
        const session = this.sessions.get(token);
        if (!session) throw new Error("Authentication session could not be established");
        return { userId: user.userId, token, expiresAt: session.expiresAt };
    }

    authenticate(token: string): DurableSession | null {
        return this.sessions.get(token);
    }

    logout(token: string): void {
        this.sessions.revoke(token);
    }
}
