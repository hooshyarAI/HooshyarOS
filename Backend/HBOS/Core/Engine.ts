export interface Engine {

    name: string;


    initialize(): void;


    health(): boolean;

}