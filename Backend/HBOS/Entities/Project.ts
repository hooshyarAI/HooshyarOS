import { ProjectStatus } from "./ProjectStatus";


export class Project {

    id: string;

    name: string;

    status: ProjectStatus;

    createdAt: Date;


    constructor(name: string) {

        this.id = crypto.randomUUID();

        this.name = name;

        this.status = ProjectStatus.Planning;

        this.createdAt = new Date();

    }


    activate(): void {

        this.status = ProjectStatus.Active;

    }


    complete(): void {

        this.status = ProjectStatus.Completed;

    }


    archive(): void {

        this.status = ProjectStatus.Archived;

    }

}