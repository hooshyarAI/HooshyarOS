export interface SystemStatus {

    version: string;

    initialized: boolean;

    timestamp: Date;

}

export interface Engine {

    name: string;

    initialize(): void;

    health(): boolean;

}