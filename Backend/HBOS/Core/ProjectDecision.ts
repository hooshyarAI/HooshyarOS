import { ProjectStatus } from "./ProjectStatus";


export class ProjectDecision {

    status: ProjectStatus;

    message: string;


    constructor(status: ProjectStatus, message: string) {

        this.status = status;

        this.message = message;

    }

}