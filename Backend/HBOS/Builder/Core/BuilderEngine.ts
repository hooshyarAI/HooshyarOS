import { Engine } from "../../Core/Engine";

export class BuilderEngine implements Engine {
    readonly name = "BuilderEngine";

    initialize(): void {
        console.log("BuilderEngine Started");
    }

    health(): boolean {
        return true;
    }

    build(projectName: string) {
        console.log(`Building ${projectName}`);

        return {
            name: projectName,
            status: "READY"
        };
    }
}
